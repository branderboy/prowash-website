import Stripe from "stripe";
import { getDb } from "@/lib/db";

const cache = new Map<number, Stripe>();

export async function getStripeForClient(clientId: number): Promise<Stripe | null> {
  if (cache.has(clientId)) return cache.get(clientId)!;
  const sql = getDb();
  const rows = (await sql`
    SELECT stripe_secret_key FROM site_settings WHERE client_id = ${clientId} LIMIT 1
  `) as Array<{ stripe_secret_key: string | null }>;
  const key = rows[0]?.stripe_secret_key;
  if (!key) return null;
  const s = new Stripe(key, { apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion });
  cache.set(clientId, s);
  return s;
}

export function clearStripeCache(clientId?: number) {
  if (clientId == null) cache.clear();
  else cache.delete(clientId);
}
