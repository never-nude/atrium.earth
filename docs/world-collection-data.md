# World collection data

The globe groups the public collection by recorded object or artistic origin. It uses explicit geographic evidence and reviewed historical-cultural regions. Current holdings, scan capture sites, titles, artist nationality, and catalogue folders provide no origin evidence.

`src/lib/world-collection.ts` exports `worldCollection` with `places`, `works`, `unplacedCount`, `undatedCount`, `totalCount`, `dateMin` and `dateMax`. Each work retains the current public working title, maker and unchanged date label. Thumbnail and work routes remain relative to the site base; the page applies `withBase`. Source labels and URLs identify existing catalogue evidence, rather than the plotted coordinate's location.

## Origin policy

The normalized catalogue's geography can fall back to collection folders or title matching. Those normalized values are deliberately excluded. The projection reads explicit raw `origin_country`, `geography` and, conservatively, `original_location`, after existing identity corrections.

Exact geographic aliases can support representative country or regional points. A specific locality can remain unconfirmed while a broader location is established. A reviewed set of historical-cultural labels supplies regional points, including Roman Mediterranean, Gandhara, and Etruria. Where a geographic description gives several countries without a named region, a matching recorded culture is required for the reviewed regional cases. Unresolved alternatives, conflicting countries, museum or capture strings, artist nationality, and unresolved reconstruction origins stay unmapped. A dedicated country field or unambiguous full name can resolve Georgia or Congo. Korea uses its peninsula region.

Historical casts need a country or explicit manufacture/workshop basis. Their museum holding or the location of the copied original is insufficient. Unknown exact findspots do not erase an otherwise explicit broad origin: “Korea; exact findspot unknown” remains a Korea-region entry.

Country coordinates are representative map-label points from Natural Earth's public-domain 1:50m country dataset, using `LABEL_Y` and `LABEL_X`. Regional coordinates are broad display anchors. They are not archaeological coordinates, precise findspots, manufacture sites or assertions about historical borders. Country names and aliases do not infer sovereignty or modern nationality for an ancient work. The coordinate dataset URL, retrieval time and SHA-256 are retained in `src/data/world-places.json`; source polygon geometry is not stored in the repository.

Coordinate source: [Natural Earth country data](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson), [public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/).

The vivid palette uses Europe/cyan, Africa/coral, Asia/gold, Americas/magenta and Oceania/mint. Explicitly transregional historical areas, such as the Mediterranean and Ancient Near East with Egypt, use violet. The public region values are `Europe`, `Africa`, `Asia`, `Americas`, `Oceania` and `Transregional`.

## Date policy

Numeric years, explicit ranges and century labels are read from the existing production-date label. `year_sort` is never evidence. Century qualifiers such as early, middle or late retain their original wording; their numeric filter bounds use broad century envelopes rather than invented precise sub-century cutoffs. Circa dates retain their source anchor or range without inventing an uncertainty width. A current-century envelope can be bounded by the recorded ingest year: the fact that the object already existed is an upper bound, not an asserted production year.

Unknown, open-ended and mixed original/cast/acquisition events remain undated for filtering. No lifetime dates, prototype dates, discovery dates or publication dates are promoted to production dates. The original `dateLabel` remains visible even when numeric bounds are unavailable. Empty test collections have null `dateMin` and `dateMax`; the present public collection has finite bounds.

A title containing “plaster cast” does not establish that its date label describes the cast rather than a prototype. Casts require an explicit cast event in the date label or a narrowly reviewed production-date binding. The only two currently dated cast rows are the Ashmolean Apollo (CG.A.59, 1851–1900) and the Kraków Dancing Satyr (Rz 11, 19th century). Their existing object-specific notes explicitly date the captured casts. These exceptions are bound to their exact slug, date label, accession, primary record URL and supporting note; changed or missing evidence makes them undated until reviewed again. This prevents an unrelated title such as “X (plaster cast)” with “2nd century CE” from passing on title wording alone.

## Coverage at implementation

The local public catalogue contains **3,018 works** after the confirmed Ganesha consolidation:

| Coverage | Count |
| --- | ---: |
| Placed works | 1,858 |
| Unplaced works | 1,160 |
| Country/region points in use | 120 |
| Works with numeric date spans | 1,688 |
| Undated for filtering | 1,330 |
| Earliest numeric bound | 5500 BCE |
| Latest numeric bound | 2026 CE |

Placed and dated are independent. Unplaced or undated works remain in `worldCollection.works` and the full collection; neither category means an origin or date is absent from all possible scholarship.

Examples:

- David uses the explicit Florence, Italy origin at the broad Italy point, with 1501–1504.
- The Pensive Bodhisattva uses the Korea regional point despite its unknown exact findspot, with a broad 6th–7th century envelope of 500–699.
- The Copenhagen Thinker's France/Copenhagen label and modeled/cast chronology remain unplaced and undated for this projection.
- The SMK Terme Ruler can use its documented Italian cast workshop country, while its unknown casting date remains undated.
- The Met records Mali and Middle Niger civilization for the seated figure, accession 1981.218. The globe uses the Middle Niger regional point. [Met collection record](https://collectionapi.metmuseum.org/public/collection/v1/objects/314362)
- The Kraków pharmacy Asklepios remains unplaced when manufacture origin is unrecorded, even though its holding museum and early 20th-century date are known.

## Verification

The generated `/world/unmapped.json` lists the reason for every remaining unmapped public work. The link beneath the globe opens the same work set in Collection.

Run `node scripts/test-world-collection.mjs`. The focused tests cover ambiguous aliases, museum/capture exclusions, missing title/folder fallbacks, cast scope, corrected geography, hidden records, century and BCE ranges, mixed-event dates, exact date-label preservation, coordinate bounds, public route shape, coverage counts and immutable inputs. No browser, server, complete application build, model downloads or publication are part of this data-layer check.
