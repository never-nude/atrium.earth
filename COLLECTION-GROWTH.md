# Collection Growth

Deep-research pass for downloadable 3D antiquity and sculpture sources. Verified June 3, 2026 from the source notes provided for this project.

This replaces the earlier quick collection-growth pass. The operational priority is to mirror open-licensed Sketchfab museum accounts while downloads still work, then fold each model into the existing Atrium pipeline with source URL, license, attribution, and collection metadata intact.

## Atrium Ingestion Policy

- Import commercial-safe sources first: CC0, public domain, and CC BY.
- Keep CC BY-NC, CC BY-NC-SA, and other non-commercial sources in a separate candidate pool until Atrium's commercial/non-commercial policy is settled.
- Preserve per-piece `source_url`, `source_institution`, `license`, attribution, accession, and any source metadata. Do not flatten source-level licensing into a collection-level assumption.
- Treat Italian state museum assets as non-commercial or skip them unless legal review clears the specific reproduction path.
- Use casts as the legal path for many locked classical icons, especially when official source museums sell or restrict the real-object scans.

## Urgent Finding

Sketchfab's free downloads are on borrowed time. Epic, which owns Sketchfab, is migrating to Fab and has stated its intent to end free downloadable content on Sketchfab; CC0, BY-SA, and NC licenses do not exist on Fab. Downloads still work as of the research date, but no shutoff date is published. Much of the world's open museum 3D currently lives there, so Atrium should harvest open-licensed accounts early.

## Tier 1: CC0 / Public Domain

Commercial-safe. Take all relevant sculpture and antiquity models.

| Source | Downloadable, verified | License | Access | Notes |
| --- | ---: | --- | --- | --- |
| Smithsonian 3D | 3,583 models | CC0 | Own site, API, bulk | Excellent metadata; limited Egyptian/Near East; strong casts and artifacts. |
| The Met | About 140, growing | CC0 majority | Site filter `showOnly=has3d`; GLB; no API field yet | Monumental sculpture such as Canova's `Perseus` and Carpeaux's `Ugolino`; strong records; legacy Cults3D account has about 69 models. |
| Cleveland Museum of Art | About 185, 181 CC0 | CC0 | Sketchfab API, own Open Access API | Strong antiquities. |
| Minneapolis Institute of Art | About 190 | 137 CC0, 33 BY-SA | Sketchfab API | Good open museum pool. |
| Musee Saint-Raymond, Toulouse | 34 of 34 | 31 CC0, 3 CC BY | Sketchfab API | Roman portrait sculpture from Chiragan marbles; excellent metadata, including Wikidata IDs. |
| SMK Royal Cast Collection | 9 of 9 | CC0 | Sketchfab, smk.dk | Apollo Belvedere, Venus de Milo, Artemision Zeus, Laocoon casts; some already in Atrium. |
| Virtual Museums of Malopolska | 1,150+ of 1,322 | Mostly CC0 and CC BY | Sketchfab API | Huge CC0 pool; less dense in classical sculpture. |
| Skulpturhalle Basel scans, Cosmo Wenman | About 10-20 | Public domain | cosmowenman.com, Thingiverse | Public-domain route to icons including Venus de Milo, Nike of Samothrace, and Athena Lemnia casts. |
| Thorvaldsens Museum | Dozens | CC0 | MyMiniFactory via Scan the World | Neoclassical sculpture. |
| Three D Scans, Oliver Laric | Dozens | No restrictions | Direct download | High-resolution Albertina, KHM Vienna, and Guimet scans; classical register. |

## Tier 2: CC BY

Commercial OK with attribution.

| Source | Downloadable | License | Notes |
| --- | ---: | --- | --- |
| Harvard Museum of the Ancient Near East | 201 of 1,327 | CC BY | Best open Near East pool: cuneiform, Canaanite, and Egyptian material. |
| Daniel Pett collections | About 310 total | CC BY plus some CC0 | Includes 76 British Museum Assyrian reliefs, 15 Egyptian Museum Cairo models, and Cambridge MOCA casts such as Dying Gaul and Terme Boxer. |
| Fitzwilliam Museum, Cambridge | 130 of about 151 | 123 CC BY | Real antiquities: Roman busts, Assyrian, Egyptian; accession numbers and open collections API. |
| Ny Carlsberg Glyptotek | About 20-50 official | CC BY | Official Scan the World partnership from 2023; STL. |
| Nationalmuseum Sweden | Dozens | CC0 or CC BY per item | Sergel and classical pieces via Scan the World. |
| Varldskulturmuseerna / Historiska, Sweden | 137 / 59 | Mostly CC BY / BY-SA | World culture and Norse material. |
| Museo Egizio Turin | 4 of 183 | 3 CC BY, 1 BY-NC | Sekhmet and Amenhotep II among a small downloadable set; excellent metadata; the rest are view-only. |
| HeiCuBeDa Hilprecht, Heidelberg | About 2,000 | CC BY | Research-grade cuneiform tablet bulk download via DOI. |

## Tier 3: CC BY-NC

Likely fine for a free museum with attribution, but constrains future commercial options. Hold for policy decision before ingesting into the public corpus.

| Source | Downloadable | License | Notes |
| --- | ---: | --- | --- |
| British Museum official Sketchfab | About 196 of 263 | CC BY-NC-SA | Rosetta Stone, Sekhmet, and Assyrian pieces. Largest official museum trove, but non-commercial and share-alike. |
| Global Digital Heritage | 11,722 | CC BY-NC | Largest single publisher; archaeology and artifact-heavy, including Iberia, Mediterranean, and Forma Urbis fragments. |
| SMB Berlin, Nefertiti | 1 official 832 MB OBJ | CC BY-NC-SA | Official downloadable scan of the famous bust. |
| Scan the World | 18,000+ | Per-object: CC0, BY, BY-NC mixed | Aggregator for Vatican, Capitoline, Naples, Louvre, and other pieces. Check each license; no public API. |
| Archeomatique, Toulouse university | About 751 | BY / BY-NC mixed | More Saint-Raymond and regional material. |

## Closed Doors

Do not plan acquisition around these unless a new source path appears.

- Louvre: official scans exist, including Venus de Milo and Nike of Samothrace, but are sold via RMN-GP; hundreds of view-only models and no public downloads.
- Vatican: Laocoon scan is view-only.
- Uffizi / Indiana: published models are view-only and all-rights-reserved; the old project domain now redirects to spam.
- Naples MANN: view-only.
- Capitoline and Greek national museums: no open download path; Greek law requires permits.
- V&A: view-only.
- Rijksmuseum: 3D view-only; CC0 program is 2D-only.
- Getty and Hermitage: no public 3D.
- ISAC Chicago: view-only.
- Penn: old STL page is dead.
- Berlin SMB Sketchfab: view-only; Pergamon Altar scan is viewer-only.

For icons behind these restrictions, prioritize legal cast scans: SMK CC0 casts, Wenman's public-domain Basel casts, and Pett's CC BY Cambridge casts.

## Licensing Red Flags

1. Italian state museums, including Uffizi, MANN, and Capitoline: Italian law, including Codice Art. 107-108, DM 161/2023, and the David ruling, can impose concession fees on commercial reproduction regardless of file license.
2. Europeana: useful as a discovery index, not as a file host. Resolve each record to the original source and license before ingest.
3. Sketchfab to Fab migration: mirror early and preserve source metadata.
4. CC BY records: keep attribution attached to every catalog item and rendered derivative.

## Acquisition Order

1. Sketchfab open-license harvest: Saint-Raymond, Cleveland, MIA, Fitzwilliam, Harvard MANE, Pett Assyrian/Cairo/casts, Varldskulturmuseerna/Historiska, Malopolska, Egizio's four downloadable works, and Smithsonian's Sketchfab CC0 set.
2. The Met CC0 GLBs: scrape the `has3d` filter until the Met API exposes a 3D field.
3. Smithsonian API: filter the 3,583-model pool for sculpture, casts, and antiquities.
4. Cast icons: Wenman Basel, SMK, and Pett MOCA to fill Venus de Milo, Nike, Athena, and related gaps legally.
5. MyMiniFactory partners: Glyptotek, Nationalmuseum Sweden, and Thorvaldsens; check per-object Scan the World license before ingest.
6. Non-commercial tier: decide Atrium's policy before importing British Museum and Global Digital Heritage material.

## Expected Scale

Commercial-safe, high-relevance sculpture and antiquity models should be about 1,000+ pieces available today across CC0, public-domain, and CC BY sources. Adding the non-commercial tier expands the addressable pool to 10,000+ pieces, but should remain segregated until a rights policy is explicit.

Every accepted source should feed the existing pipeline:

```txt
source record -> license and attribution metadata -> source model -> web GLB preview -> thumbnail -> catalog record
```
