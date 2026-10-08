# Atrium Auto Ingest Report

Generated: 2026-10-08T00:12:09.162Z
Accepted: 6
Rejected: 1
Needs orientation: 4

## Accepted Pieces

| Piece | Source | License | Tri-count | Integrity | Orientation |
| --- | --- | --- | ---: | --- | --- |
| Roman Cavalry Face Helmet from Nijmegen (`roman/nijmegen-roman-cavalry-face-helmet-valkhof-xxi-l-4-760424`) | [source](https://sketchfab.com/3d-models/romeinse-gezichtshelm-760424bb696447cfae9802dd77d47866) | CC BY-SA 4.0 | 9999 | faces=9999 ncomp=1 bratio=0.024 | auto {"upAxis":"y","modelRotation":[140.28,0,-7.3],"yaw":0} confidence=0.76 |
| Montefortino Helmet from Piquete de la Atalaya (`roman/montefortino-helmet-piquete-atalaya-zaragoza-ec3a3a`) | [source](https://sketchfab.com/3d-models/casco-celtibero-ec3a3a3a030d4750a2ff7690fe61f82b) | CC BY 4.0 | 20432 | faces=20432 ncomp=1 bratio=0 | NEEDS ORIENTATION |
| Roman Cavalry Harness Pendant from Maastricht (`roman/roman-cavalry-pendant-maastricht-35a51a`) | [source](https://sketchfab.com/3d-models/roman-cavalry-pendant-35a51a1d0cac4f2188d28a7d790ce798) | CC BY 4.0 | 34311 | faces=34311 ncomp=2 bratio=0.021 | NEEDS ORIENTATION |
| Iron Spearhead from Diersheim (`europe/iron-spearhead-diersheim-blm-c-11423-b-2fbff8`) | [source](https://sketchfab.com/3d-models/lanzenspitze-2fbff8aeb75d4933979256e857a1d941) | CC BY-SA 4.0 | 100000 | faces=100000 ncomp=2 bratio=0.003 | NEEDS ORIENTATION |
| Bronze Dagger from Luristan (`ancient-near-east/luristan-bronze-dagger-mia-76-73-6-f29de0`) | [source](https://sketchfab.com/3d-models/bronze-dagger-900-400-bce-f29de0460b704b7182a1a5495e915a97) | CC0 1.0 | 64000 | faces=64000 ncomp=48 bratio=0 | NEEDS ORIENTATION |
| Dish with King Hormizd II or Hormizd III Hunting Lions (`ancient-near-east/sasanian-hormizd-lion-hunt-dish-cma-1962-150-57ba61`) | [source](https://sketchfab.com/3d-models/1962150-dish-with-king-hormizd-ii-57ba611b823b4f9691262876d3ebb9a3) | CC0 1.0 | 30084 | faces=30084 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-121.68,0,179.89],"yaw":0} confidence=0.66 |

## Needs Orientation Review

| Piece | Proposed value | Confidence | Reason |
| --- | --- | ---: | --- |
| Montefortino Helmet from Piquete de la Atalaya (`roman/montefortino-helmet-piquete-atalaya-zaragoza-ec3a3a`) | `{"upAxis":"y","modelRotation":[150.89,0,-177.64],"yaw":0}` | 0.5 | Stable-pose solve (pose 2, p=0.14, margin 0.01); ambiguous - review. |
| Roman Cavalry Harness Pendant from Maastricht (`roman/roman-cavalry-pendant-maastricht-35a51a`) | `{"upAxis":"auto","modelRotation":[0,0,0],"yaw":0}` | 0.2 | Stable-pose solve exceeded its time limit; needs human orientation review. |
| Iron Spearhead from Diersheim (`europe/iron-spearhead-diersheim-blm-c-11423-b-2fbff8`) | `{"upAxis":"auto","modelRotation":[0,0,0],"yaw":0}` | 0.2 | Flat/slab shape (likely relief, reclining, or pediment figure) - orientation may be intentional; needs human review. |
| Bronze Dagger from Luristan (`ancient-near-east/luristan-bronze-dagger-mia-76-73-6-f29de0`) | `{"upAxis":"auto","modelRotation":[0,0,0],"yaw":0}` | 0.2 | Flat/slab shape (likely relief, reclining, or pediment figure) - orientation may be intentional; needs human review. |

## Rejected

| Piece | Source | Reason | Integrity |
| --- | --- | --- | --- |
| Naval Ram from the Battle of the Egadi Islands | sketchfab | geometry failed integrity gate | faces=3459670 ncomp=986 bratio=0.001 |

## Per-piece Provenance

- `roman/nijmegen-roman-cavalry-face-helmet-valkhof-xxi-l-4-760424`: subject=Roman horsemen, protective armor, and the face of the soldier; author=Erfgoed Gelderland; accession=XXI.l.4; displayed_at=unknown; dimensions=24.2 × 22.8 cm.
- `roman/montefortino-helmet-piquete-atalaya-zaragoza-ec3a3a`: subject=Roman Republican warfare, helmet making, and Iberian campaigns; author=Museo de Zaragoza; accession=unknown; displayed_at=unknown; dimensions=20.8 × 18 × 26.5 cm; 1,500 g.
- `roman/roman-cavalry-pendant-maastricht-35a51a`: subject=Roman cavalry, horse harness, and military display; author=Centre Ceramique Maastricht; accession=unknown; displayed_at=unknown; dimensions=Approximately 7 × 7 cm.
- `europe/iron-spearhead-diersheim-blm-c-11423-b-2fbff8`: subject=Spear warfare and frontier material culture during the Roman Imperial period; author=Badisches Landesmuseum; accession=C11423b; displayed_at=unknown; dimensions=15.4 × 2.8 × 1.6 cm.
- `ancient-near-east/luristan-bronze-dagger-mia-76-73-6-f29de0`: subject=Ancient edged weapons and Iranian metalworking; author=Minneapolis Institute of Art; accession=76.73.6; displayed_at=Not on view; dimensions=46.36 cm long.
- `ancient-near-east/sasanian-hormizd-lion-hunt-dish-cma-1962-150-57ba61`: subject=Mounted archery, horse equipment and royal power in a Sasanian lion hunt; author=Cleveland Museum of Art; accession=1962.150; displayed_at=Cleveland Museum of Art, Gallery 116 (Islamic); dimensions=4.6 cm high × 20.8 cm diameter; 546 g.

