# Globe origin and date audit — 19 November 2026

The globe is doing two separate jobs: finding a defensible place for a work, and deciding whether its production date can be used in a time filter. **A work can have a known origin without a known date.** The default **All periods** view intentionally includes those works; selecting a bounded period excludes every work without a usable date range. Undated does not, by itself, mean wrongly placed.

[PR #120](https://github.com/never-nude/atrium.earth/pull/120) is published on `main` at `8a27d103`. Its fifteen additions and twelve reused records have passed live page verification. Four new physical-date labels were corrected in that release. The broader origin, date-grammar and reconstruction-eligibility findings below **remain unimplemented**. This file is a documentation handoff; it does not change the globe, catalogue, models or release workflows.

## What was checked

The audit evaluated every public row through the existing origin/date projection, compared deployed baseline `d0bb92fb` with the PR #120 data, and made targeted fresh primary-source checks for the cases listed below. It is not a new scholarly verification of every origin in the collection. The counts describe the projection, not how many dates or origins could eventually be established from scholarship.

| Projection | Before PR #120 (`d0bb92fb`) | PR #120 (`8a27d103`) |
|---|---:|---:|
| Public works | 3,184 | 3,199 |
| Have a mapped origin | 2,074 | 2,079 |
| Have no mapped origin | 1,110 | 1,120 |
| Have a usable timeline span | 1,774 | 1,789 |
| Have no usable timeline span | 1,410 | 1,410 |
| Mapped, with a usable date | 1,228 | 1,233 |
| Mapped, without a usable date | **846** | **846** |
| Unmapped, with a usable date | **546** | **556** |
| Unmapped, without a usable date | 564 | 564 |

The projection includes 846 mapped works without numeric date bounds because its origin resolver accepts their recorded place fields. That does not independently validate every assignment: the overconfident origins and other eligibility gaps found in this audit are listed separately below. The 556 dated but unmapped works in the released data have the opposite problem: a date does not establish a place. Some “undated” entries have literal source dates that the current conservative parser does not yet recognize; nine verified examples appear below.

In a local browser check of the real world page, selecting Zimbabwe at All periods displayed three mapped works whose dates are unknown or unrecorded. Changing the range to 1800–2026 displayed none and explained that three uncertain-date records were outside the filter. There were no page errors or model requests. Pure filtering checks likewise included zero unknown-span works in bounded ranges, including the full numeric envelope with the All periods flag turned off. This confirms the intended behavior rather than a date leak into a selected period.

## How an origin is chosen

The globe reads explicit raw `origin_country`, `geography` and, conservatively, `original_location` after identity corrections. It does not use the catalogue’s title/folder geography fallbacks. A bounded set of documented historical-cultural labels can supply a broad regional point. Museum holdings, scan locations and an artist’s nationality alone do not establish the origin of the represented object. Physical casts require evidence about the cast, not merely its ancient or Renaissance prototype.

Country and regional coordinates are representative display anchors, not exact findspots, workshops or claims about historical borders. The current policy and implementation are recorded in [world-collection-data.md](../world-collection-data.md), `src/lib/world-collection.mjs`, `src/lib/world-time.mjs` and `src/lib/world-selection.mjs`.

The investigation found several different causes of omission: country-name suffix collisions, a conflict between a specific island and its modern parent country, holding-institution words appearing in genuine historical findspots, missing geographic aliases, and uncertainty about a local site or dynasty being applied to an otherwise definite country. These need scoped corrections; removing the holding/conflict/uncertainty checks wholesale would admit unsupported origins.

## Thirteen primary-supported origin omissions

These records are currently unplaced even though the checked primary evidence supports the broad place shown. “Basis” distinguishes manufacture, original monument context, cultural geography and archaeological discovery. A Swedish findspot, for example, must not be relabeled as proof of a Swedish workshop.

| Work and slug | Supported broad place / basis | Demonstrated problem | Primary evidence |
|---|---|---|---|
| [Zuni Owl-shaped Jug](https://atrium.earth/works/americas/zuni-owl-jug-yale/)<br>`americas/zuni-owl-jug-yale` | United States; museum-recorded locality | The museum explicitly records Zuni, New Mexico and USA. Suffix matching treats “New Mexico” as the country Mexico and creates a false conflict with United States. | [Primary record](https://api.sketchfab.com/v3/models/14b2566edcab48deb4b62a943349c7fd) |
| [Hoa Hakananaiʻa](https://atrium.earth/works/oceania/hoa-hakananai-a-british-museum/)<br>`oceania/hoa-hakananai-a-british-museum` | Rapa Nui; documented island and original Orongo context | “Orongo, Rapa Nui, Chile” fails because the specific Oceania region conflicts with the Chile country point in the Americas. The existing exact alias “Rapa Nui (Chile)” already resolves correctly. | [Primary record](https://artsandculture.google.com/asset/hoa-hakananai-a/kwHuDcNF0g4yRg) |
| [The Vendel I Helmet](https://atrium.earth/works/europe/vendel-i-helmet-5a810a/)<br>`europe/vendel-i-helmet-5a810a` | Sweden; archaeological findspot | “Church” in the boat-grave locality triggers the holding-institution veto. The museum separately identifies the Swedish findspot. | [Primary record](https://samlingar.shm.se/object/F0DD41E6-54C5-41FC-9AE4-C865CD8FEB2F) |
| [The Vendel XII Helmet](https://atrium.earth/works/europe/vendel-xii-helmet-8c297f/)<br>`europe/vendel-xii-helmet-8c297f` | Sweden; archaeological findspot | The same church-word veto rejects the documented Swedish boat-grave locality. | [Primary record](https://samlingar.shm.se/object/8878740C-0E43-420A-9A94-BC793C0677D2) |
| [The Vendel XIV Helmet](https://atrium.earth/works/europe/vendel-xiv-helmet-be9b5b/)<br>`europe/vendel-xiv-helmet-be9b5b` | Sweden; archaeological findspot | The church-word veto rejects the findspot. The museum also gives Scandinavian manufacture, which does not establish a specifically Swedish workshop. | [Primary record](https://samlingar.shm.se/object/A20FACD7-D39E-4EE5-9B72-16601649C9A3) |
| [Supports with Addorsed Figures](https://atrium.earth/works/asia/supports-with-addorsed-figures-cleveland-2011-144-8dec5f/)<br>`asia/supports-with-addorsed-figures-cleveland-2011-144-8dec5f` | Tibetan Plateau; original Densatil monument/cultural region | “Monastery” is treated as a holding term even though Densatil is the documented original context, separate from the Cleveland holding. Tibet alone already resolves to the regional anchor. | [Primary record](https://www.clevelandart.org/art/2011.144) |
| [Piggy Bank](https://atrium.earth/works/asia/piggy-bank-14bfd1/)<br>`asia/piggy-bank-14bfd1` | Indonesia; recorded Java/Majapahit origin | The exact geography “Java” has no recognized alias. The museum’s Java attribution is not an inference from its current location. | [Primary record](https://www.clevelandart.org/art/1980.16) |
| [Raft Cup](https://atrium.earth/works/asia/raft-cup-cleveland-1977-7-a254ff/)<br>`asia/raft-cup-cleveland-1977-7-a254ff` | China; unqualified country attribution | The “or” separates Yuan and early Ming periods, not countries. Flattening the whole culture string into geography makes the country appear uncertain. | [Primary record](https://www.clevelandart.org/art/1977.7) |
| [Monster Caryatid](https://atrium.earth/works/asia/monster-caryatid-cleveland-1957-357-70d852/)<br>`asia/monster-caryatid-cleveland-1957-357-70d852` | China; unqualified country attribution | China is definite in the record; only Xiangtangshan is possible. The blanket qualifier veto discards both. | [Primary record](https://www.clevelandart.org/art/1957.357) |
| [Ceremonial Cross of Count Liudolf](https://atrium.earth/works/europe/ceremonial-cross-of-count-liudolf-cleveland-1931-461/)<br>`europe/ceremonial-cross-of-count-liudolf-cleveland-1931-461` | Germany; unqualified country attribution | The primary attribution gives Germany with Lower Saxony uncertain. The possible region should not erase the supported country. | [Primary record](https://www.clevelandart.org/art/1931.461) |
| [Bearded Captive (SMK cast)](https://atrium.earth/works/michelangelo/bearded-captive-smk-cast/)<br>`michelangelo/bearded-captive-smk-cast` | Italy; manufacture of this physical cast | The text combines an Italian workshop and Danish destination. SMK explicitly records the Florence cast workshop and a 2002 production date; Denmark is not a competing manufacturing origin. | [Primary record](https://api.smk.dk/api/v1/art/?object_number=KAS2359) |
| [Ciste a Cordoni from the Hassle Hoard](https://atrium.earth/works/roman/ciste-a-cordoni-hassle-96979-hst/)<br>`roman/ciste-a-cordoni-hassle-96979-hst` | Italy; manufacture, with Sweden preserved separately as findspot | The museum-published source describes the buckets as from northern Italy. The current text merges that production origin with Swedish discovery and the mapper treats them as competing countries. | [Primary record](https://api.sketchfab.com/v3/models/d3f9d1af40de4c8d8d5fe6faba06d615) |
| [False door](https://atrium.earth/works/egyptian/false-door-irienakhet-mia/)<br>`egyptian/false-door-irienakhet-mia` | Egypt; museum-recorded object country | The catalogue retains only a museum holding. The official Mia API for accession 52.22 explicitly supplies Egypt; no origin is inferred from Minneapolis. | [Primary record](https://search.artsmia.org/id/1230) |

The False Door’s place evidence also accompanies a verified date-grammar omission below. The Bearded Captive’s source-supported 2002 cast date is distinct from Michelangelo’s much earlier marble; it is not permission to loosen the general prototype/cast guard.

## Four assignments that overstate the primary place evidence

These are not claims that the object was actually made in another country. The problem is that a qualified or proposed origin is presented as a definite country. Re-establish a broader country independently, preserve the qualifier, or leave the point unresolved; do not guess a replacement.

| Work and slug | Current point | Checked evidence and failure | Primary evidence |
|---|---|---|---|
| [Aesculapius — Bronze Votive Figure](https://atrium.earth/works/roman/aesculapius-allard-pierson-35-902763/)<br>`roman/aesculapius-allard-pierson-35-902763` | Italy | The institutional source gives Italy with a question mark. The catalogue translates this to “Italy (probable)”, including in the country field. The matcher recognizes “probably” but omits “probable”, turning the qualified country into a definite point. | [Primary record](https://api.sketchfab.com/v3/models/902763811f3f4d8f93827549bd233d56) |
| [Visored Helmet (Helmelin)](https://atrium.earth/works/europe/stockholm-jousting-helmet-a4eea3/)<br>`europe/stockholm-jousting-helmet-a4eea3` | Sweden | The museum identifies Stockholm as a probable manufacture place (“Trolig tillverkningsort”). The adjective “probable” is ignored by matching. No independent unqualified manufacturing country was established in this audit. | [Primary record](https://samlingar.shm.se/object/CEB4A672-6F65-46B3-9770-267779C9DAF5) |
| [Dancing Satyr — Kraków Plaster Cast](https://atrium.earth/works/europe/dancing-satyr-krakow-cast-rz11-2a7661/)<br>`europe/dancing-satyr-krakow-cast-rz11-2a7661` | Poland | The primary API marks Kraków, Poland as the place of creation with a question-mark comment. An unqualified Poland country field and the omitted “probable” adjective promote that proposal to certainty. Its nineteenth-century cast date remains a separate, supported fact. | [Primary record](https://api.muzea.malopolska.pl/api/object/2274) |
| [Marcellus as Hermes (Historical Germanicus Plaster Cast)](https://atrium.earth/works/europe/marcellus-as-hermes-historical-germanicus-plaster-cast-bed74a/)<br>`europe/marcellus-as-hermes-historical-germanicus-plaster-cast-bed74a` | Austria | The primary API marks Vienna as the place of creation with a question-mark comment. The unqualified Austria fields override the qualified original-location field. Acquisition history does not independently prove the cast’s manufacture country. | [Primary record](https://api.muzea.malopolska.pl/api/object/2233) |

A separate source review remains open for [Fenosa’s *Orlando Furioso*](https://atrium.earth/works/europe/apelles-fenosa-orlando-furioso/) (`europe/apelles-fenosa-orlando-furioso`). Its Spain point is not established for the captured Montpellier bronze by the cited [IEC/MNAC biography](https://artistes.iec.cat/artista.asp?id=326), which distinguishes Madrid and Montpellier editions, or by the [capture publisher](https://api.sketchfab.com/v3/models/73d9b434f93f449dbfbe58e6239b6dd0). This does not prove a French manufacturing origin: a Montpellier installation is not a foundry record. Establish the exact version’s production origin or keep it unresolved.

## Nine existing, source-verified date-grammar omissions

These literal source dates are currently rejected by grammar rather than absent from the record. Date verification here does not endorse each work’s existing geographic assignment. All nine remain unfixed in the broader parser; eight already have map points, while the False Door also needs the separate Egypt origin recovery.

| Work and slug | Current label | Verified reading / potential numeric span | Primary evidence |
|---|---|---|---|
| [False door](https://atrium.earth/works/egyptian/false-door-irienakhet-mia/)<br>`egyptian/false-door-irienakhet-mia` | about 2400 BCE | Recognize “about” as a circa qualifier, giving 2,400 BCE, with approximation still visible in the label. | [Primary record](https://search.artsmia.org/id/1230) |
| [Sappho](https://atrium.earth/works/europe/sappho-epinay-met/)<br>`europe/sappho-epinay-met` | About 1895 | Recognize “about” as a circa qualifier, giving 1,895 CE, with approximation still visible in the label. | [Primary record](https://www.metmuseum.org/art/collection/search/209017) |
| [Kilnasaggart Inscribed Pillar Stone](https://atrium.earth/works/europe/kilnasaggart-inscribed-pillar-stone-c6e5c1/)<br>`europe/kilnasaggart-inscribed-pillar-stone-c6e5c1` | About 700 | Recognize “about” as a circa qualifier, giving 700 CE, with approximation still visible in the label. | [Primary record](https://www.communities-ni.gov.uk/heritage-sites/kilnasaggart-pillar-stone) |
| [Torso of Apollo](https://atrium.earth/works/roman/torso-apollo-cleveland-1924-1017-368499/)<br>`roman/torso-apollo-cleveland-1924-1017-368499` | About 100–200 CE | Recognize “about” as a circa qualifier, giving 100 CE–200 CE, with approximation still visible in the label. | [Primary record](https://www.clevelandart.org/art/1924.1017) |
| [Cockatoo](https://atrium.earth/works/europe/cockatoo-ddebac/)<br>`europe/cockatoo-ddebac` | August 1734 | Recognize the calendar date; use 1,734 CE in the year-based filter and retain the month/day in the written label. | [Primary record](https://skd-online-collection.skd.museum/Details/Index/118580) |
| [Descending Macaw](https://atrium.earth/works/europe/descending-macaw-42b038/)<br>`europe/descending-macaw-42b038` | May 1732 | Recognize the calendar date; use 1,732 CE in the year-based filter and retain the month/day in the written label. | [Primary record](https://skd-online-collection.skd.museum/Details/Index/119428) |
| [Vase with Chinoiserie Decoration](https://atrium.earth/works/europe/vase-with-chinoiserie-decoration-92f402/)<br>`europe/vase-with-chinoiserie-decoration-92f402` | 17 August 1726 | Recognize the calendar date; use 1,726 CE in the year-based filter and retain the month/day in the written label. | [Primary record](https://skd-online-collection.skd.museum/Details/Index/119275) |
| [Half of a twin capital with a motif of hearts](https://atrium.earth/works/europe/half-of-a-twin-capital-with-a-motif-of-hearts-0cadda/)<br>`europe/half-of-a-twin-capital-with-a-motif-of-hearts-0cadda` | 4th quarter of the 11th century | Recognize the quarter/“of the” form. Under the current conservative policy, use the full 11th-century envelope, 1000–1099, while retaining the fourth-quarter qualifier in the displayed label. | [Primary record](https://api.muzea.malopolska.pl/api/object/2376) |
| [Water Ewer for Rituals (Kundika) with Incised Parrot Design](https://atrium.earth/works/asia/kundika-water-ewer-cleveland/)<br>`asia/kundika-water-ewer-cleveland` | 1100s | Recognize “1100s” as the source’s century form, giving 1100–1199; do not invent an exact production year. | [Primary record](https://www.clevelandart.org/art/1921.631) |

The wider syntax triage found 7 “about” labels, 5 calendar labels, 25 century-quarter labels and 85 “s” forms. Those are grammar review candidates, not blanket approvals. Open-ended dates, publication/acquisition dates, uncertain chronology and mixed prototype/cast histories must continue to fail closed unless separately supported. `year_sort` must not fill a missing production date.

### Four labels already corrected in PR #120

These corrections concern the represented physical objects and are already released. They change source labels, not parser code. Separate model/prototype dates remain contextual evidence. All four still lack a verified mapped origin; a date correction alone does not supply one.

| Physical object | Released label | Existing parser span | Primary evidence |
|---|---|---|---|
| Mirbach Palace bronze cast after Tilgner | 1981 cast | 1981–1981 | [Bratislava City Gallery](https://www.gmb.sk/en/detail/fountain-in-the-courtyard-of-mirbach-palace) |
| Bartolini’s Louvre marble, RF 4451 | c. 1835–1845 | 1835–1845 | [Louvre](https://collections.louvre.fr/ark:/53355/cl010095364) |
| Rinehart’s Met marble, 11.68.1 | 1872 carved | 1872–1872 | [Met](https://www.metmuseum.org/art/collection/search/11922) |
| French bather, NGA 2022.107.1 | Mid-late 18th century | 1700–1799 | [National Gallery of Art](https://www.nga.gov/artworks/222058-bather-or-nymph-bath) |

The NGA span is the existing full-century envelope, not a claim that its “mid-late” qualifier covers every year in that envelope. The 1757 model date remains separate from the carving.

## Reconstruction declarations: a separate review inventory

The current origin guard checks only the title and material for the adjacent phrase “digital reconstruction” or “virtual material study”. It misses affirmative declarations in `scan_source`, and “digital architectural reconstruction” does not match the adjacent phrase. That inconsistency lets some declared digital versions acquire geographic points under the existing guard policy.

**This inventory records what the catalogue says about the displayed version.** Its affirmative fields were manually checked for negation and physical-scan contrasts. It is not a fresh external source or asset review of every listed model. The linked capture sources below are supplied for that follow-up; they should not be read as newly verified declarations from every publisher. A source-specific eligibility decision is safer than an ever-broader keyword filter.

| Inventory stage | Count | Meaning |
|---|---:|---|
| Broad search, including notes | 72 | Includes negated comparisons and physical restorations |
| Affirmative declarations in title/material/capture fields | 69 | Manually reviewed catalogue declarations about the displayed digital version |
| Affirmative declarations already unplaced | 21 | Twelve are caught by the existing reconstruction guard; nine are unplaced for other origin reasons |
| Affirmative declarations currently mapped | **48** | Exact review inventory below |
| Negated/physical-scan examples excluded | 3 | Listed separately below; not reconstruction-removal candidates |

### Reconciliation with the date audit’s 61 candidates

The earlier 61-record prefix-oriented candidate list is a strict subset of the 69 affirmative declarations. **Both lists contain exactly the same 48 mapped slugs.** The eight additional records below state the digital nature in their material/title or later in a longer capture description. All eight are already unplaced with `reconstruction-origin-unresolved`, so they do not add to the 48 mapped review cases.

| Additional already-unplaced record | Slug |
|---|---|
| Asad Al-Lat (Lion of Al-Lat) | `asia/asad-al-lat-new-palmyra-commons` |
| Spatial Composition (2) (Digital Reconstruction) | `makers/katarzyna-kobro-spatial-composition-2-digital-reconstruction` |
| Spatial Composition (6) (Digital Reconstruction) | `makers/katarzyna-kobro-spatial-composition-6-digital-reconstruction` |
| Spatial Composition (7) (Digital Reconstruction) | `makers/katarzyna-kobro-spatial-composition-7-digital-reconstruction` |
| Spatial Composition (8) (Digital Reconstruction) | `makers/katarzyna-kobro-spatial-composition-8-digital-reconstruction` |
| Bi Disc (Museum Digital Reconstruction) | `global/bi-disc-museum-digital-reconstruction-d763ec3d` |
| Swedish Mortar Boat | `europe/swedish-mortar-boat-maritime-museum-finland-10cdff` |
| Swedish Chapman-Type Gun Yawl | `europe/swedish-chapman-gun-yawl-maritime-museum-d08c2a` |

### Three excluded physical-scan or negated cases

| Physical record | Why it is excluded from the affirmative inventory |
|---|---|
| [Emil Fischer Monument](https://atrium.earth/works/europe/fritz-klimsch-emil-fischer-monument/)<br>`europe/fritz-klimsch-emil-fischer-monument` | Scan of the physical monument installed in 1995, cast after a physical reconstruction of the earlier destroyed work. Its note expressly denies that the displayed version is a digital reconstruction. |
| [Statue of Augustus III Wettin](https://atrium.earth/works/europe/statue-of-augustus-iii-wettin-4dd155/)<br>`europe/statue-of-augustus-iii-wettin-4dd155` | Digitization of a physical eighteenth-century porcelain sculpture. The digital-reconstruction wording occurs only in a negated comparison. |
| [Longquan Celadon Bowl with Gold-lacquer Repairs](https://atrium.earth/works/asia/longquan-celadon-bowl-with-gold-lacquer-repairs-e1a982/)<br>`asia/longquan-celadon-bowl-with-gold-lacquer-repairs-e1a982` | Scan of the physical bowl with later material repairs. Its note distinguishes that repair history from a new digital reconstruction. |

Normal photogrammetric “3D reconstruction” of a photographed physical object must also remain distinct. For example, Yale’s owl-jug source describes a RealityCapture photogrammetry process; that technical wording is not a declaration that the artwork was invented or modeled from reference pictures. Physical casts and scanned conservation reconstructions are likewise not automatically digital substitutes.

### Exact 48 mapped affirmative catalogue declarations

These rows describe the current mapping and recorded capture provenance, not a decision to hide them. The broad grouping includes older acquisitions outside the unresolved original eleven-work Group D request. **Neither Group D membership nor authority for bulk catalogue hiding is inferred.** A globe-only eligibility review and a public-catalogue admission/removal decision are separate actions.

| Work and slug | Current point | Recorded digital-version basis | Recorded capture source |
|---|---|---|---|
| [Cubic-Modular Wall Structure, Black](https://atrium.earth/works/americas/lewitt-cubic-modular-wall-structure/)<br>`americas/lewitt-cubic-modular-wall-structure` | United States of America | Digital reconstruction after an original artwork | [Capture source](https://zenodo.org/records/10322358) |
| [Cubic Construction: Diagonal 4, Opposite Corners 1 and 4 Units](https://atrium.earth/works/americas/lewitt-cubic-construction-diagonal-four/)<br>`americas/lewitt-cubic-construction-diagonal-four` | United States of America | Digital reconstruction after an original artwork | [Capture source](https://zenodo.org/records/10315076) |
| [Incomplete Open Cube 6/8](https://atrium.earth/works/americas/lewitt-incomplete-open-cube-six-eight/)<br>`americas/lewitt-incomplete-open-cube-six-eight` | United States of America | Digital reconstruction after an original artwork | [Capture source](https://zenodo.org/records/10242267) |
| [Empty Box](https://atrium.earth/works/europe/jorge-oteiza-empty-box/)<br>`europe/jorge-oteiza-empty-box` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/3823953754d14004bd8f8101bd41908d) |
| [Homenaje a Gaudí](https://atrium.earth/works/europe/eduardo-paolozzi-homenaje-a-gaudi/)<br>`europe/eduardo-paolozzi-homenaje-a-gaudi` | United Kingdom | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/64befd14c47244e285dac9dd6e11749d) |
| [Móvil](https://atrium.earth/works/europe/eusebio-sempere-movil/)<br>`europe/eusebio-sempere-movil` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/c9779a6e5163461996a25bae3d76e87b) |
| [Introversión](https://atrium.earth/works/europe/josep-maria-subirachs-introversion/)<br>`europe/josep-maria-subirachs-introversion` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/c4aadfc26f7a46b485e2db89289ca441) |
| [Lady Tenerife](https://atrium.earth/works/europe/martin-chirino-lady-tenerife/)<br>`europe/martin-chirino-lady-tenerife` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/dae520e1ac3e465eaa8379508650f596) |
| [Nivel](https://atrium.earth/works/europe/joaquin-rubio-camin-nivel/)<br>`europe/joaquin-rubio-camin-nivel` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/05b147a30d9c43858be4659b25cdb32d) |
| [Macla](https://atrium.earth/works/europe/eduardo-gregorio-macla/)<br>`europe/eduardo-gregorio-macla` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/a385894dc5fd4e648fd39170d3124294) |
| [Untitled](https://atrium.earth/works/europe/feliciano-hernandez-untitled/)<br>`europe/feliciano-hernandez-untitled` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/0404931bd7be4e78b05b3b40fc1b83b1) |
| [Untitled](https://atrium.earth/works/europe/andreu-alfaro-untitled/)<br>`europe/andreu-alfaro-untitled` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/f649c8d8883d4a4788992291d0a32736) |
| [Laberinto: Homenaje a Borges](https://atrium.earth/works/europe/gustavo-torner-laberinto-homenaje-a-borges/)<br>`europe/gustavo-torner-laberinto-homenaje-a-borges` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/b09aeb1f5eb640abbd6dcd99d663d62e) |
| [Homenaje a Millares](https://atrium.earth/works/europe/claude-viseux-homenaje-a-millares/)<br>`europe/claude-viseux-homenaje-a-millares` | France | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/c6648fad373b40f19407d2f374f2b9b8) |
| [Lorea](https://atrium.earth/works/europe/ricardo-ugarte-lorea/)<br>`europe/ricardo-ugarte-lorea` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/8cfca56e6e1d4f69a2bcb6c7c19ff8bd) |
| [Untitled](https://atrium.earth/works/americas/federico-assler-untitled/)<br>`americas/federico-assler-untitled` | Chile | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/c67cb5bc5e2a475d89007bd3901e7e33) |
| [Solidaridad](https://atrium.earth/works/europe/mark-macken-solidaridad/)<br>`europe/mark-macken-solidaridad` | Belgium | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/bf0b3a5c5ff043abbb5a5dea2525382c) |
| [Homenaje a Pascal](https://atrium.earth/works/europe/gottfried-honegger-homenaje-a-pascal/)<br>`europe/gottfried-honegger-homenaje-a-pascal` | Switzerland | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/159726f61fe1435b95f1cb640071e03c) |
| [Homenaje a las Islas Canarias](https://atrium.earth/works/europe/pablo-serrano-homenaje-a-las-islas-canarias/)<br>`europe/pablo-serrano-homenaje-a-las-islas-canarias` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/26bacb23e60b4d948b9b81686ff3f08b) |
| [Dado para 13](https://atrium.earth/works/europe/remigio-mendiburu-dado-para-13/)<br>`europe/remigio-mendiburu-dado-para-13` | Spain | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/299369a4418c4152822f203bf762afdd) |
| [Sol, Lua e Vento](https://atrium.earth/works/asia/satoru-sato-sol-lua-vento/)<br>`asia/satoru-sato-sol-lua-vento` | Japan | Affirmative digital-reconstruction capture declaration | [Capture source](https://sketchfab.com/3d-models/satoru-sato-sol-lua-e-vento-9bf2d03358ba429686f0e6f26b706f8d) |
| [Trade Winds](https://atrium.earth/works/europe/michael-warren-trade-winds/)<br>`europe/michael-warren-trade-winds` | Ireland | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/acd57165313c4454a7a2139d6297a92b) |
| [Uma escultura para Santo Tirso](https://atrium.earth/works/europe/pedro-cabrita-reis-uma-escultura-para-santo-tirso/)<br>`europe/pedro-cabrita-reis-uma-escultura-para-santo-tirso` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/dd7bb650e4a5487784aac962235b0d27) |
| [Untitled](https://atrium.earth/works/europe/rafael-canogar-untitled/)<br>`europe/rafael-canogar-untitled` | Spain | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/3152488b77054b1b91db71cc27f34637) |
| [Mira hacia dentro de ti](https://atrium.earth/works/americas/david-lamelas-mira-hacia-dentro-de-ti/)<br>`americas/david-lamelas-mira-hacia-dentro-de-ti` | Argentina | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/fc7f70a2bdd84b0797b363097405cd1e) |
| [Scultura – Santo Tirso ’96](https://atrium.earth/works/europe/mauro-staccioli-scultura-santo-tirso-96/)<br>`europe/mauro-staccioli-scultura-santo-tirso-96` | Italy | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/8d39b6880d944742979e14b6cfc9a73f) |
| [Untitled (Column-Fountain)](https://atrium.earth/works/asia/dani-karavan-untitled-column-fountain/)<br>`asia/dani-karavan-untitled-column-fountain` | Israel | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/43a055e3712e4b4ca3707774d779f351) |
| [Untitled](https://atrium.earth/works/asia/um-tai-jung-untitled/)<br>`asia/um-tai-jung-untitled` | South Korea | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/8033f3b5583b4e8e9bbea2fc27f04723) |
| [Eu espero](https://atrium.earth/works/europe/fernanda-fragateiro-eu-espero/)<br>`europe/fernanda-fragateiro-eu-espero` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/4071a9e68e8643dfb4ca81b778725b7c) |
| [Cubo](https://atrium.earth/works/europe/jacques-villegle-cubo/)<br>`europe/jacques-villegle-cubo` | France | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/f7cba8be716d45feaf4c49ad92d41f93) |
| [Escada](https://atrium.earth/works/europe/jose-pedro-croft-escada/)<br>`europe/jose-pedro-croft-escada` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/49c59c03ea424fc496c82aa2e3143b85) |
| [Canyon](https://atrium.earth/works/europe/pino-castagna-canyon/)<br>`europe/pino-castagna-canyon` | Italy | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/2a6e982b63434c66a9479536e7415dc0) |
| [Duas faces](https://atrium.earth/works/asia/wang-keping-duas-faces/)<br>`asia/wang-keping-duas-faces` | People's Republic of China | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/c1322815d25c4e2aa50fcb93cd3417f2) |
| [Oeuf du vent](https://atrium.earth/works/asia/kishida-katsuji-oeuf-du-vent/)<br>`asia/kishida-katsuji-oeuf-du-vent` | Japan | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/ccd01db00cf14b0583019573934eb444) |
| [O barco, a lua e a montanha](https://atrium.earth/works/europe/alberto-carneiro-o-barco-a-lua-e-a-montanha/)<br>`europe/alberto-carneiro-o-barco-a-lua-e-a-montanha` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/ee4618e7b01c4a819452feaae0739349) |
| [Sedimentação](https://atrium.earth/works/europe/jean-paul-albinet-sedimentacao/)<br>`europe/jean-paul-albinet-sedimentacao` | France | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/6dae6b5499b74ab38f5a9563516aa111) |
| [Sem o teu nome](https://atrium.earth/works/europe/rui-chafes-sem-o-teu-nome/)<br>`europe/rui-chafes-sem-o-teu-nome` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/e6cf84cce7864d09a345d32c3ec40de1) |
| [Untitled](https://atrium.earth/works/asia/suk-won-park-untitled/)<br>`asia/suk-won-park-untitled` | South Korea | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/d2d06a6d500d4cc1b87e560f374c2ffc) |
| [Um espaço para Santo Tirso](https://atrium.earth/works/europe/rui-sanches-um-espaco-para-santo-tirso/)<br>`europe/rui-sanches-um-espaco-para-santo-tirso` | Portugal | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/6a2b2d6303554206a02ef41b1b9d8308) |
| [Hangul Character – 1999](https://atrium.earth/works/asia/han-chang-jo-hangul-character-1999/)<br>`asia/han-chang-jo-hangul-character-1999` | South Korea | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/99887a4cf7da4d74a1cc201f9ab44d9f) |
| [Razorblade](https://atrium.earth/works/europe/philippe-perrin-razorblade/)<br>`europe/philippe-perrin-razorblade` | France | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/00d7d7c6dd76440bb6971f6b970a29cf) |
| [Second Growing Pilar](https://atrium.earth/works/americas/jorge-du-bon-second-growing-pilar/)<br>`americas/jorge-du-bon-second-growing-pilar` | Mexico | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/8d9f1798a7cb413cbb0c5ffee15ed54d) |
| [Piège à ciel](https://atrium.earth/works/europe/pierre-marie-lejeune-piege-a-ciel/)<br>`europe/pierre-marie-lejeune-piege-a-ciel` | France | Digital reconstruction (2017) | [Capture source](https://sketchfab.com/3d-models/5cd5532b5bf14f838ac4dc6264acc4f0) |
| [Kylix with Two Women Putting Aside Their Garments](https://atrium.earth/works/greek/kylix-two-women-douris-met-23-160-54/)<br>`greek/kylix-two-women-douris-met-23-160-54` | Greece | Vessel modeled from museum reference images; not a direct scan | [Capture source](https://sketchfab.com/3d-models/1cb2dfc2ab644ece865e811ba48511ed) |
| [Reconstruction of the Kamionka Strumiłowa Wooden Synagogue](https://atrium.earth/works/europe/reconstruction-of-the-kamionka-strumiowa-wooden-synagogue-9f6169/)<br>`europe/reconstruction-of-the-kamionka-strumiowa-wooden-synagogue-9f6169` | Ukraine | Digital architectural reconstruction | [Capture source](https://sketchfab.com/3d-models/kamionka-strumiowa-synagogawooden-synagogue-9f6169cbcf2541bbabb752acadfa12c9) |
| [Reconstruction of the Sopoćkinie Wooden Synagogue](https://atrium.earth/works/europe/reconstruction-of-the-sopockinie-wooden-synagogue-5920a8/)<br>`europe/reconstruction-of-the-sopockinie-wooden-synagogue-5920a8` | Belarus | Digital architectural reconstruction | [Capture source](https://sketchfab.com/3d-models/sopockinie-synagoga-wooden-synagogue-5920a809716e418287da9c3c19a469b7) |
| [Reconstruction of the Chodorów Wooden Synagogue](https://atrium.earth/works/europe/reconstruction-of-the-chodorow-wooden-synagogue-aed85e/)<br>`europe/reconstruction-of-the-chodorow-wooden-synagogue-aed85e` | Ukraine | Digital architectural reconstruction | [Capture source](https://sketchfab.com/3d-models/chodorow-synagoga-drewniana-wooden-synagogue-aed85ee4d3e54932bf0b21e9f1901731) |
| [Reconstruction of the Suchowola Wooden Synagogue](https://atrium.earth/works/europe/reconstruction-of-the-suchowola-wooden-synagogue-e737bc/)<br>`europe/reconstruction-of-the-suchowola-wooden-synagogue-e737bc` | Poland | Digital architectural reconstruction | [Capture source](https://sketchfab.com/3d-models/suchowola-synagoga-drewniana-wooden-synagogue-e737bc79b98c457583f60e127820bc12) |

### Conditional empty-place scenario

If a later reviewed **globe-only** decision excludes all 48 mapped affirmative digital versions, the present dataset would lose these three otherwise empty points. This is a conditional calculation, not an implemented change, a verified Group D outcome, or proof that every declaration has been independently re-established. It does not count any catalogue deletion.

| Point | Records in this subset that currently sustain it | Limit |
|---|---:|---|
| Argentina | 1 | Exact origin/source-kind review still required |
| South Korea | 3 | The separate historical Korea regional point would remain |
| Belarus | 1 | Exact origin/source-kind review still required |

## Proposed follow-up, not yet implemented

1. Keep genuinely unknown dates in All periods, with a clearer overview explanation. Consider saying “works have a mapped origin” for static coverage, since the number of visible lights changes with the time filter.
2. Restore the four primary place qualifiers and repair the narrow “probable” handling gap without turning possible localities into definite countries. Re-check broad country evidence separately.
3. Recover the thirteen verified omissions through clean, source-bound origin fields or reviewed bindings. Keep manufacture, archaeological recovery, original installation and current holdings distinct. Preserve conflicts when two real production places exist, such as the Turkish body and English mounts of the Iznik Jug.
4. Add narrow, tested date grammar for the nine verified literal forms while preserving all prototype, cast, acquisition and publication safeguards. Do not automatically normalize every similar-looking label.
5. Review the explicit digital-version inventory against its actual sources and agree on globe eligibility. Keep that decision separate from any catalogue hiding and from the still-unknown original Group D membership.
6. Compare the complete before/after point set against an exact reviewed list. Add regressions for New Mexico/Mexico, Rapa Nui/Chile, original archaeological or religious sites versus holdings, scoped locality uncertainty, and affirmative digital versions versus negated physical restorations. Report any emptied place only after the selected correction is known.

No broader globe correction, model change, catalogue hiding, merge or deployment is performed by this handoff.
