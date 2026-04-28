import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/os/password";
import seedPages from "@/seed/prowash-pages.json";

function authorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("token");
  return provided === expected;
}

type SeedPage = {
  slug: string;
  title: string;
  meta_description: string | null;
  meta_keywords: string | null;
  og_image_url: string | null;
  structured_data: unknown;
  body_html: string;
};

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const ownerEmail = (process.env.PROWASH_OWNER_EMAIL || "owner@prowash.com").toLowerCase();
  const ownerName = process.env.PROWASH_OWNER_NAME || "Prowash Owner";
  const ownerPassword = process.env.PROWASH_OWNER_PASSWORD;
  const primaryHost = (process.env.PROWASH_PRIMARY_HOST || "prowash.com").toLowerCase();
  if (!ownerPassword) {
    return NextResponse.json(
      { ok: false, error: "PROWASH_OWNER_PASSWORD is required" },
      { status: 400 }
    );
  }

  // Upsert client
  await sql`
    INSERT INTO clients (name, slug, primary_host)
    VALUES ('Prowash', 'prowash', ${primaryHost})
    ON CONFLICT (slug) DO UPDATE SET primary_host = EXCLUDED.primary_host
  `;
  const clientRow = (await sql`SELECT id FROM clients WHERE slug = 'prowash' LIMIT 1`) as Array<{ id: number }>;
  const clientId = clientRow[0].id;

  // Upsert owner user (and reset password to env value on every seed run)
  const passwordHash = hashPassword(ownerPassword);
  await sql`
    INSERT INTO users (email, name, password_hash)
    VALUES (${ownerEmail}, ${ownerName}, ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
  `;
  const userRow = (await sql`SELECT id FROM users WHERE email = ${ownerEmail} LIMIT 1`) as Array<{ id: number }>;
  const userId = userRow[0].id;

  // Upsert membership
  await sql`
    INSERT INTO memberships (user_id, client_id, role)
    VALUES (${userId}, ${clientId}, 'owner')
    ON CONFLICT (user_id, client_id) DO UPDATE SET role = EXCLUDED.role
  `;

  // Upsert domain mappings (primary + www variant)
  const hosts = [primaryHost, primaryHost.startsWith("www.") ? primaryHost.slice(4) : `www.${primaryHost}`];
  for (const host of hosts) {
    await sql`
      INSERT INTO domains (host, client_id, is_primary)
      VALUES (${host}, ${clientId}, ${host === primaryHost})
      ON CONFLICT (host) DO UPDATE SET client_id = EXCLUDED.client_id
    `;
  }

  // Default header + footer menus (mirrors the legacy HTML nav)
  const headerMenu = [
    { label: "Home", href: "/" },
    {
      label: "Services",
      href: "/services",
      children: [
        { label: "Car Wash", href: "/services/car-wash" },
        { label: "Car Detailing", href: "/services/car-detailing" },
        { label: "Window Tinting", href: "/services/window-tinting" },
        { label: "Snow Removal", href: "/services/snow-removal" },
        { label: "Car Dealerships", href: "/services/car-dealerships" },
        { label: "Rideshare Drivers", href: "/services/rideshare" },
      ],
    },
    {
      label: "Programs",
      href: "#",
      children: [
        { label: "Loyalty Rewards", href: "/rewards" },
        { label: "Birthday Club", href: "/birthday-club" },
      ],
    },
    {
      label: "Locations",
      href: "/locations",
      children: [
        { label: "Capitol Heights", href: "/locations/capitol-heights" },
        { label: "Clinton", href: "/locations/clinton" },
        { label: "Bowie", href: "/locations/bowie" },
        { label: "Upper Marlboro", href: "/locations/upper-marlboro" },
        { label: "Washington DC", href: "/locations/washington-dc" },
        { label: "Carrolton (in-store pickup)", href: "/locations/carrolton" },
      ],
    },
    { label: "Shop", href: "/shop" },
    { label: "FAQ", href: "/faq" },
    { label: "Book Now", href: "/book", style: "cta" },
  ];
  const footerMenu = [
    { heading: "Quick Links", items: [
      { label: "All Services", href: "/services" },
      { label: "Car Wash", href: "/services/car-wash" },
      { label: "Car Detailing", href: "/services/car-detailing" },
      { label: "Window Tinting", href: "/services/window-tinting" },
    ]},
    { heading: "Company", items: [
      { label: "About Us", href: "/about" },
      { label: "Book A Car Detailing Appt.", href: "/book" },
      { label: "FAQ", href: "/faq" },
    ]},
  ];
  await sql`
    INSERT INTO menus (client_id, location, items)
    VALUES (${clientId}, 'header', ${JSON.stringify(headerMenu)}::jsonb)
    ON CONFLICT (client_id, location) DO UPDATE SET items = EXCLUDED.items
  `;
  await sql`
    INSERT INTO menus (client_id, location, items)
    VALUES (${clientId}, 'footer', ${JSON.stringify(footerMenu)}::jsonb)
    ON CONFLICT (client_id, location) DO UPDATE SET items = EXCLUDED.items
  `;

  // Default site settings (incl. robots.txt)
  const robots = `User-agent: *\nAllow: /\n\nSitemap: https://${primaryHost}/sitemap.xml\n`;
  await sql`
    INSERT INTO site_settings (client_id, primary_phone, robots_txt)
    VALUES (${clientId}, '(301) 307-1414', ${robots})
    ON CONFLICT (client_id) DO UPDATE SET robots_txt = EXCLUDED.robots_txt, primary_phone = EXCLUDED.primary_phone
  `;

  // Pages — upsert by (client_id, slug)
  const pages = seedPages as SeedPage[];
  let inserted = 0;
  let updated = 0;
  for (const p of pages) {
    const existing = (await sql`
      SELECT id FROM site_pages WHERE client_id = ${clientId} AND slug = ${p.slug} LIMIT 1
    `) as Array<{ id: number }>;
    if (existing[0]) {
      // Don't overwrite content edits — only update if body_html is empty
      await sql`
        UPDATE site_pages SET
          title = COALESCE(NULLIF(title,''), ${p.title}),
          meta_description = COALESCE(meta_description, ${p.meta_description}),
          meta_keywords = COALESCE(meta_keywords, ${p.meta_keywords}),
          og_image_url = COALESCE(og_image_url, ${p.og_image_url}),
          structured_data = COALESCE(structured_data, ${p.structured_data ? JSON.stringify(p.structured_data) : null}::jsonb),
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO site_pages (client_id, slug, title, meta_description, meta_keywords, og_image_url, structured_data, body_html, is_published)
        VALUES (
          ${clientId}, ${p.slug}, ${p.title}, ${p.meta_description}, ${p.meta_keywords}, ${p.og_image_url},
          ${p.structured_data ? JSON.stringify(p.structured_data) : null}::jsonb,
          ${p.body_html}, TRUE
        )
      `;
      inserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    clientId,
    userId,
    primaryHost,
    pages: { inserted, updated, total: pages.length },
  });
}
