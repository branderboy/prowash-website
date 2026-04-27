"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { withClient } from "@/lib/os/tenancy";
import { audit } from "@/lib/os/audit";
import { getStripeForClient } from "@/lib/stripe";

const productInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  unit_amount_dollars: z.coerce.number().min(0).max(100000),
  currency: z.string().min(3).max(3).default("usd"),
  active: z.boolean().optional(),
});

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

export async function createProductAction(formData: FormData) {
  const parsed = productInput.parse({
    name: String(formData.get("name") || ""),
    description: (formData.get("description") as string) || null,
    image_url: (formData.get("image_url") as string) || null,
    unit_amount_dollars: formData.get("unit_amount_dollars"),
    currency: String(formData.get("currency") || "usd").toLowerCase(),
    active: formData.get("active") === "on",
  });
  const cents = dollarsToCents(parsed.unit_amount_dollars);

  const id = await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const stripe = await getStripeForClient(clientId);

    let stripeProductId: string | null = null;
    let stripePriceId: string | null = null;
    if (stripe) {
      const prod = await stripe.products.create({
        name: parsed.name,
        description: parsed.description || undefined,
        images: parsed.image_url ? [parsed.image_url] : undefined,
        active: parsed.active ?? true,
      });
      const price = await stripe.prices.create({
        product: prod.id,
        unit_amount: cents,
        currency: parsed.currency,
      });
      stripeProductId = prod.id;
      stripePriceId = price.id;
    }

    const rows = (await sql`
      INSERT INTO products (client_id, stripe_product_id, stripe_price_id, name, description, image_url, unit_amount, currency, active)
      VALUES (${clientId}, ${stripeProductId}, ${stripePriceId}, ${parsed.name}, ${parsed.description ?? null}, ${parsed.image_url ?? null}, ${cents}, ${parsed.currency}, ${parsed.active ?? true})
      RETURNING id
    `) as Array<{ id: number }>;
    await audit(session, "product.create", "product", rows[0].id, {
      stripe_product_id: stripeProductId,
      synced: Boolean(stripeProductId),
    });
    return rows[0].id;
  });

  revalidatePath("/os/products");
  redirect(`/os/products/${id}?saved=1`);
}

export async function updateProductAction(productId: number, formData: FormData) {
  const parsed = productInput.parse({
    name: String(formData.get("name") || ""),
    description: (formData.get("description") as string) || null,
    image_url: (formData.get("image_url") as string) || null,
    unit_amount_dollars: formData.get("unit_amount_dollars"),
    currency: String(formData.get("currency") || "usd").toLowerCase(),
    active: formData.get("active") === "on",
  });
  const cents = dollarsToCents(parsed.unit_amount_dollars);

  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const stripe = await getStripeForClient(clientId);

    const existing = (await sql`
      SELECT id, stripe_product_id, stripe_price_id, unit_amount, currency
      FROM products WHERE id = ${productId} AND client_id = ${clientId} LIMIT 1
    `) as Array<{ id: number; stripe_product_id: string | null; stripe_price_id: string | null; unit_amount: number; currency: string }>;
    if (!existing[0]) throw new Error("product not found");
    const cur = existing[0];

    let nextPriceId = cur.stripe_price_id;

    if (stripe && cur.stripe_product_id) {
      // Update product fields in Stripe
      await stripe.products.update(cur.stripe_product_id, {
        name: parsed.name,
        description: parsed.description || undefined,
        images: parsed.image_url ? [parsed.image_url] : undefined,
        active: parsed.active ?? true,
      });
      // Stripe prices are immutable: archive the old price + create a new one if changed
      if (cur.unit_amount !== cents || cur.currency.toLowerCase() !== parsed.currency) {
        if (cur.stripe_price_id) {
          await stripe.prices.update(cur.stripe_price_id, { active: false });
        }
        const newPrice = await stripe.prices.create({
          product: cur.stripe_product_id,
          unit_amount: cents,
          currency: parsed.currency,
        });
        nextPriceId = newPrice.id;
      }
    } else if (stripe && !cur.stripe_product_id) {
      // Backfill into Stripe if the product was created before Stripe was wired
      const prod = await stripe.products.create({
        name: parsed.name,
        description: parsed.description || undefined,
        images: parsed.image_url ? [parsed.image_url] : undefined,
        active: parsed.active ?? true,
      });
      const price = await stripe.prices.create({
        product: prod.id,
        unit_amount: cents,
        currency: parsed.currency,
      });
      await sql`
        UPDATE products SET stripe_product_id = ${prod.id} WHERE id = ${productId}
      `;
      nextPriceId = price.id;
    }

    await sql`
      UPDATE products SET
        name = ${parsed.name},
        description = ${parsed.description ?? null},
        image_url = ${parsed.image_url ?? null},
        unit_amount = ${cents},
        currency = ${parsed.currency},
        active = ${parsed.active ?? true},
        stripe_price_id = ${nextPriceId},
        updated_at = NOW()
      WHERE id = ${productId} AND client_id = ${clientId}
    `;
    await audit(session, "product.update", "product", productId);
  });

  revalidatePath("/os/products");
  redirect(`/os/products/${productId}?saved=1`);
}

export async function archiveProductAction(productId: number) {
  await withClient(async ({ session, clientId }) => {
    const sql = getDb();
    const stripe = await getStripeForClient(clientId);
    const existing = (await sql`
      SELECT stripe_product_id FROM products WHERE id = ${productId} AND client_id = ${clientId} LIMIT 1
    `) as Array<{ stripe_product_id: string | null }>;
    if (stripe && existing[0]?.stripe_product_id) {
      await stripe.products.update(existing[0].stripe_product_id, { active: false });
    }
    await sql`UPDATE products SET active = FALSE, updated_at = NOW() WHERE id = ${productId} AND client_id = ${clientId}`;
    await audit(session, "product.archive", "product", productId);
  });
  revalidatePath("/os/products");
  redirect("/os/products");
}
