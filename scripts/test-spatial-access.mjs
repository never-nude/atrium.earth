import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spatialAccessFor, displayReferenceFor } from '../src/lib/spatial-access.mjs';
import { spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';
import { physicalDimensionsFor, referenceScaleFor } from '../src/lib/physical-dimensions.mjs';
const read = file => JSON.parse(fs.readFileSync(new URL('../src/data/'+file+'.json',import.meta.url)));
const catalog=read('catalog'), defaults=read('spatial-display-defaults'), dimensions=read('physical-dimensions'), previews=read('previews'), orientations=read('orientations'), decisions=read('spatial-eligibility');
let available=0, verified=0, chosen=0;
for(const work of catalog.filter(work=>!work.hidden)) {
  const slug=work.slug, record=dimensions[slug], previewUrl=previews[slug]?.url, orientation=orientations[slug];
  const physical=physicalDimensionsFor(work.dimensions,record,previewUrl,orientation);
  const eligibility=spatialEligibilityFor({slug,record,previewUrl,orientation,spatialReference:physical.spatialReference},decisions[slug]);
  const access=spatialAccessFor(eligibility,previewUrl,defaults[slug]);
  assert.equal(access.enabled,true,slug);available++;
  if(access.verified){verified++;assert.equal(access.assetSha256,record.spatial.assetSha256);assert.equal(access.defaultMaxExtentMeters,undefined);}
  else {chosen++;assert.ok(defaults[slug],slug);assert.ok([.2,.4,.6,1,1.5].includes(access.defaultMaxExtentMeters),slug);assert.equal(access.assetSha256,undefined);assert.match(access.label,/unverified/);assert.match(access.note,/not a verified real-world measurement/);assert.match(access.sizeLabel,/longest side/);}
}
assert.equal(available,1046);assert.equal(verified,248);assert.equal(chosen,798);assert.equal(Object.keys(defaults).length,798);
for(const axis of ['x','y','z'])for(const meters of [.2,.4,.6,1,1.5]){
  const box={min:{x:-1,y:-1,z:-1},max:{x:1,y:1,z:1}};box.max[axis]=5;
  const reference=displayReferenceFor(box,meters);assert.equal(reference.axis,axis);assert.equal(reference.displayDefault,true);
  assert.ok(Math.abs(referenceScaleFor(box,reference)*6-meters)<1e-12,'Actual longest dimension matches chosen display size');
}
assert.equal(displayReferenceFor({min:{x:0,y:0,z:0},max:{x:0,y:0,z:0}},1),null);
assert.equal(displayReferenceFor(null,1),null);
for(const value of [0,-1,NaN,Infinity])assert.equal(displayReferenceFor({min:{x:0,y:0,z:0},max:{x:1,y:1,z:1}},value),null);
assert.equal(spatialAccessFor(null,'javascript:bad.glb').enabled,false);
assert.equal(spatialAccessFor(null,'').enabled,false);
assert.equal(spatialAccessFor({enabled:false},'https://models.atrium.earth/example.glb').defaultMaxExtentMeters,1);
console.log(`AR/VR access checks passed: ${available} compatible works, ${verified} strict references, ${chosen} explicit display defaults; longest-axis sizing and evidence separation.`);
