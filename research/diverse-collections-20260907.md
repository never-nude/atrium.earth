# Diverse collection additions — 7 September 2026

28 works approved for publication after local review: 11 African, 11 from the Americas, 5 Asian, and 1 Māori pendant. Source records, per-object licenses, archive URLs, source/preview SHA-256 hashes, and orientation notes are in `diverse-collections-20260907.json`.

Preview: http://127.0.0.1:4327/preview/diverse-collections/

Run from this worktree with `npm run dev -- --host 127.0.0.1 --port 4327` if the server is stopped. The review page uses the current live-site components, shows just this batch, and is excluded from production builds.

All 28 model orientations were compared with publisher reference images and rendered in Atrium; every object page also reached live WebGL state without a page error. The collection filter and a 390 px mobile view passed checks. Production build, local/remote asset configuration verification, and wing fixtures passed.

NCMA Standing Male and Walu mask required legacy material conversion. The Chimú sculpture's emissive-only texture was adapted for museum lighting. The Michigan Moche scan has no surface texture; its neutral gray display is a study material. No original surface color was invented. Missing source dates, makers, accessions, and materials were left unspecified.

All 28 reviewed GLBs are uploaded to `models.atrium.earth` under content-hashed filenames. Every public file was downloaded and matched against its reviewed SHA-256 hash; content type and browser CORS were verified. The catalog references these verified URLs. GitHub Pages serves the pages, thumbnails and posters; the build excludes local mirrors of R2 models.

Local model mirrors remain in `public/models/previews/` (ignored by the repository). Source downloads, reference images and visual checks remain in `.tmp/`; archive URLs and hashes are preserved in the JSON manifest. The development-only review page remains available using the command above.

Publication checks: all 28 production pages reached live WebGL state using the public R2 files, decoded their posters, and retained the reviewed orientations. The local build was served at the Atrium page origin in the test browser to exercise production CORS without changing model responses. All 28 works appear in the collection. The 1,903-page production build excludes GLB mirrors and the review route; asset configuration and all wing fixtures passed. Development mode prefers available local GLB mirrors so the local review continues to work after upload.
