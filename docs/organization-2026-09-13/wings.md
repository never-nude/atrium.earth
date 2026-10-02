# Wing organization review — 13 September 2026

Reviewed all 1,046 public works, including 540 added since wings were introduced on 4 September. Six works now have reviewed wing overrides in `identity-corrections.json`; their historical slugs, collection folders, source catalog and models remain intact.

| Work | Updated wing | Evidence and rationale |
| --- | --- | --- |
| Bessie Stough Callender, *Torso* | The Americas & Oceania | American maker and United States geography; the `modern` folder previously sent it to Europe. [Smithsonian record](https://americanart.si.edu/artwork/torso-3712). |
| Jim Dine, *Looking Toward the Avenue (Venus)* | The Americas & Oceania | Contemporary New York public sculpture, despite its classical subject. [Exact plaza record](https://apops.mas.org/pops/m050030/). |
| Harriet Hosmer, *Puck* | The Americas & Oceania | Consistent with the same American sculptor’s Rome-made *Zenobia in Chains*, already in this wing. [Walker Art Gallery record](https://www.liverpoolmuseums.org.uk/artifact/puck). |
| *Birds with Foliage* | Greece & Rome | Late-antique Antioch mosaic, grouped with the companion *Elephant Attacking a Feline*. Mia records Roman nationality and Byzantine style. [Museum object data](https://search.artsmia.org/id/1739). |
| Mamluk *Door Panel* | Africa | The museum identifies Egypt/Africa; consistent with the recent Egyptian Islamic woodwork and architecture. [Museum object data](https://search.artsmia.org/id/3216). |
| *The Stargazer* | Egypt & the Ancient Near East | Museum classification is early Bronze Age Western Anatolia and Near Eastern art. The obsolete classical override and Neolithic routing comment are superseded. [Cleveland record](https://www.clevelandart.org/art/1993.165). |

The six existing wing names and routes remain. Their descriptions now reflect contemporary sculpture, everyday objects, North African architecture and late antiquity. Asia no longer claims every work from the Islamic world: geographic wings can connect through exhibits spanning regions. Explicit `africa` and `north-africa` folder matches support future additions. Featured works must belong to their displayed wing.

Folder names such as `modern` still provide legacy European defaults; reviewed overrides resolve known exceptions. Artist-created works with uncertain origin remain pending rather than acquiring an inferred region from a publisher’s location or a subject. `wings.json` records those withheld cases and the six changes with sources.

Validation: `npm run test:wings` passes for all 1,046 public works, with no unfiled entries. The test now applies reviewed identity fields as production does, checks all six corrected assignments, validates every featured work’s wing, and exercises the new Africa folder rules.

| Wing | Public works |
| --- | ---: |
| Egypt & the Ancient Near East | 87 |
| Greece & Rome | 173 |
| Europe | 319 |
| Asia | 192 |
| Africa | 80 |
| The Americas & Oceania | 195 |
