# Atrium.Earth

A static-first digital sculpture museum rebuilt around the existing Atrium corpus.

The public site now uses Astro to generate real HTML for the homepage, museum hub,
timeline, facet pages, and canonical work records. The imported works, generated
poster previews, rendered WebP thumbnails, and optimized GLB previews are preserved;
the old mixed public route taxonomy is replaced by canonical `/works/...` routes
plus legacy redirects.

## Development

```sh
npm install
npm run import:catalog
npm run images:posters
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run models:preview -- --limit 12
npm run dev
```

The old Atrium checkout is treated as source material. By default the scripts read from:

```txt
/Users/michael/Projects/_active/atrium
```

Set `SOURCE_ATRIUM_DIR` to point somewhere else.

## Architecture

- `src/lib/catalog.ts` normalizes the imported catalog into one object schema.
- `src/pages/works/[...slug].astro` generates canonical object pages.
- `src/components/FacetExplorer.astro` adds search, facets, timeline filtering, and URL state to the static museum grid.
- `src/components/ModelPanel.astro` and `src/components/Viewer.astro` render the three.js object viewer.
- `src/lib/legacy.ts` defines migration redirects for old domains, maker routes, collection routes, and old object URLs.

## Data And Assets

- `src/data/catalog.json` is generated from the old catalog.
- `public/previews/posters/**/poster.svg` contains generated lightweight poster previews.
- `public/previews/renders/**/thumb.webp` contains rendered object thumbnails for grid cards.
- `public/models/previews/**/preview.glb` contains lightweight web previews.
- `src/data/previews.json` maps catalog slugs to generated preview files.
- `src/data/renders.json` lists works with rendered thumbnails.
- The browser never receives raw STL source files.

## Routes

- `/`
- `/museum/`
- `/timeline/`
- `/geography/`
- `/materials/`
- `/movements/`
- `/makers/`
- `/exhibitions/`
- `/about/`
- `/works/[...slug]/`
- `/migration-map.json`
- `/sitemap.xml`
- `/robots.txt`

Build output also writes `dist/_redirects` for hosts that understand Netlify-style
redirect files. Static legacy pages are generated as a fallback for old object URLs.

## Performance Strategy

Astro renders pages as static HTML. The museum filter script is small and only
enhances the already-rendered grid. The three.js viewer has a still-image
fallback and loads the web-detail GLB preview on object pages.

## Audit

- `AUDIT.md` summarizes the rebuild, verification status, assets, and review focus.
- `CHATGPT_AUDIT_PROMPT.md` is a copy-paste prompt for a ChatGPT audit pass.
- `COLLECTION-GROWTH.md` tracks the next open 3D source harvest, licensing policy, and acquisition order.
