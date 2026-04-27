#!/usr/bin/env node
// Reads the legacy HTML files from the repo root and emits
// src/seed/prowash-pages.json — one entry per page with title, meta,
// structured data, and the body HTML between </header> and <footer>.
//
// Run: node scripts/extract-pages.mjs
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "src", "public", "scripts"]);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (entry.endsWith(".html")) acc.push(full);
  }
  return acc;
}

function pathToSlug(absPath) {
  let rel = relative(ROOT, absPath).replace(/\\/g, "/");
  if (rel.endsWith("/index.html")) rel = rel.slice(0, -"/index.html".length);
  else if (rel === "index.html") rel = "";
  else if (rel.endsWith(".html")) rel = rel.slice(0, -".html".length);
  return rel;
}

const FILES = walk(ROOT).map((abs) => [relative(ROOT, abs), pathToSlug(abs)]);

function pick(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function pickAttr(html, tag, attrName) {
  const re = new RegExp(`<${tag}[^>]*${attrName}=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

function pickMeta(html, name) {
  const re = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i");
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function pickStructuredData(html) {
  // First <script type="application/ld+json"> block
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function rewriteLinks(body) {
  // Convert .html links to clean URLs and "index.html" → "/"
  let out = body;
  // Strip ../ prefixes from hrefs entirely; we always anchor to root
  out = out.replace(/href="(?:\.\.\/)+/g, 'href="/');
  out = out.replace(/src="(?:\.\.\/)+/g, 'src="/');
  // Make src="images/..." absolute
  out = out.replace(/src="images\//g, 'src="/images/');
  // index.html in any folder → folder root
  out = out.replace(/href="\/?([\w\/-]*)index\.html"/g, (_m, p) => `href="/${p.replace(/\/$/, "")}"`);
  out = out.replace(/href="index\.html"/g, 'href="/"');
  // Generic .html → clean
  out = out.replace(/href="\/?([\w\-\/]+)\.html"/g, 'href="/$1"');
  return out;
}

function extractBody(html) {
  // From end of </header> to start of <footer>
  const after = html.indexOf("</header>");
  if (after < 0) return null;
  const before = html.indexOf("<footer", after);
  if (before < 0) return null;
  const body = html.slice(after + "</header>".length, before).trim();
  return rewriteLinks(body);
}

const out = [];
for (const [file, slug] of FILES) {
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.warn(`[skip] ${file} does not exist`);
    continue;
  }
  const html = readFileSync(path, "utf8");
  const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pickMeta(html, "description");
  const keywords = pickMeta(html, "keywords");
  const ogImage = (() => {
    const m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    return m ? m[1] : null;
  })();
  const structured = pickStructuredData(html);
  const body = extractBody(html);
  if (!body) {
    console.warn(`[skip] ${file} body not extractable`);
    continue;
  }
  out.push({
    slug,
    title: title || file,
    meta_description: description,
    meta_keywords: keywords,
    og_image_url: ogImage,
    structured_data: structured,
    body_html: body,
  });
  console.log(`[ok] ${file} → /${slug} (${body.length} bytes)`);
}

writeFileSync(join(ROOT, "src/seed/prowash-pages.json"), JSON.stringify(out, null, 2));
console.log(`\nWrote ${out.length} pages to src/seed/prowash-pages.json`);
