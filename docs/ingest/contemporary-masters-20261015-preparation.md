# Contemporary masters acquisition preparation — 2026-10-15

The saved manifest plans 24 distinct works: 18 modern discoveries, Stella’s *Maha-lat, 5.5x*, one explicitly partial Ai Weiwei Dog component, and four additional Miró works. This is preparation, not an acquired or published batch. The selected GLB archives total 1,046,244,188 bytes before any decoded companions.

The manifest uses batch ID `contemporary-masters-20261015`. Seventeen exact production locations are unverified and remain explicitly Unfiled, with empty original-location fields and a documented explanation. Period labels are explicit and follow the site’s 1970 cutoff. Every candidate requires measured integrity without blanket component exemptions. Archive geometry counts are separated from public detail-endpoint counts, including Sacrifice III at 19,992 archive faces.

Milan’s sculpture is corrected to *Projet pour un monument* (1981), made at Fratelli Bonvicini in Verona. It is distinct from the smaller *Mère Ubu* of 1975. Conflicting donation dates and unverified exact-cast accession, edition and dimensions are omitted. Josh Smith’s *Friend* has only a historical London exhibition location; its current holding is unknown. Abakanowicz’s pair records Wrocław ownership separately from the three-year Luxembourg loan beginning May 2025.

The workflow now uploads only `.atrium-ingest/sources/` immediately after fetch. This preserves original downloads and extracted/decoded companion files before assembly and preview optimization. It uses zero artifact compression and 90-day retention. Staging metadata with signed download URLs and credentials is outside that path. This is a **temporary backup, not the permanent cloud source vault**.

The repeatable focused check is:

```sh
node docs/ingest/contemporary-masters-20261015-validate-preparation.mjs
```

It validates the 24-work manifest and runs the actual assembler in an isolated temporary repository with synthetic files: five valid cases succeed and five invalid reason/wing/integrity cases reject. It verifies explicit empty origins, owner/loan/history fields and unchanged copied source bytes. JavaScript syntax, workflow YAML parsing and whitespace checks also passed. The validation JSON records scope and limits.

The intended saved-lead inputs are `docs/ingest/contemporary-masters-20261015-leads.json` and batch `contemporary-masters-20261015`, with inline orientation disabled. Actual source and derivative appearance, complete-object geometry, orientation, final thumbnails and any physical calibration still require review. The workflow has not been dispatched, and no source model has been acquired by this preparation step.
