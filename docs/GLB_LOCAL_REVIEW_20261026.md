# Local GLB quality review — 26 October 2026

Six existing works have higher-detail serving candidates staged locally. **These upgrades have not been uploaded to production or deployed.** The integration owner has reviewed all six actual local whole-figure renders in 1000 × 1250 screenshots. Fresh 720 × 900 WebP thumbnails and SVG posters have been generated. Native app checks loaded all six models at a 390 px mobile viewport without overflow, with readable 350 px records and source paths. Desktop David and Laocoön load, orbit and reset checks also passed. These scoped local checks precede the final rebuild.

Previous triangle counts were measured from the delivered GLBs. New counts match the selected files and their geometry proofs.

| Work / exact represented object | Previous triangles | Local candidate triangles | Source and reuse terms |
| --- | ---: | ---: | --- |
| Apollo Belvedere — SMK plaster cast KAS353 | 150,000 | 290,529 | SMK-published GLB; CC0 1.0 |
| Doryphoros — SMK plaster cast KAS11 | 149,998 | 275,182 | Official SMK GLB; Public Domain Mark 1.0 |
| Zeus or Poseidon from the Artemision — SMK plaster cast KAS2100 | 149,998 | 209,489 | SMK-published GLB; CC0 1.0 |
| Kore in Chiton and Epiblema — SMK plaster cast KAS1800 | 14,000 | 288,766 | SMK-published GLB; CC0 1.0 |
| Michelangelo’s David — original marble, Inv. Scult. n. 1076 | 400,000 | 1,199,948 | Same Scan the World / Wikimedia Commons STL; CC BY-SA 4.0 |
| Laocoön and His Sons — SMK historical straight-arm plaster cast KAS385 | 400,000 | 1,000,000 | Same SMK / Wikimedia Commons STL; Public Domain Mark 1.0 |

Apollo, Artemision and Kore use unchanged SMK source GLBs recovered from immutable historical Objaverse records. Their serving candidates use lossless Meshopt compression, preserving source vertex attributes, oriented triangles, hierarchy, transforms and material state. Doryphoros retains every supplied triangle with Draco 16-bit position/normal compression; that quantization is lossy. All four supplied GLBs contain no embedded images or textures: a GLB source does not imply a textured scan.

David and Laocoön are higher-detail conversions of the **same original STLs already used by Atrium**, not newly discovered scans. David retains all source Float32 triangle positions, uses exact-position indexing and newly generated smooth display normals, and compresses losslessly with Meshopt after changing triangle storage order. Laocoön uses an exact-position indexed reference with newly generated smooth display normals, followed by lossy Draco 16-bit position/normal compression. Neither candidate is decimated, geometrically repaired, textured or recolored. The selected reference/decoded files pass the existing numeric geometry gates; triangle count alone is not final visual approval.

The four museum GLBs represent named SMK plaster casts. Their labels now identify plaster, accession and holding collection, with ancient prototypes described separately. Acquisition years do not establish cast production dates; cast makers and manufacture places remain unconfirmed. Laocoön records SMK’s historical straight-arm restoration, distinct from the Vatican marble’s present bent-arm state.

Documented dimensions describe the exact museum objects. They do not establish verified scaling for these replacement assets. All four cast upgrades have verified-size eligibility disabled and offer explicitly approximate starting heights from their cast measurements: Apollo 2.32 m, Doryphoros 2.13 m, Artemision 2.01 m and Kore 2.05 m. Earlier original-object measurements remain recorded separately. David and Laocoön use adjustable 1 m display defaults while their old asset-specific calibrations remain unavailable.

All six unchanged originals, source/rights evidence and a portable recovery map are permanently private-archived with complete SHA-256 and byte-count readback verification. Every local original is retained. The data audit preserves all 2,394 catalog records, including Carpeaux, and the featured 250 / homepage 192 selections. All six posters embed their exact fresh WebP thumbnail. The final rebuild and any future publication remain separate steps.

Additions, featured-selection and asset checks pass. The global dimensions test encounters an existing missing-review failure for a Sol LeWitt record, also reproduced on the frozen baseline. The six upgrades pass scoped dimension and asset-version safety checks.

Source records: [Apollo / SMK](https://api.smk.dk/api/v1/art?object_number=KAS353&lang=en), [Doryphoros / SMK](https://api.smk.dk/api/v1/art?object_number=KAS11&lang=en), [Artemision / SMK](https://api.smk.dk/api/v1/art?object_number=KAS2100&lang=en), [Kore / SMK](https://api.smk.dk/api/v1/art?object_number=KAS1800&lang=en), [David / Commons](https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl), [Laocoön / Commons](https://commons.wikimedia.org/wiki/File:Ubekendt,_Laokoon_og_hans_to_s%C3%B8nner_dr%C3%A6bes_af_slanger,_,_KAS385,_Statens_Museum_for_Kunst,_3D_model.stl).

Reuse terms: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), [Public Domain Mark 1.0](https://creativecommons.org/publicdomain/mark/1.0/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
