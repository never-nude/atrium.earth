# Acquisition and derivative handoff — 2026-09-19

Five initial shortlist models were recovered from the public, explicitly downloadable Sketchfab CC archive at https://mirror.traines.eu/sketchfab-backup/ (archive documentation: https://github.com/traines-source/sketchfab-backup). The archive's `<uid>.zip` files are official downloadable glTF exports, each with the matching original `license.txt`. This was scoped to five files; no protected viewer data or credentials were used.

`initial-five-ready.json` is the final handoff manifest: absolute preview/source paths, byte counts, face counts, SHA-256 hashes, license files, and detailed acquisition/processing reports. Source archives passed ZIP CRC checks. Previews parse as self-contained GLBs. Visual/orientation QA remains for the importing agent.

| Work | License in export | Preview bytes | Triangles |
|---|---|---:|---:|
| Aphrodite, CMA 1927.489 | CC0-1.0 | 1,301,968 | 69,282 |
| Eve Tempted, Mia | CC-BY-SA-4.0 | 2,947,148 | 250,000 |
| The Three Graces, Mia | CC-BY-SA-4.0 | 3,681,988 | 249,999 |
| Bacchante, Kraków | CC-BY-4.0 | 2,631,792 | 210,063 |
| Psyche, Rodin / avi scan | CC-BY-4.0 | 307,228 | 46,230 |

The GLBs use Draco geometry and WebP textures (maximum 2048 pixels). Mia's deprecated specular-glossiness materials were converted to metallic-roughness. Three Graces required precision-noise normalization for repeated normals (difference <=0.001 at identical position and UV), removal of unused duplicate UV1 and triangle-specific tangents, and welding before simplification. Larger normal differences were retained. This does not move positions before the explicitly recorded simplification pass. The original packed GLB and unsimplified preview remain available. See `repair-graces.mjs`, `weld-report.json`, and the per-model processing report. The 30.66 MB `preview-unsimplified.glb` is NOT the final preview; use `preview.glb` from the handoff manifest.

## South Asian shortlist 45–55: no usable exact model acquired

- IDs 45–50, Met: public collection pages returned HTTP 429. Scoped Sketchfab, title/accession, and public repository searches did not find verified matching downloadable models. A public index of 129 Met 3D models at https://raw.githubusercontent.com/InconsolableCellist/met_scans/master/object_ids.txt did not contain these six object IDs. This does not establish that no model exists elsewhere.
- IDs 51–54, Cleveland: official object pages explicitly report `sketchfab_id: null` and `sketchfab_url: null`. Scoped searches found no verified matching downloadable model.
- ID55, Ashmolean: object page has no model reference; scoped searches found no verified matching downloadable model.
- Search-result lookalikes (an Amaravati drum frieze and unidentified Surasundari scan) were not substituted for the named shortlist objects.

Evidence is retained in `south-asian-page-audit.json`, `object-51.html` through `object-55.html`, and the `sketchfab-search-*.json` results. IDs36–37 (Maillol River and Air) remain held for underlying-work rights review; no archive files for those were acquired per parent direction.
