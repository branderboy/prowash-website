#!/usr/bin/env node
// One-shot cleanup: rewrite any "*.html" URL anywhere in the seed (body_html
// strings AND structured_data values) to its clean-URL form. The dashboard
// never serves .html URLs.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "src/seed/prowash-pages.json");
const seed = JSON.parse(readFileSync(file, "utf8"));

function stripHtmlInString(s) {
  if (typeof s !== "string") return s;
  let out = s;

  // Quoted internal-looking paths in inline JS / HTML attrs.
  out = out.replace(/(['"])(\.{0,2}\/?[\w][\w\-/]*?)\.html(['"])/g, (m, q1, path, q2) => {
    if (path.startsWith("http")) return m;
    let p = path.replace(/^\.\//, "");
    if (p === "index") p = "";
    if (p.endsWith("/index")) p = p.slice(0, -"/index".length);
    return `${q1}/${p}${q2}`;
  });

  // Absolute URLs ending in .html (or .html with trailing slash/punctuation).
  out = out.replace(/(https?:\/\/[\w.-]+(?:\/[\w\-/]+)?)\.html(?=[^\w]|$)/gi, "$1");

  // Plain-text host/path references in copy.
  out = out.replace(/((?:[\w.-]+\.[a-z]{2,})\/[\w\-/]+)\.html\b/gi, "$1");

  return out;
}

function walk(value) {
  if (value == null) return value;
  if (typeof value === "string") return stripHtmlInString(value);
  if (Array.isArray(value)) return value.map(walk);
  if (typeof value === "object") {
    const next = {};
    for (const [k, v] of Object.entries(value)) next[k] = walk(v);
    return next;
  }
  return value;
}

let touched = 0;
for (const p of seed) {
  const before = JSON.stringify(p);
  if (typeof p.body_html === "string") p.body_html = stripHtmlInString(p.body_html);
  if (p.structured_data != null) p.structured_data = walk(p.structured_data);
  if (typeof p.meta_description === "string") p.meta_description = stripHtmlInString(p.meta_description);
  if (JSON.stringify(p) !== before) touched++;
}

writeFileSync(file, JSON.stringify(seed, null, 2));
console.log(`Updated ${touched} of ${seed.length} pages`);
