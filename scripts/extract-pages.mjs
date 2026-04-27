#!/usr/bin/env node
// Reads the legacy HTML files (from --src argument or repo root), strips the
// shared header/footer chrome, and emits src/seed/prowash-pages.json with
// path-aware link rewrites so relative URLs like ../bowie.html resolve to
// the correct slug.
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, posix } from "node:path";

const args = process.argv.slice(2);
const srcArgIdx = args.indexOf("--src");
const SRC = srcArgIdx >= 0 ? args[srcArgIdx + 1] : process.cwd();
const OUT_ROOT = process.cwd();

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "src", "public", "scripts", "legacy-archive"]);

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
  let rel = relative(SRC, absPath).replace(/\\/g, "/");
  if (rel.endsWith("/index.html")) rel = rel.slice(0, -"/index.html".length);
  else if (rel === "index.html") rel = "";
  else if (rel.endsWith(".html")) rel = rel.slice(0, -".html".length);
  return rel;
}

const FILES = walk(SRC).map((abs) => [relative(SRC, abs).replace(/\\/g, "/"), pathToSlug(abs)]);

function pick(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
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
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/**
 * Rewrite href= and src= URLs from the perspective of `fromRel` (the relative
 * path of the source HTML file). Strips ".html" and "index.html" so the
 * result is a clean slug-based URL like "/locations/bowie".
 */
function rewriteAttrs(body, fromRel) {
  const fromDir = dirname(fromRel === "index.html" ? "" : fromRel);
  const attrRegex = /(href|src)="([^"]+)"/g;
  return body.replace(attrRegex, (full, attr, rawUrl) => {
    if (!rawUrl) return full;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("//")) return full;
    if (rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:") || rawUrl.startsWith("#") || rawUrl.startsWith("javascript:") || rawUrl.startsWith("data:")) return full;

    // Split fragment / query
    let path = rawUrl;
    let suffix = "";
    const hashIdx = path.indexOf("#");
    const qIdx = path.indexOf("?");
    let cut = -1;
    if (hashIdx >= 0 && (qIdx < 0 || hashIdx < qIdx)) cut = hashIdx;
    else if (qIdx >= 0) cut = qIdx;
    if (cut >= 0) {
      suffix = path.slice(cut);
      path = path.slice(0, cut);
    }

    // Resolve against the source file's directory using POSIX path math
    const resolved = posix.normalize(
      path.startsWith("/") ? path : posix.join(fromDir, path)
    ).replace(/^\/+/, "");

    // For src= leave as a /-prefixed path (assets in /public)
    if (attr === "src") {
      return `${attr}="/${resolved}${suffix}"`;
    }

    // For href= turn .html / index.html into clean slugs
    let slug = resolved;
    if (slug.endsWith("/index.html")) slug = slug.slice(0, -"/index.html".length);
    else if (slug === "index.html") slug = "";
    else if (slug.endsWith(".html")) slug = slug.slice(0, -".html".length);

    return `${attr}="/${slug}${suffix}"`;
  });
}

function extractBody(html) {
  const after = html.indexOf("</header>");
  if (after < 0) return null;
  const before = html.indexOf("<footer", after);
  if (before < 0) return null;
  return html.slice(after + "</header>".length, before).trim();
}

const out = [];
for (const [file, slug] of FILES) {
  const path = join(SRC, file);
  if (!existsSync(path)) continue;
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
  const rewritten = rewriteAttrs(body, file);
  out.push({
    slug,
    title: title || file,
    meta_description: description,
    meta_keywords: keywords,
    og_image_url: ogImage,
    structured_data: structured,
    body_html: rewritten,
  });
  console.log(`[ok] ${file} → /${slug} (${rewritten.length} bytes)`);
}

writeFileSync(join(OUT_ROOT, "src/seed/prowash-pages.json"), JSON.stringify(out, null, 2));
console.log(`\nWrote ${out.length} pages to src/seed/prowash-pages.json`);
