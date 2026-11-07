import { createHash } from 'node:crypto';
import { worldCollection } from './world-collection.ts';
import { featuredWorks } from './catalog';
import { withBase } from './urls';
import { shortWorkTitle } from './work-titles';

// Both explorer sizes use one cacheable metadata projection. No model files are
// fetched until a visitor opens an artwork's own viewer.
export const worldPayloadJson = JSON.stringify({
  places: worldCollection.places,
  dateMin: worldCollection.dateMin,
  dateMax: worldCollection.dateMax,
  works: worldCollection.works.map(work => {
    const title = shortWorkTitle(work.title);
    return {slug:work.slug,title,...(title !== work.title ? {fullTitle:work.title} : {}),maker:work.maker,dateLabel:work.dateLabel,start:work.start,end:work.end,placeId:work.placeId,thumbnail:withBase(work.thumbnail),url:withBase(work.url)};
  }),
  featured: featuredWorks.map(work => work.slug),
});
export const worldPayloadVersion = createHash('sha256').update(worldPayloadJson).digest('hex').slice(0,16);
export const worldPayloadUrl = withBase(`/world/collection.json?v=${worldPayloadVersion}`);
