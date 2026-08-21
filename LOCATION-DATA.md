# Object location data

Atrium keeps the original object’s history separate from the location of its 3D capture or plaster cast.

`src/data/object-locations.json` is generated and contains one record for every public work:

- `origin` is shown only when a source explicitly supplies a findspot, place made, original installation, archaeological site, or provenance statement. The relationship is retained in the text and in `origin_type`.
- `current` names the original object’s documented present display or holding institution. `current_type` distinguishes `display`, `holding`, `not_on_view`, and `undocumented`.
- `source_url` is the record used for the location facts.
- `checked` records when time-sensitive display information was retrieved.

Never derive origin from an artist’s nationality, culture, title, department, period, or current museum. Preserve uncertainty words and question marks. A blank origin becomes “Not documented by source” on the public label.

Official SMK, Met, Minneapolis Institute of Art, and embedded Smithsonian records are refreshed by:

```bash
npm run data:locations
```

Set `LOCATION_AS_OF=YYYY-MM-DD` when reproducing a refresh performed on that date. If a remote API fails transiently, the updater preserves that work's last audited record and its earlier `checked` date; `LOCATION_STRICT=1` instead aborts on any remote failure. Manual overrides likewise retain their prior `checked` date until deliberately re-audited.

Source-backed records that cannot be refreshed through those public APIs live in `src/data/object-location-overrides.json`. Review changes to that file as editorial data, not as generated output.

Validate key coverage, semantic types, source URLs, and retrieval dates with:

```bash
npm run verify:locations
```
