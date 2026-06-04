# Atrium.Earth Rebuild Audit Brief

Prepared: 2026-04-29

## Context

This repo is now an Astro static rebuild of `atrium.earth`. The old Atrium checkout
at `/Users/michael/Projects/_active/atrium` remains source material for catalog and
asset generation.

The product direction is a museum-grade sculpture site: canonical object pages,
facet browsing, timeline structure, source-aware copy, still-image fallbacks, and
3D as optional study media.

## Runbook

```sh
npm install
npm run import:catalog
npm run images:posters
npm run build
npm run dev
```

Optional model preview generation:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run models:preview -- --limit 12
```

## Current Asset Strategy

- `src/data/catalog.json` contains 175 imported catalog records.
- `src/lib/catalog.ts` normalizes those records into the public work schema.
- `public/previews/posters/**/poster.svg` contains 175 lightweight poster previews.
- `public/models/previews/**/preview.glb` contains 12 lightweight web previews.
- `src/data/previews.json` maps slugs to available preview files.
- Raw STL paths are preserved as pipeline metadata, not served in the browser UI.

## Public Routes

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

Legacy object routes are generated as static redirect pages. The build also writes
`dist/_redirects` from `src/lib/legacy.ts`.

## Review Focus

1. Confirm object pages remain meaningful without JavaScript.
2. Confirm `/museum/` exposes the collection as HTML before filters run.
3. Confirm model-viewer is imported only after the visitor activates a preview.
4. Check that source-data gaps are named plainly and technical pipeline notes do not leak into public copy.
5. Check keyboard focus, range controls, select filters, reduced-motion handling, and mobile reflow.
6. Confirm `sitemap.xml`, `robots.txt`, `_redirects`, and `migration-map.json` are present in `dist`.
7. Review poster crops and long date labels on narrow cards.

## Known Caveats

- Poster previews are generated SVG study posters, not true renders from every model.
- Only 12 works currently have low-poly GLB preview assets.
- Many source records are missing maker, material, dimensions, accession, and rights details.
- Some geography and material facets are conservative inferences from titles and existing collection folders.

## Verification Already Run

```sh
npm run build
```

Current build:

```txt
376 static pages
175 canonical work pages
195 redirect rules written to dist/_redirects
```

The model-viewer browser package is emitted as a lazy chunk. Initial static pages
load the shared CSS and, where needed, small enhancement scripts only.
