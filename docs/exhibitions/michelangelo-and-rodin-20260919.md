# The Body Under Pressure — Michelangelo & Rodin

Curated 19 September 2026 for `/exhibitions/michelangelo-and-rodin/`.

The user requested a new exhibition juxtaposing specific works by Michelangelo and Rodin, with the remaining curatorial choices delegated to this session. Twelve existing catalog works form six comparisons. There are no new acquisitions or changes to catalog records, model files, appearance, orientation, scale calibration, or other exhibition selections.

## Curatorial sequence

| Pairing | Michelangelo | Rodin | Reason for the encounter |
| --- | --- | --- | --- |
| Before the movement | David | The Age of Bronze | Standing, shifted weight and the different implications of a raised hand. |
| Thinking with the body | Lorenzo, Duke of Urbino | The Thinker | A documented relationship; hand, head and seated support. |
| A turn becomes a struggle | Rebellious Slave | Adam | Torsion, restraint and the direction of gesture. |
| The folded figure | Crouching Boy | Crouching Woman | Compact volume, overlapping limbs and negative space. |
| The weight of another | Pietà | The Kiss | Contact and shared support in mourning and desire. |
| Where does a body end? | Bearded Captive (SMK cast) | The Walking Man | Unfinished carving and the deliberately assembled fragment. |

## Evidence and interpretation

The exhibition's formal comparisons are curatorial interpretations, grounded in the existing models and rendered views. They are not presented as proof of one-to-one historical influence.

- [Musée Rodin, The Thinker](https://www.musee-rodin.fr/en/musee/collections/oeuvres/thinker) explicitly identifies Michelangelo's Lorenzo and Carpeaux's Ugolino as sources for the pose, and distinguishes the 1880 conception from later enlargement. This supports the second pairing's historical claim.
- [Musée Rodin, Adam](https://www.musee-rodin.fr/en/musee/collections/oeuvres/adam) discusses the Sistine figures and the possible relationship between the planned placement beside the Gates of Hell and the Louvre display of Michelangelo's Slaves. The exhibition preserves that qualification and does not claim Adam copied the Rebellious Slave directly.
- [Musée Rodin, The Age of Bronze](https://www.musee-rodin.fr/en/musee/collections/oeuvres/age-bronze) identifies Auguste Ney as the model and explains the removed spear. The comparison with David is a formal interpretation.
- [Musée Rodin, The Kiss](https://www.musee-rodin.fr/en/musee/collections/oeuvres/kiss) documents Paolo and Francesca, the work's development for the Gates and subsequent independent exhibition.
- [Musée Rodin, The Walking Man](https://www.musee-rodin.fr/en/musee/collections/oeuvres/walking-man) documents the assembly from torso and leg studies related to Saint John the Baptist. Only those directly relevant facts are used.
- Michelangelo's work identities and cast provenance follow the existing catalog, SMK source references and retained ingestion evidence. The accessible SMK record titles identify casts after Crouching Boy and the Vatican Pietà. The current site reader could not fully load several JavaScript-driven institutional records; additional historical claims have therefore not been extrapolated from them.

All of the cited Musée Rodin pages were read during this session. The text uses original paraphrase and visual analysis; it contains no borrowed quotations. Existing attribution and source records remain linked from each artwork.

## Presentation decisions

- Each section presents two independently rotatable models, a shared comparison, a specific looking prompt, separate object notes and a collapsible source list.
- The models remain side by side on narrow screens; the longer notes stack for readability. Mobile controls provide Reset and Expand while direct manipulation rotates the work.
- The introduction states that the views use independent framing, not a common physical scale. Relevant object notes distinguish plaster casts from marble originals and distinguish model, enlargement and cast dates.
- The final comparison treats unfinished carving and the fragment as different processes. It makes no unsupported claim that Michelangelo deliberately abandoned the Captive to express a philosophy of liberation.
- The paired format is optional. Existing exhibitions retain their linear presentation, and the new exhibition participates in the directory, next-exhibition navigation and object-page exhibition links.

## Validation scope

Run `npm run build`, then `node scripts/test-exhibition-comparisons.mjs`. The integration test accepts `CHROME_BIN`, `EXHIBITION_MODEL_MIRRORS` and `EXHIBITION_QA_OUTPUT` for the browser binary, local GLB fixtures and optional screenshots.

Local browser testing uses repository model fixtures because the live site and asset host reject this environment's requests. David matches the recorded SHA-256; The Walking Man matches the unchanged migration manifest; the Bearded Captive uses the current tracked local asset. The Age of Bronze fixture uses its uncompressed pre-CDN repository geometry, so its current CDN bytes are not claimed to have been verified. The fixture substitution affects tests only. Production continues to use the existing catalog asset URLs and rendering settings.

Publication and completed verification are recorded in `STATUS.md`.
