import fs from 'node:fs';
import path from 'node:path';
import { physicalDimensionsFor } from '../src/lib/physical-dimensions.mjs';
import { spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';
import { approximateDimensionsFor } from '../src/lib/approximate-dimensions.mjs';
import { spatialAccessFor } from '../src/lib/spatial-access.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const catalog=read('catalog'), records=read('physical-dimensions'), previews=read('previews');
const orientations=read('orientations'), decisions=read('spatial-eligibility'), defaults=read('spatial-display-defaults');
const corrections=read('identity-corrections');
const rows = catalog.filter(work=>!work.hidden).map(raw=>{
  const work={...raw,...corrections[raw.slug]?.catalog};
  const slug=work.slug, record=records[slug], previewUrl=previews[slug]?.url, orientation=orientations[slug];
  const physical=physicalDimensionsFor(work.dimensions,record,previewUrl,orientation);
  const input={slug,work,record,previewUrl,orientation,spatialReference:physical.spatialReference};
  const eligibility=spatialEligibilityFor(input,decisions[slug]);
  const approximation=eligibility.enabled?null:approximateDimensionsFor(input);
  const access=spatialAccessFor(eligibility,previewUrl,defaults[slug],approximation,physical.spatialReference);
  return {slug,title:corrections[slug]?.title||work.title,status:access.status,
    sizeLabel:access.sizeLabel,reference:access.reference||null,
    defaultMaxExtentMeters:access.defaultMaxExtentMeters,
    method:eligibility.enabled?'verified-reference':approximation?.method||'display-default',
    sourceText:access.sourceText||record?.dimensions||work.dimensions||'',
    sourceUrl:access.sourceUrl||record?.sourceUrl||'',
    assetSha256:access.assetSha256,note:access.note};
});
const counts=Object.fromEntries(['verified','approximate','unknown'].map(status=>[status,rows.filter(row=>row.status===status).length]));
const result={policy:'Three dimension statuses; estimates never authorize verified dimensions.',counts,total:rows.length,works:rows};
const output=process.argv[2];
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({total:rows.length,counts,output:output||null}));
