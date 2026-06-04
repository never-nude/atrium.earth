# ChatGPT Audit Prompt

Please audit this repo as a senior frontend, performance, accessibility, and security reviewer.

Repo path:

```txt
/Users/michael/Projects/_active/atrium-earth
```

Product goal:

```txt
Rebuild atrium.earth as a static-first digital sculpture museum. The public site must expose meaningful HTML without JavaScript, preserve the imported works and generated assets, use canonical /works/... routes, support faceted discovery, and avoid loading model assets until a visitor explicitly opens a 3D preview.
```

Start with:

```txt
AUDIT.md
README.md
src/lib/catalog.ts
src/lib/legacy.ts
src/pages/index.astro
src/pages/museum/index.astro
src/pages/works/[...slug].astro
src/components/FacetExplorer.astro
src/components/ModelPanel.astro
src/styles/global.css
scripts/generate-posters.mjs
scripts/generate-previews.py
scripts/import-catalog.mjs
```

Please focus on:

1. Whether object pages are complete and meaningful without JavaScript.
2. Whether model-viewer and GLB files stay lazy until explicit activation.
3. Whether catalog normalization avoids false claims and filters internal pipeline notes from public copy.
4. Whether the museum filter/timeline controls are keyboard usable, screen-reader understandable, and reflected in URL state.
5. Whether generated poster previews are correctly covered for all 175 works.
6. Whether redirects, sitemap, robots, canonicals, OG metadata, and migration map are coherent.
7. Whether build output, dependency footprint, and lazy chunking are reasonable.
8. Whether there are obvious code simplifications before this becomes the live atrium.earth rebuild.

Known verification:

```txt
npm run build: passes
npm audit --omit=dev: found 0 vulnerabilities
poster coverage: 175 catalog records, 0 missing posters
dist/_redirects: generated after build
```

Please report findings first, ordered by severity, with file and line references where possible. Then give a short recommended next-step list.
