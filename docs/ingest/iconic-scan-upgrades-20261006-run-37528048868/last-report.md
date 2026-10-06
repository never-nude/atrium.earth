# Atrium Auto Ingest Report

Generated: 2026-10-06T20:52:02.441Z
Accepted: 8
Rejected: 0
Needs orientation: 3

## Accepted Pieces

| Piece | Source | License | Tri-count | Integrity | Orientation |
| --- | --- | --- | ---: | --- | --- |
| David (`michelangelo/david`) | [source](https://commons.wikimedia.org/wiki/File:David_(Michelangelo).stl) | CC BY-SA 4.0 | 1199948 | faces=1199948 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-89.47,5.45,-5.5],"yaw":0} confidence=0.57 |
| Pietà (SMK Plaster Cast, KAS115) (`michelangelo/pieta`) | [source](https://open.smk.dk/artwork/image/KAS115) | Public Domain Mark 1.0 | 1498118 | faces=1498118 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-179.76,0,-179.91],"yaw":0} confidence=0.75 |
| Moses (SMK Plaster Cast, KAS243) (`michelangelo/moses`) | [source](https://open.smk.dk/artwork/image/KAS243) | Public Domain Mark 1.0 | 2000090 | faces=2000090 ncomp=1 bratio=0 | NEEDS ORIENTATION |
| Venus de Milo (SMK Plaster Cast, KAS434/1) (`venus-de-milo`) | [source](https://commons.wikimedia.org/wiki/File:Venus_(Afrodite)_fra_Milo_-_KAS434_1.stl) | CC0 1.0 | 2742586 | faces=2742586 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-114,0,-1.46],"yaw":0} confidence=0.75 |
| Discobolus, Roman Copy with Modern Head (SMK Plaster Cast, KAS1549) (`discobolus`) | [source](https://commons.wikimedia.org/wiki/File:Diskoskasteren_(Discobolos)_-_KAS1549.stl) | CC0 1.0 | 2016994 | faces=2016994 ncomp=1 bratio=0 | NEEDS ORIENTATION |
| Laocoön and His Sons (SMK Historical Straight-Arm Plaster Cast, KAS385) (`laocoon`) | [source](https://commons.wikimedia.org/wiki/File:Ubekendt,_Laokoon_og_hans_to_s%C3%B8nner_dr%C3%A6bes_af_slanger,_,_KAS385,_Statens_Museum_for_Kunst,_3D_model.stl) | Public Domain Mark 1.0 | 1000000 | faces=1000000 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-90.03,0,173.63],"yaw":0} confidence=0.78 |
| Dying Gladiator (Dying Gaul), SMK Plaster Cast, KAS1312 (`dying-gaul`) | [source](https://open.smk.dk/artwork/image/KAS1312) | Public Domain Mark 1.0 | 4000020 | faces=4000020 ncomp=1 bratio=0 | NEEDS ORIENTATION |
| Belvedere Torso (SMK Plaster Cast, KAS402) (`belvedere-torso`) | [source](https://open.smk.dk/artwork/image/KAS402) | Public Domain Mark 1.0 | 1020430 | faces=1020430 ncomp=1 bratio=0 | auto {"upAxis":"y","modelRotation":[-176,0,-28.73],"yaw":0} confidence=0.62 |

## Needs Orientation Review

| Piece | Proposed value | Confidence | Reason |
| --- | --- | ---: | --- |
| Moses (SMK Plaster Cast, KAS243) (`michelangelo/moses`) | `{"upAxis":"y","modelRotation":[174.24,0,22.13],"yaw":0}` | 0.57 | Stable-pose solve (pose 0, p=0.28, margin 0.17); ambiguous - review. |
| Discobolus, Roman Copy with Modern Head (SMK Plaster Cast, KAS1549) (`discobolus`) | `{"upAxis":"y","modelRotation":[179.19,0,-84.74],"yaw":0}` | 0.54 | Stable-pose solve (pose 0, p=0.61, margin 0.10); ambiguous - review. |
| Dying Gladiator (Dying Gaul), SMK Plaster Cast, KAS1312 (`dying-gaul`) | `{"upAxis":"y","modelRotation":[167.56,0,-3.22],"yaw":0}` | 0.57 | Stable-pose solve (pose 0, p=0.33, margin 0.16); ambiguous - review. |

## Per-piece Provenance

- `michelangelo/david`: subject=Sculpture; author=Scan the World; accession=Inv. Scult. n. 1076; displayed_at=Galleria dell'Accademia di Firenze; dimensions=H 517 cm.
- `michelangelo/pieta`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS115; displayed_at=unknown; dimensions=H 176 cm × W 170 cm × D 89 cm.
- `michelangelo/moses`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS243; displayed_at=unknown; dimensions=H 249 cm × W 110 cm × D 107 cm.
- `venus-de-milo`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS434/1; displayed_at=unknown; dimensions=H 213.5 cm × W 66.5 cm × D 63 cm.
- `discobolus`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS1549; displayed_at=Room 120 (SMK Shop), Statens Museum for Kunst, Copenhagen; dimensions=H 170 cm × W 115 cm × D 50 cm.
- `laocoon`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS385; displayed_at=unknown; dimensions=H 242 cm × W 162.5 cm × D 103 cm.
- `dying-gaul`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS1312; displayed_at=unknown; dimensions=H 96 cm × W 185 cm × D 89 cm.
- `belvedere-torso`: subject=Sculpture; author=Statens Museum for Kunst; accession=KAS402; displayed_at=unknown; dimensions=H 122 cm × W 79 cm × D 90 cm.

