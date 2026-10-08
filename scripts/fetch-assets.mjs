#!/usr/bin/env node
/**
 * fetch-assets.mjs
 * ----------------
 * One-time move off Webflow's CDN. Finds every image URL on
 * cdn.prod.website-files.com in the site's HTML and CSS, downloads it into
 * assets/images/, and rewrites the references to the local copy.
 *
 * Run it once, before you cancel your Webflow plan:
 *   npm run fetch-assets            download + rewrite
 *   npm run fetch-assets -- --dry   list what would change, touch nothing
 *
 * Safe to re-run: files already downloaded are skipped.
 * No dependencies. Node 18+ (uses the built-in fetch).
 */
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'assets/images');
const CDN = /https:\/\/cdn\.prod\.website-files\.com\/[^"')\s]+/g;
const DRY = process.argv.includes('--dry');
const SKIP = new Set(['node_modules', '.git', 'scripts', 'tokens']);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (/\.(html|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// "6a9aa1de…_cover%20art%2001.png" → "cover-art-01.png"
function cleanName(url) {
  let name = decodeURIComponent(url.split('/').pop().split('?')[0]);
  name = name.replace(/^[0-9a-f]{24}_/i, '').replace(/^[0-9a-f]{32}_/i, '');
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-').replace(/^-|-(?=\.)/g, '');
}

const exists = (p) => stat(p).then(() => true, () => false);

const files = await walk(ROOT);
const urls = new Set();
const contents = new Map();
for (const f of files) {
  const text = await readFile(f, 'utf8');
  contents.set(f, text);
  for (const m of text.match(CDN) ?? []) urls.add(m);
}

if (!urls.size) {
  console.log('✓ No Webflow CDN references left. Nothing to do.');
  process.exit(0);
}

// Assign unique local names
const map = new Map();
const used = new Set();
for (const url of [...urls].sort()) {
  let name = cleanName(url);
  if (used.has(name)) {
    const dot = name.lastIndexOf('.');
    let n = 2;
    while (used.has(`${name.slice(0, dot)}-${n}${name.slice(dot)}`)) n++;
    name = `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
  }
  used.add(name);
  map.set(url, name);
}

console.log(`Found ${urls.size} images in ${files.length} files.`);
if (DRY) {
  for (const [url, name] of map) console.log(`  ${name}  ←  ${url}`);
  process.exit(0);
}

await mkdir(IMG_DIR, { recursive: true });
let downloaded = 0, skipped = 0, failed = [];
const queue = [...map];
async function worker() {
  while (queue.length) {
    const [url, name] = queue.shift();
    const dest = join(IMG_DIR, name);
    if (await exists(dest)) { skipped++; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      downloaded++;
      process.stdout.write(`\r  downloaded ${downloaded}/${map.size - skipped}`);
    } catch (e) {
      failed.push(`${url} (${e.message})`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
process.stdout.write('\n');

const failedUrls = new Set(failed.map((f) => f.split(' ')[0]));
let rewritten = 0;
for (const [file, text] of contents) {
  const isRoot404 = relative(ROOT, file) === '404.html';
  const toImages = relative(dirname(file), IMG_DIR).split(sep).join('/');
  const next = text.replace(CDN, (url) => {
    if (failedUrls.has(url)) return url;
    return isRoot404 ? `/assets/images/${map.get(url)}` : `${toImages}/${map.get(url)}`;
  });
  if (next !== text) { await writeFile(file, next); rewritten++; }
}

await writeFile(join(IMG_DIR, 'manifest.json'), JSON.stringify(Object.fromEntries([...map].map(([u, n]) => [n, u])), null, 2) + '\n');

console.log(`✓ ${downloaded} downloaded, ${skipped} already present, ${rewritten} files rewritten.`);
if (failed.length) {
  console.log(`✗ ${failed.length} failed (left pointing at Webflow; re-run to retry):`);
  failed.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
