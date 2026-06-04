# ChatGPT Material Fidelity Audit Prompt

Please audit Atrium4 as a sculpture-material fidelity reviewer and implementation spec writer. Your job is not just to critique the visuals. Your job is to research the real-life counterpart for every work, compare it against the current generated thumbnail and activated 3D viewer, and return precise adjustment instructions for texture, color, roughness, exposure, lighting, and background treatment.

Date of this prompt: June 3, 2026.

Repo path:

```txt
/Users/mike/Documents/New project 2/atrium5
```

Live site:

```txt
https://never-nude.github.io/atrium5/
```

Product goal:

```txt
Atrium4 is a static-first digital sculpture museum. Each work should remain readable against the navy museum background while looking materially plausible: marble should read as marble, plaster as plaster, limestone and weathered stone as stone, carved wood as wood, bronze as aged bronze with believable patina, silver as tarnished silver, ceramic/terracotta/clay as fired earth material, and ambiguous records should be flagged instead of guessed.
```

Current known state:

```txt
- Astro static site, built with npm run build.
- 174 catalog works.
- 174 generated GLB previews at public/models/previews/<slug>/preview.glb.
- 174 generated thumbnails at public/previews/renders/<slug>/thumb.webp.
- Current build target for GitHub Pages uses:
  BASE_PATH=/atrium5/ SITE=https://never-nude.github.io/atrium5 npm run build
- Current render command supports targeted rerenders:
  ONLY=slug-a,collection/slug-b npm run images:renders
```

Start with these files:

```txt
src/data/catalog.json
src/data/material-appearances.json
src/data/orientations.json
src/data/renders.json
src/lib/catalog.ts
src/components/Viewer.astro
public/__render.html
scripts/render-thumbnails.mjs
src/pages/works/[...slug].astro
src/pages/materials/index.astro
src/pages/index.astro
```

Current material system:

```txt
src/data/material-appearances.json defines reusable profiles:
- plaster
- marble
- limestone
- stone
- bronze-patina
- wood
- silver
- ceramic
- neutral

Each profile can control:
- baseColor: hex
- secondaryColor: hex
- tintStrength: 0..1
- variation: 0..1
- metalness: 0..1
- roughness: 0..1
- textureDefault: 0..100, where higher means shinier in the UI
- exposure: renderer tone-mapping exposure, usually 0.05..1.2
- envMapIntensity
- emissiveIntensity
- mapLift
- mapFloor
- backdropTop
- backdropBase
- backdropGlow
- backdropGlowStrength
- keyLightIntensity
- fillLightIntensity
- rimLightIntensity
- hemiLightIntensity

Material classification currently happens through materialToProfile, collectionDefaults, and slugOverrides.
If per-work appearance overrides are needed beyond material label overrides, propose a minimal JSON shape and the exact code locations that would consume it.
```

Important recent visual feedback to account for:

```txt
- Stone and limestone thumbnails were too dark against the navy background.
- Wood pieces were also too dark, including /works/americas/headdress-effigy-hareiga/.
- Bronzes first read too green, then too black. The desired direction is real aged bronze: bronze/brown base, dark blue-green or black-green patina in recesses, and enough highlight response to show form.
- Do not solve dark objects only by overexposure if a better shared background or lighting strategy would make both light and dark pieces read evenly.
- Preserve existing GLB geometry, texture maps, and material maps wherever possible. Do not recommend STL conversion or any workflow that drops materials/textures.
```

Research requirements:

1. Audit every work in `src/data/catalog.json`, not a sample.
2. Use each record's `source_url` as the first research lead. Then use source museum records, public collection pages, reputable museum photos, and scholarly/collection metadata where available.
3. For records based on casts, distinguish the material of the scanned cast from the material of the original referent. Recommend a visual target and explain it. If the choice is curatorial rather than factual, mark it `needs-curator-call`.
4. Do not infer material solely from title, collection, or current site profile when better source metadata exists.
5. Cite at least one source URL per work when you make a material-specific recommendation. If no reliable source is found, say so and use a low-confidence archetype.
6. Compare both:
   - the generated thumbnail at `/previews/renders/<slug>/thumb.webp`
   - the activated 3D viewer on `/works/<slug>/`
7. Check material landing sections where relevant:
   - `/materials/#bronze`
   - `/materials/#wood`
   - `/materials/#stone`
   - `/materials/#limestone`
   - `/materials/#marble`
   - `/materials/#plaster`
8. Include particular attention to these routes:
   - `/works/rodin/the-thinker/`
   - `/works/donatello/david/`
   - `/works/americas/headdress-effigy-hareiga/`
   - `/works/michelangelo/david/`

Visual judgment rules:

```txt
- Prefer realism, but preserve legibility on the Atrium navy background.
- For bronze, avoid a flat green coating. Use brown/bronze metal as the dominant read, with blue-green/black-green patina as variation, crevice tone, or secondary color.
- For dark wood, preserve a carved-wood brown read and visible grain/form. Avoid turning it orange or plastic.
- For marble, avoid chalky flat white. Use warm off-white, subtle gray/cream variation, lower roughness than plaster, and controlled highlight response.
- For plaster casts, keep them matte and warmer/chalkier than marble.
- For limestone/weathered stone, keep a porous, buff/gray/tan read with stronger fill/rim light if needed.
- For silver, keep metallic response with tarnish; avoid chrome.
- For ceramic/terracotta/clay, keep fired-earth color variation and moderate roughness.
- If all dark pieces struggle, evaluate global stage backgrounds and lighting before recommending extreme per-material exposure values.
```

Please produce this output, in this order:

## 1. Executive Summary

Give the top 5 to 10 material fidelity problems, ordered by impact. Be specific about whether the problem is a wrong material target, bad color, bad roughness/metalness, exposure/lighting, thumbnail-only rendering, live-viewer-only rendering, or background contrast.

## 2. Global Recommendations

Return a table with one row per global fix:

```txt
scope | affected slugs/materials | problem | exact change | expected visual result | risk | priority
```

Examples of acceptable exact changes:

```txt
bronze-patina.baseColor: #7b6140 -> #80623d
bronze-patina.secondaryColor: #4f765d -> #425d56
bronze-patina.tintStrength: 0.56 -> 0.48
bronze-patina.roughness: 0.48 -> 0.42
bronze-patina.exposure: 0.72 -> 0.68
bronze-patina.backdropGlow: #c99355 -> #b9824c
```

Do not write vague instructions like "make it a little brighter." Use exact numeric values and hex colors.

## 3. Per-Work Audit Matrix

Return one row for every catalog work. Use this exact column set:

```txt
slug
title
route
current catalog material
current appearance profile
real material target
source URL(s)
thumbnail diagnosis
object viewer diagnosis
recommended action
exact values or override
rerender thumbnail? yes/no
confidence high/medium/low
priority P0/P1/P2/P3
```

Use `recommended action` values like:

```txt
leave-as-is
profile-change
slug-material-override
slug-appearance-override
background-or-lighting-change
needs-curator-call
needs-source-research
```

For `exact values or override`, provide a concise JSON-style snippet when possible:

```json
{
  "slug": "rodin/the-thinker",
  "profile": "bronze-patina",
  "baseColor": "#73583a",
  "secondaryColor": "#3f5f56",
  "roughness": 0.44,
  "metalness": 0.62,
  "exposure": 0.7,
  "textureDefault": 58
}
```

## 4. Profile JSON Patch

Provide a consolidated proposed patch for `src/data/material-appearances.json`. Include only changes you recommend after looking across the full collection.

Separate it into:

```txt
profile changes
materialToProfile changes
collectionDefaults changes
slugOverrides changes
proposed slugAppearanceOverrides, if needed
```

If you propose a new `slugAppearanceOverrides` map, include the exact TypeScript/JavaScript changes required in:

```txt
src/lib/catalog.ts
src/components/Viewer.astro
public/__render.html
scripts/render-thumbnails.mjs
```

Keep the implementation minimal. Do not introduce a new dependency.

## 5. Thumbnail Rerender Plan

List the smallest safe rerender batches. Use comma-separated slug lists compatible with:

```bash
ONLY=slug-a,collection/slug-b npm run images:renders
```

Then provide the final build command:

```bash
BASE_PATH=/atrium5/ SITE=https://never-nude.github.io/atrium5 npm run build
```

## 6. Visual QA Checklist

Provide exact URLs and checks for the implementer to run after applying your recommendations.

Include at minimum:

```txt
https://never-nude.github.io/atrium5/
https://never-nude.github.io/atrium5/materials/#bronze
https://never-nude.github.io/atrium5/materials/#wood
https://never-nude.github.io/atrium5/materials/#stone
https://never-nude.github.io/atrium5/materials/#limestone
https://never-nude.github.io/atrium5/works/rodin/the-thinker/
https://never-nude.github.io/atrium5/works/donatello/david/
https://never-nude.github.io/atrium5/works/americas/headdress-effigy-hareiga/
https://never-nude.github.io/atrium5/works/michelangelo/david/
```

For object pages, verify:

```txt
- thumbnail/poster is readable before interaction
- 3D viewer loads
- orbit works
- Exposure slider starts at the recommended default
- Texture slider starts at the recommended default
- Light slider still reveals form
- Wireframe and Reset still work
- no CSS, thumb.webp, or preview.glb 404s
```

## 7. Open Curatorial Questions

List every case where the material target is ambiguous, especially cast-versus-original cases. For each, explain what decision is needed and what visual result follows from each choice.

Constraints:

```txt
- Do not merge, push, or deploy anything.
- Do not recommend converting GLB assets to STL.
- Do not recommend dropping texture maps or material maps.
- Prefer precise, implementable instructions over broad critique.
- If you cannot inspect all 174 works in one response, create a multi-pass plan and complete the highest-risk materials first: bronze, wood, stone, limestone, marble/plaster, ceramic/silver/neutral.
```
