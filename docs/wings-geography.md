# Geographic wings

Atrium has five primary geographic wings: Europe (`europe`), Asia (`asia`), Africa (`africa`), Americas (`americas`) and Oceania (`oceania`). A public work receives exactly one of these assignments or `unfiled`. Historical periods, faiths and artistic themes can cross regional boundaries; they do not create additional primary homes.

## Evidence and precedence

`assignWing` reads source fields **after** identity corrections, not the normalized display geography. Display geography historically includes title, period and collection fallbacks that do not establish an origin.

1. Preserve an explicit reviewed `unfiled` decision or explanation. Preserve existing explicit continental wing assignments as reviewed curatorial scope.
2. Read explicit `origin_country`, `geography`/`place` and non-holding `original_location` fields. Recognized alternatives may resolve to a continent when every alternative belongs to that same continent. Conflicting continental evidence stays unfiled.
3. Use a bounded geographic vocabulary in the recorded `culture` field. A religious label, `Greek` or `Roman` alone does not establish a continent. Specific geographic cultural scopes such as Attic, Etruscan, Khmer, Moche and Yoruba can do so. Bare Edo is excluded because a Japanese period and the Kingdom of Benin share that name.
4. Use existing explicit regional collection scopes (`europe`, `asia`, `africa`, `sub-saharan-africa`, `north-africa`, `egyptian`, `americas`, `oceania`), including their established URL folders, when no more specific continental evidence is available. This describes collection/cultural scope, not a new claim about a cast's manufacture site.
5. Otherwise retain the work in the full collection and unfiled entrance.

Artist nationality, makers' names, titles, notes, search text, present museums, capture locations and institutional collection names are not origin evidence. Strings that identify a holding institution, capture, nationality or derivative/prototype description are excluded. Existing broad mixed overrides (`near-east`, `greece-rome`, `americas-oceania`) are re-evaluated instead of being mapped to one continent.

The geographic alias vocabulary is shared with `world-places.json`, but wing assignments are broader curatorial scopes, not map points. Rapa Nui is treated as Oceania rather than mainland Chile; Greenland and French Guiana remain Americas. Bare Russia requires a more specific region or an existing reviewed continental assignment. Mediterranean, Roman world, Near East alone, and cross-continent alternatives remain unfiled. The world map retains its separate, stricter placement policy.

Existing continental overrides remain important: Franklin retains the reviewed European scope rather than being reassigned from a New York label, while Sakhalin and the Shigir record retain their reviewed Asian scopes. These labels are curatorial grouping decisions and do not revise source provenance.

## Coverage checked 2026-11-07

| Primary result | Public works |
| --- | ---: |
| Europe | 1,067 |
| Asia | 522 |
| Africa | 354 |
| Americas | 340 |
| Oceania | 33 |
| Unfiled | 706 |
| Total | 3,022 |

All 284 pre-existing explicit unfiled decisions are preserved. Another 422 records lack sufficient evidence under this policy. For example, Puck's American maker and Liverpool holding institution do not establish its origin in the fields used by this assignment; generic classical folders and Mediterranean descriptions also remain unresolved. No museum is used to fill these gaps.

The existing 250 reviewed featured memberships remain unchanged: 72 Europe, 40 Asia, 34 Africa, 39 Americas, 5 Oceania and 60 unfiled. Wing entrance rotation continues to select from that reviewed pool with the existing preview budget check. Moving a wing does not expand the reviewed pool, alter exhibition membership or change model/source data.

Retired wing routes are defined separately in `wing-legacy-routes.ts`: Near East leads to Africa and Asia; Greece & Rome leads to Europe, Africa and Asia; Americas & Oceania leads to its two separate wings. They are compatibility entrances, not extra primary assignments or single-continent redirects.

Validation: `npm run test:wings` checks geographic aliases, cross-continent ambiguity, holding/nationality exclusion, historical-folder exclusion, override precedence, identity corrections, hidden records, all public records' single assignments, featured membership and the unchanged 250-work reviewed pool. Source catalog metadata is not mutated.
