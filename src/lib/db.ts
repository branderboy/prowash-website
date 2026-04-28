import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function getDb() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _sql = neon(url);
  return _sql;
}

/**
 * Schema for the Tagglefish OS multi-tenant CMS.
 * Apply by POSTing to /api/admin/setup (idempotent — uses IF NOT EXISTS).
 */
export const SCHEMA_SQL = `
-- Clients (tenants)
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  primary_host TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain → client mapping. The proxy (src/proxy.ts) uses this to resolve which tenant
-- owns an incoming request when the host is a custom domain.
CREATE TABLE IF NOT EXISTS domains (
  id SERIAL PRIMARY KEY,
  host TEXT UNIQUE NOT NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Identity
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Site pages (CMS-managed page content)
CREATE TABLE IF NOT EXISTS site_pages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  meta_keywords TEXT,
  og_image_url TEXT,
  structured_data JSONB,
  body_html TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_site_pages_client ON site_pages(client_id, slug);

-- In-progress autosaves of page edits before publish
CREATE TABLE IF NOT EXISTS site_drafts (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  body_html TEXT,
  structured_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_posts_client_status ON posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(client_id, published_at DESC);

-- Header/footer menus
CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  location TEXT NOT NULL CHECK (location IN ('header','footer')),
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, location)
);

-- Per-client site settings
CREATE TABLE IF NOT EXISTS site_settings (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  ga4_id TEXT,
  gtm_id TEXT,
  google_verification TEXT,
  bing_verification TEXT,
  favicon_url TEXT,
  default_og_image_url TEXT,
  primary_phone TEXT,
  robots_txt TEXT,
  sitemap_extra_urls TEXT,
  stripe_secret_key TEXT,
  stripe_publishable_key TEXT,
  stripe_webhook_secret TEXT,
  cloudflare_api_token TEXT,
  cloudflare_zone_id TEXT,
  shipping_rate_amount INTEGER,
  shipping_rate_label TEXT,
  shipping_countries TEXT,
  tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_label TEXT,
  pickup_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Idempotent column adds for older deployments
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stripe_webhook_secret TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS robots_txt TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS sitemap_extra_urls TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cloudflare_api_token TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cloudflare_zone_id TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shipping_rate_amount INTEGER;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shipping_rate_label TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS shipping_countries TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pickup_label TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS pickup_address TEXT;

-- Stripe-backed products (mirror of objects in the client's Stripe account)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  unit_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_client_active ON products(client_id, active);

-- URL redirects (used when an editor renames a page slug)
CREATE TABLE IF NOT EXISTS redirects (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, source)
);
CREATE INDEX IF NOT EXISTS idx_redirects_client_source ON redirects(client_id, source);

-- Media library (Vercel Blob URLs)
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  alt_text TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_client ON media(client_id, created_at DESC);

-- Lead form submissions
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  source TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_client ON leads(client_id, created_at DESC);

-- Audit trail of every /os mutation
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_log(client_id, created_at DESC);

-- Orders placed through the public store (Stripe Checkout)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  customer_email TEXT,
  customer_name TEXT,
  amount_total INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  line_items JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id, created_at DESC);
`;
