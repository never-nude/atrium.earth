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
- Every `thumb.webp` has a same-size `thumb.jpg` sibling encoded at JPEG quality 82. `npm run images:jpeg` refreshes them, and the build runs this step before Astro copies public assets.
- `public/models/previews/**/preview.glb` contains lightweight web previews.
- `src/data/previews.json` maps catalog slugs to generated preview files.
- `src/data/renders.json` lists works with rendered thumbnails.
- The browser never receives raw STL source files.

Source archives and local cleanup follow the [verified Drive archive workflow](docs/storage-archive-workflow.md).
`npm run storage -- help` lists the inventory, dry-run and cleanup commands;
`npm run test:storage` checks the destructive-operation safeguards. Drive backups
preserve originals and provenance; Cloudflare continues serving optimized previews.

## Routes

- `/`
- `/museum/`
- `/spatial-museum/`
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

The Collection and AR / VR entrances render60 cards, then search a shared public
metadata index and fetch card details in120-work chunks. Index and chunk payloads
share a content revision so stale responses cannot mix collection editions.
Lean static pagination keeps every work reachable without JavaScript. Viewers
draw on demand and suspend offscreen; guided visits connect one stop at a time.

`npm run test:experience` checks browsing, maker groups, journey continuity,
prepared curatorial evidence and viewer lifecycle. After a build,
`node scripts/check-collection-window.mjs --dist` verifies all delivered records,
chunk coherence and bounded pagination. The review workflow builds a complete
package and checks the existing hosting budget without deploying it.

The [prepared guided-visit contract](docs/curated-visits.md) records the first
six-work AI-authored edition. Automatic AI generation is currently off; the
homepage programme continues its existing scheduled selection rules.

## Audit

- `AUDIT.md` summarizes the rebuild, verification status, assets, and review focus.
- `CHATGPT_AUDIT_PROMPT.md` is a copy-paste prompt for a ChatGPT audit pass.
- `COLLECTION-GROWTH.md` tracks the next open 3D source harvest, licensing policy, and acquisition order.

## License

Atrium.Earth's original website source code is licensed under the [MIT License](LICENSE).

The museum collection is not covered by the MIT License. Third-party 3D scans,
models, images, thumbnails derived from those assets, catalog metadata, and other
collection materials remain subject to the rights and licenses stated in their
source records. No additional rights to those materials are granted by this repository.
