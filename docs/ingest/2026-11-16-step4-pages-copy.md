# Stage 1 Pages copy receipt

GitHub Actions run [43927607185](https://github.com/never-nude/atrium.earth/actions/runs/43927607185) copied verified files from Pages commit `56d6529c`. The [original receipt](2026-11-16-step4-pages-copy-receipt.json) records 3,568 verified objects and 471,962,600 bytes. First attempts succeeded for 3,561 objects. Six GET requests failed and one read ended early. All seven passed on the second attempt and then passed an independent full readback.

To refresh a single changed JPEG after separately authorizing the upload, use the configured R2 credentials and run the following from the repository root.

```sh
npm run images:jpeg && node scripts/copy-pages-assets-to-r2.mjs --refresh-jpeg <artwork-slug>
```

Replace `<artwork-slug>` with the existing catalog slug, including any category prefix. The command uses the generated JPEG, writes its new immutable hash-named key, verifies the public readback once, and updates `src/data/pages-cdn-assets.json` when it passes. Save the printed receipt with the manifest change. A failed readback leaves the current manifest binding in place. Model refreshes also require updating the serving and scale bindings for the new asset.
