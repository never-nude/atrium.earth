import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spatialAccessFor, displayReferenceFor, viewingReferenceFor } from '../src/lib/spatial-access.mjs';
import { approximateDimensionsFor, parseDimensionText } from '../src/lib/approximate-dimensions.mjs';
import { spatialEligibilityFor } from '../src/lib/spatial-eligibility.mjs';
import { physicalDimensionsFor, referenceScaleFor } from '../src/lib/physical-dimensions.mjs';
const read = file => JSON.parse(fs.readFileSync(new URL('../src/data/'+file+'.json',import.meta.url)));
const catalog=read('catalog'), defaults=read('spatial-display-defaults'), dimensions=read('physical-dimensions'), previews=read('previews'), orientations=read('orientations'), decisions=read('spatial-eligibility');
let available=0, verified=0, approximate=0, chosen=0;
const accessBySlug = new Map();
for(const work of catalog.filter(work=>!work.hidden)) {
  const slug=work.slug, record=dimensions[slug], previewUrl=previews[slug]?.url, orientation=orientations[slug];
  const physical=physicalDimensionsFor(work.dimensions,record,previewUrl,orientation);
  const eligibility=spatialEligibilityFor({slug,record,previewUrl,orientation,spatialReference:physical.spatialReference},decisions[slug]);
  const input={work,record,previewUrl,orientation,spatialReference:physical.spatialReference};
  const estimate=eligibility.enabled?null:approximateDimensionsFor(input);
  const access=spatialAccessFor(eligibility,previewUrl,defaults[slug],estimate,physical.spatialReference);
  accessBySlug.set(slug,access);
  assert.equal(access.enabled,true,slug);available++;
  if(access.verified){verified++;assert.equal(access.status,'verified');assert.equal(access.assetSha256,record.spatial.assetSha256);assert.equal(access.defaultMaxExtentMeters,undefined);assert.deepEqual(access.reference,physical.spatialReference);}
  else if(access.status==='approximate'){
    approximate++;assert.equal(access.reference.estimated,true);assert.ok(access.reference.meters>0);assert.equal(access.defaultMaxExtentMeters,undefined);assert.match(access.note,/actual size may vary/);assert.ok(access.sourceText,slug);
    const box={min:{x:0,y:0,z:0},max:{x:3,y:2,z:1}};
    const ref=viewingReferenceFor(box,access.reference);
    const extent=box.max[ref.axis]*(ref.extentFraction||1);
    assert.ok(Math.abs(referenceScaleFor(box,ref)*extent-ref.meters)<1e-9,slug);
    if(record.spatial){assert.deepEqual(access.reference,{...physical.spatialReference,estimated:true});assert.equal(access.assetSha256,record.spatial.assetSha256);}
  }else{chosen++;assert.equal(access.status,'unknown');assert.ok(defaults[slug],slug);assert.ok([.2,.4,.6,1,1.5].includes(access.defaultMaxExtentMeters),slug);assert.equal(access.assetSha256,undefined);assert.equal(access.reference,undefined);assert.match(access.label,/unknown/);assert.match(access.note,/chosen display size/);assert.match(access.sizeLabel,/longest side/);}
}
assert.equal(available,1046);assert.equal(verified,248);assert.equal(approximate,614);assert.equal(chosen,184);
const dubuffet=accessBySlug.get('modern/dubuffet-la-chiffonniere');
assert.equal(dubuffet.reference.meters,6.7056);assert.equal(dubuffet.reference.axis,'y');assert.equal(dubuffet.status,'approximate');assert.equal(dubuffet.verified,false);
assert.equal(accessBySlug.get('modern/ronchi-le-cheval').reference.meters,2,'Contributor-only listed height establishes a yellow estimate');
assert.equal(accessBySlug.get('sphinx').status,'unknown','A whole-monument height cannot size a cropped head');
assert.equal(accessBySlug.get('michelangelo/moses').status,'unknown','Do not stretch a cropped figure to the complete statue height');
const estimateText=(dimensions,note='')=>approximateDimensionsFor({work:{dimensions,note}});
assert.equal(estimateText('H 21 ft').reference.meters,6.4008);
assert.ok(Math.abs(estimateText('Height 5 1/2 in.').reference.meters-.1397)<1e-12);
assert.equal(estimateText('H 147.5 x W 212 x D 86 cm').reference.meters,1.475);
assert.equal(estimateText('','The sculpture is approximately 3.5 m high.').reference.meters,3.5,'Descriptions supply measurements when dimension fields are empty');
assert.equal(estimateText('','Created in 1978; accession 123.'),null);
assert.equal(estimateText('Mesh bounds: H 130 source units'),null);
assert.equal(estimateText('Larger than life-size'),null);
assert.equal(estimateText('Variable digital scale'),null);
assert.equal(estimateText('59 x 124 x 45 cm').reference.axis,'longest');
assert.equal(estimateText('59 x 124 x 45 cm').reference.meters,1.24);
assert.equal(estimateText('590 mm x 1240 mm x 450 mm').reference.meters,1.24);
assert.equal(estimateText('Height .5 m').reference.meters,.5);
assert.deepEqual(parseDimensionText('H x W x D: 8 x 1 x 3/4 in.').map(m=>m.axis),['height','width','depth']);
const ds='modern/dubuffet-la-chiffonniere';
assert.equal(approximateDimensionsFor({work:catalog.find(w=>w.slug===ds),record:dimensions[ds],previewUrl:'changed.glb',orientation:orientations[ds],spatialReference:dubuffet.reference}).reference,undefined,'A stale reviewed estimate cannot fall back to catalogue text');
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
console.log(`AR/VR access checks passed: ${available} compatible works, ${verified} verified, ${approximate} approximate, ${chosen} unknown; unit conversions, description fallback, actual reference scaling and evidence separation.`);
