---
name: build-tagglefish-os
description: Use when building or extending Tagglefish OS — the dashboard each TaggleFish client logs into to manage the content of their own website (pages, blog posts, menus, tracking codes). Lives at /os in this Next.js repo. Triggers on requests to build, scaffold, integrate, or extend the website content editor, the /os shell, multi-tenant data, magic-link client auth, or onboarding a specific client (e.g. "integrate Prowash", "add a client to the OS"). Also triggers on phrases like "Taggle OS", "Tagglefish OS", "the OS", "client dashboard", "site editor", "content manager".
---

# Build Tagglefish OS

## What it is

Tagglefish OS is a **content management system**. Each TaggleFish client logs in at `/os` to manage the content of **their own** website:

- Edit page copy, meta, structured data
- Write/schedule/publish blog posts
- Edit nav and footer menus
- Manage tracking codes (GA4, UTMs, site verification)
- Upload media assets

That is the entire scope. **No SMS.** No Lead Manager, no Review Manager, no SEO Manager, no Growth Operator OS in this build. The marketing pages may describe more — those are future work, not in this product. Stay scoped to **content management of the client's own site**.

## Who uses it

- Users = TaggleFish's clients (contractors like Prowash). They log in at `/os` to manage the content of **their own** website.
- Each client's public site is served from this same Next.js app via the custom-domain rewrite in `src/middleware.ts` (host `prowash.com` → `/_site/[path]`).
- What a client edits in `/os` is what renders on their public domain via `/_site/`.
- `/admin` is staff-only. Clients never see it. Don't merge `/admin` and `/os`.
- **Prowash is the first client integration.** A deliverable is "done" only when Prowash's owner can perform the action in `/os` AND the result renders on prowash.com.

## Stack invariants — do not change

- **Framework**: Next.js 14 App Router, TypeScript, server components by default
- **DB**: Neon Postgres via `@neondatabase/serverless` — always import `getDb` from `src/lib/db.ts`. Schema lives in `SCHEMA_SQL` in that file; extend it there, then run `POST /api/admin/setup` to apply.
- **Styling**: Tailwind tokens `navy`, `orange`, `cream` (see `tailwind.config.ts`). Use existing shadcn-style primitives in `src/components/ui/`.
- **Email** (for magic links only): Resend via `src/lib/email.ts`. **Uploads**: Vercel Blob.
- **Custom domains**: `src/middleware.ts` rewrites non-internal hosts to `/_site/[path]`. Don't break this.
- **Auth today**: cookie-based `admin_auth` for `/admin`. `/os` needs its own cookie (`os_auth`) — do not reuse `admin_auth`.

## Architecture rules

1. **Three surfaces, one repo**:
   - `/admin/*` — TaggleFish staff only. Existing. Don't touch unless asked.
   - `/os/*` — clients log in here to edit their site content. New. This is what we're building.
   - `/_site/*` — public render path for client domains. Already wired. What `/os` edits must render here.
2. **Multi-tenant**: every `/os` query MUST be scoped by `client_id` resolved from the session. Single helper `getOsSession()`. Never trust client-supplied IDs. Add a runtime assertion in a `withClient` helper that throws if `client_id` is missing.
3. **Roles**: `owner`, `manager`, `staff` (per client). Gate writes by role.
4. **Server-first**: server components + server actions. Client components only for the rich-text editor and live-preview.
5. **Audit everything that mutates** — write to `audit_log`.
6. **Magic-link auth, no new lib.** Resend + signed cookie (HMAC sha256 over `user_id:client_id:exp`). Hash tokens (`sha256`) before insert; never store plaintext.
7. **Definition of done**: Prowash owner can perform the action in `/os` and the result renders on prowash.com via `/_site/`.

## Data model

**Reuse, don't duplicate.** These already exist in `src/lib/db.ts` — extend with columns if needed, never parallel tables:
`clients`, `site_pages`, `site_drafts`, `domains`, `audit_log`.

Add to `SCHEMA_SQL`:

```sql
-- Identity
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);
CREATE TABLE IF NOT EXISTS magic_links (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog posts (page edits go to existing site_pages)
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

-- Site menus (nav + footer)
CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  location TEXT NOT NULL CHECK (location IN ('header','footer')),
  items JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, location)
);

-- Site settings (tracking codes, verification, favicons, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  ga4_id TEXT,
  gtm_id TEXT,
  google_verification TEXT,
  bing_verification TEXT,
  favicon_url TEXT,
  default_og_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_client_status ON posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(client_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_client ON media(client_id, created_at DESC);
```

## Directory layout to create

```
src/app/os/
  layout.tsx                  # OS shell: sidebar + topbar
  page.tsx                    # /os home — recent edits, scheduled posts
  login/page.tsx              # email entry → magic link
  verify/page.tsx             # consumes ?token=... and sets os_auth cookie
  pages/                      # Page editor (writes to site_pages)
    page.tsx                  # list of editable pages
    [slug]/page.tsx           # editor (copy, meta, structured data)
  posts/                      # Blog posts
    page.tsx                  # post list
    new/page.tsx
    [id]/page.tsx             # editor
    calendar/page.tsx         # scheduling calendar
  menus/page.tsx              # nav + footer editor
  tracking/page.tsx           # GA4/GTM, verification codes
  media/page.tsx              # media library
  settings/page.tsx           # site_settings (favicon, default OG, etc.)

src/lib/os/
  session.ts                  # getOsSession(), requireOsSession(), requireRole()
  magic-link.ts               # createLink(), consumeLink()
  tenancy.ts                  # withClient<T>(fn) helper that scopes queries

src/app/api/os/
  auth/request/route.ts       # POST email → send magic link
  auth/verify/route.ts        # GET ?token=... → set cookie, redirect
  upload/route.ts             # POST file → Vercel Blob → media row
```

## Conventions

- **Server actions** for first-party UI mutations. Reserve `/api/os/*` for the auth callback and uploads.
- **One query helper per resource** (`listPosts(clientId)`, `getPage(clientId, slug)`). Never query directly from a page component.
- **Validation at the boundary**: zod schema for every server action input. Reuse patterns in `src/lib/validation.ts`.
- **No `'use client'` at the page level.** Push it down to the editor or media picker.
- **Loading + error**: every data route needs `loading.tsx` and `error.tsx`.
- **Empty states**: every list view needs a designed empty state.
- **Slugs**: server-generate from title, enforce `(client_id, slug)` uniqueness.
- **Revalidation**: after publish, `revalidatePath('/_site/...')` for the affected paths so the public site updates.

## Build order

One PR per step. Prowash is the proof.

1. **Auth + shell + migrations + Prowash seed**
   - Add new tables to `SCHEMA_SQL`. Run `POST /api/admin/setup`.
   - Build `src/lib/os/{session,magic-link,tenancy}.ts`.
   - Gate `/os/*` in `src/middleware.ts` (skip `/os/login`, `/os/verify`).
   - Build `/os/login`, `/os/verify`, and the shell at `src/app/os/layout.tsx`.
   - Seed Prowash: `clients` row, owner `users` row, `memberships` row, `domains` mapping for `prowash.com` (or staging host). Confirm owner logs in and lands on `/os`.

2. **Page editor MVP**
   - `/os/pages` list and `/os/pages/[slug]` editor that reads/writes `site_pages` (title, meta, copy, structured data).
   - Update `/_site/[path]` (or its existing analog) to read from `site_pages` filtered by the request's client (resolved from `domains` via host) before falling back to the default render.
   - **Done when**: Prowash owner edits a page's copy in `/os/pages/<slug>` and the change renders on prowash.com.

3. **Blog posts MVP**
   - `posts` CRUD with markdown editor, draft/schedule/publish.
   - Render path at `/_site/blog/[slug]` reads from `posts` scoped by host's client.
   - Index at `/_site/blog` lists published posts.
   - **Done when**: Prowash owner publishes a post and it renders on prowash.com/blog/<slug>.

4. **Menus + tracking + media + settings**
   - `/os/menus` editor for header/footer (writes `menus`); `/_site` layout reads them per client.
   - `/os/tracking` writes `site_settings` (GA4/GTM/verification); injected into the rendered `<head>` per client.
   - `/os/media` upload to Vercel Blob, list, alt-text editing.
   - `/os/settings` favicon, default OG image.
   - **Done when**: Prowash menu changes show on prowash.com nav, GA4 fires on the public site, an uploaded image is selectable inside the post editor.

## Hard rules

- Don't touch the public marketing pages under `src/app/*` (except `/_site/`).
- Don't break `/admin` or its middleware behavior.
- Don't merge `/os` into `/admin`.
- Don't add new auth/ORM/UI libraries.
- Don't store plaintext magic-link tokens. Hash with sha256 before insert.
- Don't query without a `client_id` filter on any `/os` route.
- **Don't add SMS, email automation, lead manager, review manager, SEO ranking, or growth/goal features to this build.** Out of scope. If asked, refuse and confirm with the user.
- Don't push to `main` — work on the assigned session branch.

## Before writing code

1. Read `src/lib/db.ts` (full `SCHEMA_SQL`) and `src/middleware.ts`.
2. Read the closest existing `/admin/*` analog (`/admin/pages` for the page editor pattern).
3. Inventory what Prowash already has: query `clients`, `domains`, `site_pages` for their rows.
4. Propose: schema additions, route map, Prowash seed plan. Get explicit user approval before scaffolding.
