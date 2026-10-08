# createdbyjerry.com

Portfolio and shop for Created by Jerry, rebuilt from Webflow as a plain static site: HTML, one stylesheet, and a little JavaScript. No framework, no bundler. Design decisions live in JSON theme files that compile to CSS variables.

## Quick start

Requires [Node 18+](https://nodejs.org).

```bash
npm run fetch-assets   # once: download all images off Webflow's CDN into assets/images/
npm run tokens         # rebuild CSS variables from tokens/*.json
npm run serve          # preview at http://localhost:3000
```

`npm run dev` rebuilds tokens on every save and serves the site at the same time.

> **Run `fetch-assets` before you cancel Webflow.** Until then, images still load from Webflow's CDN, which is why the site works right away. The script downloads all 113 images, gives them readable names (`cover-art-01.png` instead of `6a9aa1de…_cover%20art%2001.png`), and rewrites every reference. It is safe to re-run.

## Structure

```
├── index.html                      Home
├── work/  prototypes/  arcade/  shop/  about-jerry/  ai-disclosure-statement/
├── projects/<slug>/index.html      Six case studies (same URLs as the Webflow site)
├── design-system/index.html        Unlisted reference page (see below)
├── 404.html
├── tokens/
│   ├── base.json                   Tier 1: core values (palette, scale, fonts)
│   └── themes/
│       └── perigee.json            Tiers 2-3: semantic + component tokens for the default theme
├── scripts/
│   ├── build-tokens.mjs            tokens/*.json → assets/css/tokens.css + assets/js/tokens.js
│   └── fetch-assets.mjs            Webflow CDN → assets/images/
├── assets/
│   ├── css/
│   │   ├── tokens.css              GENERATED. Don't edit.
│   │   ├── main.css                All site styles. Reads only token variables.
│   │   └── design-system.css       Extra styles for the design system page
│   ├── js/
│   │   ├── site.js                 Mobile nav, hero cursor readout, footer year
│   │   ├── orb.js                  The Three.js eclipse orb (colors come from the theme)
│   │   ├── tokens.js               GENERATED. Token data for the design system page.
│   │   └── design-system.js
│   └── images/                     Filled by `npm run fetch-assets`
└── .github/workflows/tokens.yml    Fails a push if tokens are invalid or tokens.css is stale
```

## Working with themes

Tokens use the [W3C Design Tokens format](https://tr.designtokens.org/format/): every token has a `$value`, a `$type` (inherited from its group), and an optional `$description`. Aliases point at other tokens with `{group.path}`.

```
tokens/base.json            color.coral.500        = #f25644          ← raw value
tokens/themes/perigee.json  accent.primary         = {color.coral.500}  ← meaning
                            component.button.bg    = {accent.primary}   ← one component
                                     ↓ npm run tokens
assets/css/tokens.css       --button-bg: var(--accent-primary);
```

Rules of thumb:

- **CSS only reads semantic or component variables** (`--text-secondary`, `--card-border`). Never `--color-neutral-400` and never a hex code. If you need a new value, add a token first.
- **Change a brand color** in `base.json`; everything aliased to it updates.
- **Restyle one component** by repointing its `component.*` tokens in the theme file.
- Run `npm run tokens:check` to validate without writing. Broken aliases, loops, missing types, and malformed colors fail with a message pointing at the file and token.

### Adding a second theme

1. Copy `tokens/themes/perigee.json` to `tokens/themes/<name>.json`.
2. In its `$extensions.cbj`, set `"selector": "[data-theme=\"<name>\"]"`, `"default": false`, and a `name`.
3. Delete everything you don't want to change, and repoint the aliases you do. Add any new raw colors to `base.json` first.
4. `npm run tokens`, then test it by adding `data-theme="<name>"` to `<html>`.

## The design system page

`/design-system/` documents the theme and every component with live specimens and copy-ready markup. Its color, type, spacing, and component-token tables are rendered from `assets/js/tokens.js`, so they update whenever you run `npm run tokens`.

It is deliberately unlisted: no link in the nav, footer, or anywhere else, and it carries `noindex, nofollow`. Anyone with the URL can still open it.

## Deploying to GitHub Pages

1. Push this folder to your repo's `main` branch.
2. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. The site will be live at `https://<username>.github.io/<repo>/` within a minute or two. All internal links are relative, so it works under that sub-path.
4. **Custom domain:** in the same Pages settings, enter `www.createdbyjerry.com` (this adds a `CNAME` file). Then at your domain registrar, point DNS away from Webflow:
   - `www` → CNAME → `<username>.github.io`
   - apex `createdbyjerry.com` → A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Tick **Enforce HTTPS** once the certificate is issued.

   `404.html` uses root-absolute paths, so it renders fully on the custom domain; on the `github.io/<repo>/` preview URL it will show without styles.

Keep Webflow running until the GitHub version is live on your domain and you have run `fetch-assets`.

## What changed from the Webflow build

**Design tokens**
- Two competing variable sets (an older "created-by-jerry" set full of `<deleted>` variables, and the newer "perigee" set) merged into one 3-tier system. Unused sets from old projects (Sandstorm, Spaceship Manual) removed.
- Near-duplicate values collapsed: two corals (`#f4553d` / `#f25644`) → one; two page blacks (`#08080a` / `#0a0b0d`) → one; five radii (2, 3, 4, 5, 6px) → three (3, 6, 10px) plus pill and circle.
- Faint text raised from `#60605f` to `#858582`. The old value measured about 3:1 on the page background; the new one passes WCAG AA at 4.5:1+.
- The orb shader's colors now come from `orb.*` theme tokens instead of hard-coded hex values.

**Typography**
- Google Fonts request cut from 21 families (~100 KB of CSS before any font files) to the 3 actually used: Michroma, Oxygen, Space Mono. Orbitron, Montserrat, Antonio, and Inter usages replaced.
- Michroma only ships one weight, so the faux-bold card titles now use regular weight.
- Headings are real `h1`–`h3` elements in order (most were `div`s before), one `h1` per page.

**Layout & components**
- Case-study pages now use the same panels, borders, and type scale as the rest of the site instead of the older portfolio styles (24px-radius images, Orbitron headers, different background).
- Section headers are consistent: numbered mono label (`01 / The Problem`) + heading, with emoji removed. Role/company/year chips became one meta strip.
- Grid classes renamed to say what they do (`grid--3/4/5`; the old `._4` modifier actually made 5 columns).
- Material Icons font dropped for two inline SVGs.
- Cards with one destination are clickable across the whole card.
- Every section had `id="process"`; ids are now unique.
- Reduced-motion users get a static orb and no hover lifts.

**Content fixes**
- Typos: "View WOrk", "See PRotoypes", "Protoype", "obtian", "Storyingtelling", "Goverance", "The Susmmary", "thier", "Oppurtunities", "~60%within", "TIght", "smooth-smoothing".
- Button labels standardized to sentence case ("Design system", "GitHub").
- The inconsistent "The Summary:" prefix removed from case-study intros.
- Removed a stray "This is some text inside of a div block." from the Prototypes page.
- Removed a duplicated "The Deployment Cadence" card and a repeated "Why it mattered" block (Hijinks), and a stray duplicate "The Hard Lesson" label (Nube).
- Retrospective sections all titled "Lessons & Next Steps".
- Footer sitemap now includes Arcade. Email links are plain `mailto:` (Cloudflare's obfuscation was Webflow-specific).
- Added page descriptions, social meta tags, and alt text.

**Content worth a second look** (kept as-is)
- *Geospatial Vectors → Constraints → "Why it mattered"* reuses the Designing Orbits paragraph about physics ("too simple, it was a toy…").
- *Arcade* contact copy is new, since the original page had no contact section. Edit or remove it.
