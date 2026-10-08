#!/usr/bin/env node
/**
 * build-tokens.mjs
 * ----------------
 * Turns the JSON theme files in /tokens into:
 *   assets/css/tokens.css   CSS custom properties (the only file the site's CSS reads values from)
 *   assets/js/tokens.js     The same tokens as data, used by the /design-system page
 *
 * Token files use the W3C Design Tokens (DTCG) format:
 *   { "$type": "color", "$value": "#f25644" }          a raw value
 *   { "$value": "{color.coral.500}" }                   an alias to another token
 *   "$type" is inherited from the nearest parent group.
 *
 * File roles:
 *   tokens/base.json          tier 1, core values. Always emitted on :root.
 *   tokens/themes/*.json      tier 2 + 3, semantic and component tokens. Each theme declares
 *                             $extensions.cbj.selector (":root" for the default theme,
 *                             '[data-theme="name"]' for alternates).
 *
 * CSS variable names are the token path joined with "-". Tokens under "component" drop that
 * prefix, so component.button.bg becomes --button-bg.
 *
 * Usage:
 *   node scripts/build-tokens.mjs           build once
 *   node scripts/build-tokens.mjs --watch   rebuild whenever a token file changes
 *   node scripts/build-tokens.mjs --check   validate only, write nothing (useful in CI)
 *
 * No dependencies. Node 18+.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { watch } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = join(ROOT, 'tokens');
const THEMES_DIR = join(TOKENS_DIR, 'themes');
const OUT_CSS = join(ROOT, 'assets/css/tokens.css');
const OUT_JS = join(ROOT, 'assets/js/tokens.js');

const args = new Set(process.argv.slice(2));
const ALIAS = /^\{([^}]+)\}$/;

/* ---------- read + flatten ---------- */

function flatten(node, path, inheritedType, source, out) {
  const type = node.$type ?? inheritedType;
  if (Object.prototype.hasOwnProperty.call(node, '$value')) {
    if (!type) throw new Error(`${source}: token "${path.join('.')}" has no $type (set it on the token or a parent group)`);
    out.push({
      path: path.join('.'),
      type,
      value: node.$value,
      description: node.$description ?? '',
      source,
    });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (child === null || typeof child !== 'object' || Array.isArray(child)) {
      throw new Error(`${source}: "${[...path, key].join('.')}" must be a group or a token with $value`);
    }
    flatten(child, [...path, key], type, source, out);
  }
}

async function loadFile(file) {
  const raw = await readFile(file, 'utf8');
  let json;
  try { json = JSON.parse(raw); }
  catch (e) { throw new Error(`${relative(ROOT, file)} is not valid JSON: ${e.message}`); }
  const tokens = [];
  flatten(json, [], undefined, relative(ROOT, file), tokens);
  return { json, tokens };
}

/* ---------- formatting ---------- */

const cssName = (path) => '--' + path.replace(/^component\./, '').replace(/\./g, '-');

function formatRaw(type, value, path) {
  switch (type) {
    case 'fontFamily':
      return (Array.isArray(value) ? value : [value])
        .map((f) => (/[\s]/.test(f) && !/^(ui-|system-)/.test(f) ? `"${f}"` : f))
        .join(', ');
    case 'cubicBezier':
      if (!Array.isArray(value) || value.length !== 4) throw new Error(`${path}: cubicBezier needs 4 numbers`);
      return `cubic-bezier(${value.join(', ')})`;
    case 'color':
      if (typeof value !== 'string' || !/^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(|hsla?\(|oklch\()/i.test(value)) {
        throw new Error(`${path}: "${value}" is not a color`);
      }
      return value;
    default:
      return String(value);
  }
}

/* ---------- resolve ---------- */

function buildIndex(allTokens) {
  const index = new Map();
  for (const t of allTokens) {
    if (index.has(t.path) && index.get(t.path).source !== t.source) {
      // Same path in two themes is expected (that's what a theme override is). Keep the first for lookups.
      continue;
    }
    index.set(t.path, t);
  }
  return index;
}

function resolve(token, index, seen = []) {
  const m = typeof token.value === 'string' && token.value.match(ALIAS);
  if (!m) return formatRaw(token.type, token.value, token.path);
  const target = index.get(m[1]);
  if (!target) throw new Error(`${token.source}: "${token.path}" points to {${m[1]}}, which does not exist`);
  if (seen.includes(target.path)) throw new Error(`Alias loop: ${[...seen, token.path, target.path].join(' → ')}`);
  return resolve(target, index, [...seen, token.path]);
}

function cssValue(token) {
  const m = typeof token.value === 'string' && token.value.match(ALIAS);
  return m ? `var(${cssName(m[1])})` : formatRaw(token.type, token.value, token.path);
}

/* ---------- build ---------- */

async function build() {
  const base = await loadFile(join(TOKENS_DIR, 'base.json'));
  const themeFiles = (await readdir(THEMES_DIR)).filter((f) => f.endsWith('.json')).sort();
  if (!themeFiles.length) throw new Error('tokens/themes has no .json files');

  const themes = [];
  for (const f of themeFiles) {
    const { json, tokens } = await loadFile(join(THEMES_DIR, f));
    const meta = json.$extensions?.cbj ?? {};
    if (!meta.selector) throw new Error(`tokens/themes/${f}: add $extensions.cbj.selector (":root" or '[data-theme="..."]')`);
    themes.push({ file: f, id: f.replace(/\.json$/, ''), name: meta.name ?? f, selector: meta.selector, colorScheme: meta.colorScheme, isDefault: !!meta.default, tokens });
  }
  themes.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  if (!themes[0].isDefault) throw new Error('One theme must set $extensions.cbj.default: true');

  // Lookups resolve against base + the default theme. Alternate themes override by path.
  const defaultIndex = buildIndex([...base.tokens, ...themes[0].tokens]);
  const seenNames = new Map();
  for (const t of [...base.tokens, ...themes[0].tokens]) {
    const n = cssName(t.path);
    if (seenNames.has(n) && seenNames.get(n) !== t.path) throw new Error(`Two tokens map to ${n}: ${seenNames.get(n)} and ${t.path}`);
    seenNames.set(n, t.path);
  }

  const banner = `/* Generated by scripts/build-tokens.mjs from /tokens. Do not edit by hand. */\n`;
  const block = (selector, tokens, extra = '') =>
    `${selector} {\n${extra}${tokens.map((t) => `  ${cssName(t.path)}: ${cssValue(t)};`).join('\n')}\n}\n`;

  let css = banner + '\n/* Tier 1: core (tokens/base.json) */\n' + block(':root', base.tokens);
  const data = { generated: new Date().toISOString(), themes: [] };

  for (const theme of themes) {
    const index = theme.isDefault ? defaultIndex : buildIndex([...theme.tokens, ...base.tokens, ...themes[0].tokens]);
    const rows = [...(theme.isDefault ? base.tokens : []), ...theme.tokens].map((t) => ({
      path: t.path,
      cssVar: cssName(t.path),
      type: t.type,
      tier: t.source.endsWith('base.json') ? 'core' : t.path.startsWith('component.') ? 'component' : 'semantic',
      alias: typeof t.value === 'string' && ALIAS.test(t.value) ? t.value.slice(1, -1) : null,
      value: resolve(t, index),
      description: t.description,
    }));
    const scheme = theme.colorScheme ? `  color-scheme: ${theme.colorScheme};\n` : '';
    css += `\n/* Tiers 2-3: ${theme.name} (tokens/themes/${theme.file}) */\n` + block(theme.selector, theme.tokens, scheme);
    data.themes.push({ id: theme.id, name: theme.name, selector: theme.selector, default: theme.isDefault, tokens: rows });
  }

  const count = base.tokens.length + themes.reduce((n, t) => n + t.tokens.length, 0);
  if (args.has('--check')) {
    console.log(`✓ ${count} tokens valid across base + ${themes.length} theme(s)`);
    return;
  }
  await mkdir(dirname(OUT_CSS), { recursive: true });
  await mkdir(dirname(OUT_JS), { recursive: true });
  await writeFile(OUT_CSS, css);
  await writeFile(OUT_JS, banner + `window.CBJ_TOKENS = ${JSON.stringify(data, null, 2)};\n`);
  console.log(`✓ ${count} tokens → ${relative(ROOT, OUT_CSS)}, ${relative(ROOT, OUT_JS)}`);
}

async function run() {
  try { await build(); }
  catch (e) {
    console.error(`✗ ${e.message}`);
    if (!args.has('--watch')) process.exit(1);
  }
}

await run();

if (args.has('--watch')) {
  console.log('Watching /tokens for changes…');
  let timer;
  watch(TOKENS_DIR, { recursive: true }, (_, file) => {
    if (!file || !file.endsWith('.json')) return;
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  });
}
