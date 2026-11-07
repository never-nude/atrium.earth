import { isWingId, wings, type WingId } from '../data/wings.ts';
import { legacyWingRoutes } from '../data/wing-legacy-routes.ts';
import worldPlaces from '../data/world-places.json' with { type: 'json' };

type OriginFields = {
  wing?: string | null;
  wing_unfiled_reason?: string | null;
  region?: string | null;
  collection?: string | null;
  place?: string | null;
  geography?: string | null;
  origin_country?: string | null;
  original_location?: string | null;
  culture?: string | null;
  museum?: string | null;
  current_location?: string | null;
  displayed_at?: string | null;
};
export type WingAssignmentInput = OriginFields & {
  slug?: string;
  id?: string;
  data?: OriginFields;
};

function normalized(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').trim();
}
function escaped(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

type GeographicAlias = { value: string; wing: WingId | null; pattern: RegExp };
const aliasRows: GeographicAlias[] = [];
for (const place of worldPlaces.places) {
  // Bare Russia spans two continents. Near East has inconsistent historical
  // boundaries. A reviewed wing or a more specific region must resolve these.
  if (place.id === 'russia') continue;
  const wing = isWingId(place.region.toLowerCase()) ? place.region.toLowerCase() as WingId : null;
  for (const alias of place.aliases) {
    const value = normalized(alias);
    aliasRows.push({
      value, wing: place.id === 'ancient-near-east' ? null : wing,
      pattern: new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped(value)})(?=$|[^\\p{L}\\p{N}])`, 'gu'),
    });
  }
}

// Bounded geographic cultural scopes, read only from the culture field. Never
// apply this vocabulary to artists, titles, notes, museums or raw search text.
const culturalScopes: Record<WingId, string[]> = {
  europe: ['European', 'French', 'Italian', 'German', 'Polish', 'Danish', 'Swedish', 'Norwegian', 'Finnish', 'British', 'English', 'Scottish', 'Irish', 'Welsh', 'Spanish', 'Portuguese', 'Dutch', 'Flemish', 'Belgian', 'Austrian', 'Swiss', 'Czech', 'Romanian', 'Bulgarian', 'Hungarian', 'Etruscan', 'Attic', 'Cycladic', 'Andalusi', 'Gumelnita'],
  asia: ['Asian', 'Chinese', 'Japanese', 'Korean', 'Indian', 'Tibetan', 'Nepalese', 'Nepali', 'Cambodian', 'Khmer', 'Thai', 'Vietnamese', 'Indonesian', 'Javanese', 'Balinese', 'Iranian', 'Persian', 'Sogdian', 'Mesopotamian', 'Assyrian', 'Babylonian', 'Sumerian', 'Anatolian', 'Palmyrene', 'Joseon', 'Goryeo'],
  africa: ['African', 'Egyptian', 'Nigerian', 'Yoruba', 'Edo (Kingdom of Benin)', 'Edo, Kingdom of Benin', 'Baule', 'Fang', 'Senufo', 'Dogon', 'Kongo', 'Kuba', 'Guro', 'Bamileke', 'Bamum', 'Bamana', 'Bambara', 'Luba', 'Lulua', 'Songye', 'Makonde', 'Chokwe', 'Dan peoples', 'Baga', 'Mende', 'Akan', 'Asante', 'Ashanti', 'Igbo', 'Tuareg', 'Bwa', 'Kota', 'Lobi', 'Djenne'],
  americas: ['American', 'Mesoamerican', 'Moche', 'Inca', 'Maya', 'Mayan', 'Aztec', 'Zapotec', 'Nazca', 'Nasca', 'Mapuche', 'Diaguita', 'Taino', 'Mexican', 'Peruvian', 'Colombian', 'Ecuadorian', 'Bolivian', 'Brazilian', 'Canadian', 'Inuit', 'Haida', 'Tlingit', 'Olmec', 'Veracruz', 'Chimu', 'Chancay', 'Paracas'],
  oceania: ['Oceanian', 'Polynesian', 'Melanesian', 'Micronesian', 'Rapa Nui', 'Maori', 'Sawos', 'Abelam', 'Asmat', 'Malagan', 'Australian Aboriginal'],
};
const cultureAliases: GeographicAlias[] = Object.entries(culturalScopes).flatMap(([wing, values]) => values.map((alias) => {
  const value = normalized(alias);
  return { value, wing: wing as WingId, pattern: new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped(value)})(?=$|[^\\p{L}\\p{N}])`, 'gu') };
}));

const holdingLanguage = /\b(museum|musee|museu|museo|gallery|collection|institute|library|university|smithsonian|captur\w*|scan\w*|display\w*|held|repository|nationality|artist)\b/u;
const derivativeLanguage = /\b(after|inspired|prototype|composition|copy of|cast after)\b/u;

/** Undefined: no evidence. Null: explicit cross-region ambiguity. */
function continentFor(value: unknown, culture = false): WingId | null | undefined {
  const text = normalized(value);
  if (!text || holdingLanguage.test(text) || derivativeLanguage.test(text)) return undefined;
  const matches: { start: number; end: number; wing: WingId | null }[] = [];
  for (const alias of culture ? [...aliasRows, ...cultureAliases] : aliasRows) {
    alias.pattern.lastIndex = 0;
    for (const match of text.matchAll(alias.pattern)) {
      const start = match.index! + match[1].length;
      matches.push({ start, end: start + match[2].length, wing: alias.wing });
    }
  }
  // Rapa Nui (Chile) is a geographic regional scope, distinct from its current
  // political country. Prefer the longest non-overlapping explicit alias.
  matches.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const accepted: typeof matches = [];
  for (const match of matches) {
    if (!accepted.some((other) => match.start < other.end && match.end > other.start)) accepted.push(match);
  }
  if (!accepted.length) return undefined;
  const regions = new Set(accepted.map((match) => match.wing));
  return regions.size === 1 && !regions.has(null) ? [...regions][0] : null;
}

/** One geographic primary home, using corrected raw metadata only. */
export function assignWing(work: WingAssignmentInput): WingId | 'unfiled' {
  const data = work.data ?? {};
  const override = data.wing ?? work.wing;
  if (override === 'unfiled' || normalized(data.wing_unfiled_reason ?? work.wing_unfiled_reason)) return 'unfiled';
  if (isWingId(override)) return override;
  // Legacy mixed/historical wings must be evaluated again, not mapped whole.
  if (normalized(override) && !Object.hasOwn(legacyWingRoutes, String(override))) return 'unfiled';

  const holdingPlaces = [data.museum, work.museum, data.current_location, work.current_location, data.displayed_at, work.displayed_at].map(normalized).filter(Boolean);
  const geography = [data.origin_country, work.origin_country, data.place, data.geography, work.place, work.geography, data.original_location, work.original_location];
  const geographicResults = geography.filter((value) => !holdingPlaces.includes(normalized(value)))
    .map((value) => continentFor(value)).filter((value) => value !== undefined);
  if (geographicResults.length) {
    const continents = new Set(geographicResults);
    return continents.size === 1 && !continents.has(null) ? geographicResults[0]! : 'unfiled';
  }

  const cultureResults = [data.culture, work.culture].map((value) => continentFor(value, true)).filter((value) => value !== undefined);
  if (cultureResults.length) {
    const continents = new Set(cultureResults);
    return continents.size === 1 && !continents.has(null) ? cultureResults[0]! : 'unfiled';
  }

  const slug = normalized(work.slug ?? work.id);
  const scopes = [data.region, data.collection, work.region, work.collection, slug.includes('/') ? slug.split('/')[0] : ''].map(normalized).filter(Boolean);
  const matches = wings.filter((wing) => wing.match.region?.some((region) => scopes.includes(normalized(region))));
  return matches.length === 1 ? matches[0].id : 'unfiled';
}
