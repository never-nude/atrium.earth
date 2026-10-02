# Physical dimensions audit — September 9, 2026

Screened the 1,046 public catalogue records for absent, approximate, unitless or provisional dimensions and explicit reproduction references. Reviewed source records for 453 candidates. The other 593 records have not been independently reverified by this pass.

| Outcome | Works |
| --- | ---: |
| Documented measurements | 81 |
| Approximate measurements retained as approximate | 15 |
| Unresolved measurements / original identification | 356 |
| Digital work without one fixed physical size | 1 |

82 records received sourced updates or confirmations (81 documented, one rounded height). This includes 64 previously blank measurements and 11 sets of original dimensions for scanned reproductions. Nine whole, upright scans have an explicit physical-size reference. None of these counts means the whole collection is now to scale.

## Original-only policy

For a modern reproduction, use the physical museum original reproduced, with an adjacent original-dimensions note and source link. Do not offer cast-size or reproduction-size presets. A Roman marble derived from a lost Greek prototype remains the physical Roman object; an artist’s accessioned bronze is not automatically a later reproduction simply because it was cast.

Royal Cast Collection measurements are not promoted to original measurements. Unresolved cast numbers, ingest placeholders and unitless mesh bounds are withheld from the public dimensions field, with the previous values preserved in this audit. Approximate measurements remain labelled approximate. No artwork has been removed.

## Evidence and scope

- Matched source object identity and accession where available. Recovered missing museum links through inventory numbers, including Tyniec and Wawel records in Virtual Museums of Małopolska.
- Used museum collection records, museum publications and the original scan projects. Preserved component qualifiers and unlabelled axis order. A mount, sculpture and assembled group are not interchangeable measurements.
- SMK API dimensions normally describe the accessioned cast. The embedded original record does not itself supply original dimensions. Eleven originals were independently matched to records at the Louvre, British Museum, Egyptian Museum Cairo and Staatliche Museen zu Berlin.
- Kept estimates, contributor approximations, inaccessible pages and missing measurements unresolved. A successful HTTP response alone does not verify a measurement. Search snippets, accessible catalogue content and cached source descriptions were also reviewed; the request log is not a complete search history.
- Unresolved means a matching measurement was not established from the reviewed public sources. It does not assert that measurements are unavailable from all archives or museum staff. No institutions have been contacted.

Examples of exclusions: a comparative Walters torso is not the Harvard torso; a fountain’s area is not a sculpture’s height; a camera’s focal length is not an object dimension; the two Julius Erving sneaker pairs have different accessions and measurements.

## Physical sizing

`src/data/physical-dimensions.json` is the curated override used by the catalogue. It preserves measurement status, reference object, sources, notes and separately reviewed spatial references. The underlying ingest catalogue is retained for provenance; its text is never parsed automatically into metres.

The nine spatial references are Venus de Milo, Dying Slave, Beatrice d’Este, the Tyniec pyx, Tyniec Saint Paul and Saint Peter, Wawel Saint Stanislaus, Wawel Woman in Hunting Clothes, and the green-painted ushebti. Their reviewed whole-scan heights are converted to metres after orientation and normalization. WebXR and Apple Quick Look share the same conversion. Resizing is relative to the documented size, and the documented-size button restores that reference. Screen framing is unaffected.

The reference is tied to the configured preview URL and orientation entry; changing either disables it until reviewed again. Replacing geometry in place at an unchanged URL also requires a new review. These are source-calibrated scan representations, not metrological guarantees of scan fidelity.

Further geometry work is required for Nefertiti’s added pedestal, the Rampin head’s support, the restored Crouching Aphrodite, and other scans with component or scope ambiguities. Documented dimensions alone do not grant a physical-size reference. Unknown-size works remain viewable with an explicit calibration notice.

Automated tests cover original-only references, no fallback to cast or unitless values, stale preview/pose rejection, centimetre-to-metre conversion, WebXR/Quick Look agreement, floor contact, relative resizing, reset, repeated sessions and return to screen. Browser checks cover the record notes, mobile layout and AR fallbacks. No physical headset or phone measurement has been performed.

## Review and continuation

- Local visual review: `/preview/dimensions/audit/` (development only; omitted from production).
- [Complete audit with previous values, source requests and outstanding work](physical-dimensions-2026-09-09.json).
- [Curated dimension records](../../src/data/physical-dimensions.json).

For unresolved records, next establish the precise original inventory/version, retrieve the corresponding museum measurements, then separately check the scan’s extent and supports. For the 15 approximate records, seek a more precise primary measurement. Do not estimate missing physical dimensions from normalized preview meshes.
