# Acquisition results: shortlist 18–35

Four compositions have downloaded GLBs and publication metadata in `ready-records.json`. They need final viewer QA; Undine needs removal of a captured floor. Winter is a Met bronze version of the shortlisted Fabre composition; Undine is the High Museum version of the shortlisted Smithsonian composition. Sluggard material/version is not fully resolved, so omit the tentative material and unknown accession/dimensions from a public record. Night has a reasoned public-domain assessment, separately documented from Polycam’s CC BY 4.0 scan license; the Met image is not being reused.

The other downloaded Undine (D730FEC3-65C5-4F44-8438-6365DF60178E) is **not** the shortlisted composition. Its capture location says Saint Louis Art Museum but an institution record has not been verified. Keep it out of this batch.

## Additional blockers

- Clésinger, Woman Bitten by a Snake: exact Polycam capture 8F145390-CB88-4AE5-9EC9-C6EA78FC306E is public but savable=false. No acquisition attempted. Scan the World version is BY-NC-SA.
- Pajou, Psyche Abandoned: Palazzo Pitti Polycam result belongs to a different composition/artist; not substituted.
- Falconet: Polycam result is Venus of the Doves, a different work.
- Canova: available Paolina Borghese, Naiad, and Three Graces results do not match Mars and Venus.
- Houdon Diana; Powers Eve Disconsolate; Brock Eve; Toft Bather; Épinay Golden Belt; Maillol Méditerranée, Pomona, Summer, Flora, Desire: no verified exact downloadable public mesh in the targeted Polycam searches. Search JSON evidence retained.
- Maillol The River and L’Air: excluded under parent’s existing rights hold.

Public search used Polycam Explore’s publicly published Algolia configuration. Capture artifacts were read only for public savable captures. No credentials, purchase, login gate, or access restriction was bypassed.

## Final derivative

Undine now has `7580762A-B012-42ED-B302-6237B76FC17B/undine-floor-cropped.glb` (7,792,520 bytes). It removes Y<−0.94, covering the captured wood floor and lowest lip of the museum display pedestal; the sculpture’s carved marble base begins around Y=−0.43. Retained geometry and UVs are exact; no simplification. Texture reduced 8192→4096 JPEG quality 88. Root must inspect it in the final viewer.

A last French-title search found two Diane captures. One is abstract imported geometry; the Louvre Diane chasseresse includes a deer and classical drapery, so it is not Houdon’s nude Diana. Neither was acquired.

Sluggard material remains unresolved because Royal Academy records return 403/robots, and the available scholarly documentation identifies a full-size plaster while an exhibition checklist also identifies a smaller bronze. Public record should omit medium/accession/dimensions rather than silently borrow values from another version.
