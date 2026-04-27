#!/usr/bin/env node
// Offline mirror of the runtime /os/health checks, run against the
// extracted Prowash seed before it's loaded into Postgres. Catches the
// SEO / link / metadata problems that shipped in the legacy HTML.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const seed = JSON.parse(readFileSync(join(ROOT, "src/seed/prowash-pages.json"), "utf8"));

const findings = [];
function add(severity, slug, msg, detail) {
  findings.push({ severity, slug, msg, detail });
}

const slugSet = new Set(seed.map((p) => p.slug));
const titleCounts = new Map();
for (const p of seed) {
  if (!p.title) continue;
  const k = p.title.trim().toLowerCase();
  if (!titleCounts.has(k)) titleCounts.set(k, []);
  titleCounts.get(k).push(p.slug);
}

const expected = ["", "about", "contact", "faq", "book", "shop", "services", "locations"];
for (const e of expected) {
  if (!slugSet.has(e)) add("error", e, `Expected page missing: /${e}`);
}

for (const p of seed) {
  // Title
  if (!p.title || !p.title.trim()) add("error", p.slug, "No <title>");
  // Meta description
  if (!p.meta_description || !p.meta_description.trim()) {
    add("warning", p.slug, "No meta description");
  } else if (p.meta_description.length > 160) {
    add("info", p.slug, `Meta description is ${p.meta_description.length} chars (>160)`);
  } else if (p.meta_description.length < 50) {
    add("info", p.slug, `Meta description is short (${p.meta_description.length} chars)`);
  }
  // Body content
  const bodyText = (p.body_html || "").replace(/<[^>]+>/g, "").trim();
  if (bodyText.length === 0) add("error", p.slug, "Empty body");
  else if (bodyText.length < 200) add("warning", p.slug, `Thin content (${bodyText.length} chars)`);
  // Slug pattern
  if (p.slug && !/^[a-z0-9\-/]*$/.test(p.slug)) add("warning", p.slug, "Slug has unusual characters");
  // OG image sanity
  if (p.og_image_url && !/^https?:\/\//.test(p.og_image_url) && !p.og_image_url.startsWith("/")) {
    add("warning", p.slug, `OG image not absolute: "${p.og_image_url}"`);
  }
}

// Duplicate titles
for (const [t, slugs] of titleCounts) {
  if (slugs.length > 1) {
    add("warning", slugs.join(", "), `Duplicate <title>: "${t}"`, `Shared by ${slugs.length} pages`);
  }
}

// Internal-link audit
const linkRegex = /href="\/([^"#?]*)"/g;
const seenBroken = new Map(); // target → [slugs]
for (const p of seed) {
  if (!p.body_html) continue;
  const matches = p.body_html.matchAll(linkRegex);
  for (const m of matches) {
    let target = (m[1] || "").replace(/\/$/, "");
    // strip fragments/queries
    target = target.split("#")[0].split("?")[0];
    if (target.startsWith("blog/")) continue;
    if (target.startsWith("os")) continue;
    if (target.startsWith("api/")) continue;
    if (slugSet.has(target)) continue;
    if (target === "" && slugSet.has("")) continue;
    if (!seenBroken.has(target)) seenBroken.set(target, new Set());
    seenBroken.get(target).add(p.slug);
  }
}
for (const [target, fromSet] of seenBroken) {
  add("warning", target, `Broken internal link target: /${target}`, `Linked from: ${[...fromSet].slice(0, 5).join(", ")}${fromSet.size > 5 ? ` (+${fromSet.size - 5} more)` : ""}`);
}

// External href audit - count external links per page (informational)
const extRegex = /href="https?:\/\/([^"\/]+)/g;
const externalHosts = new Map();
for (const p of seed) {
  const matches = (p.body_html || "").matchAll(extRegex);
  for (const m of matches) {
    const host = m[1].toLowerCase().replace(/^www\./, "");
    if (host.includes("handcarwashandcardetail.com") || host.includes("prowash")) continue;
    if (!externalHosts.has(host)) externalHosts.set(host, new Set());
    externalHosts.get(host).add(p.slug);
  }
}

// Print summary
const counts = { error: 0, warning: 0, info: 0 };
for (const f of findings) counts[f.severity]++;

console.log("\n=== Prowash seed audit ===");
console.log(`Pages analysed: ${seed.length}`);
console.log(`Errors: ${counts.error}, Warnings: ${counts.warning}, Info: ${counts.info}\n`);

const order = { error: 0, warning: 1, info: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);

for (const f of findings) {
  const tag = f.severity.toUpperCase().padEnd(7);
  const slug = f.slug ? `/${f.slug}`.padEnd(40) : "".padEnd(40);
  console.log(`${tag} ${slug} ${f.msg}${f.detail ? ` — ${f.detail}` : ""}`);
}

if (externalHosts.size > 0) {
  console.log("\n=== External link hosts (informational) ===");
  const ranked = [...externalHosts.entries()].sort((a, b) => b[1].size - a[1].size);
  for (const [host, pages] of ranked.slice(0, 15)) {
    console.log(`${host} (${pages.size} page${pages.size === 1 ? "" : "s"})`);
  }
}
