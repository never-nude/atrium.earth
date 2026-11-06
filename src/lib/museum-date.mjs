import { parseProgrammeDate } from './museum-programme.mjs';

// Resolve once for the entire build/server process. A QA override accepts only
// a real YYYY-MM-DD calendar day; production uses the current UTC day.
const override = process.env.ATRIUM_PROGRAMME_DATE;
export const programmeDate = parseProgrammeDate(override === undefined ? new Date().toISOString().slice(0, 10) : override);
