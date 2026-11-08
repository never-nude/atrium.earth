import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exhibitionJourney, worldJourney, worldWorkHref } from '../src/lib/work-journey.mjs';

const entries = ['a','b','c'].map(slug=>({slug,title:slug.toUpperCase()}));
const exhibitions = [{slug:'surface',title:'Surface',works:entries}];
const visits = [{exhibition:'surface',id:'six',title:'Six ways',stops:entries}];
test('guided records keep stop order and return to that stop without cycling',()=>{
  const current = exhibitionJourney('?exhibition=surface&visit=six&stop=2','b',exhibitions,visits,'/museum/');
  assert.equal(current.returnHref,'/museum/exhibitions/surface/?visit=six&stop=2#curated-visit');
  assert.equal(current.next.href,'/museum/works/c/?exhibition=surface&visit=six&stop=3');
  assert.equal(exhibitionJourney('?exhibition=surface&visit=six&stop=1','a',exhibitions,visits).previous,null);
  assert.equal(exhibitionJourney('?exhibition=surface&visit=six&stop=3','c',exhibitions,visits).next,null);
});
test('ordinary exhibitions use membership and reject wrong, repeated or stale route parameters',()=>{
  assert.match(exhibitionJourney('?exhibition=surface','b',exhibitions,visits).next.href,/c\/\?exhibition=surface$/);
  for (const query of ['?exhibition=unknown','?exhibition=surface&exhibition=surface','?exhibition=surface&visit=missing','?exhibition=surface&visit=six&stop=1','?exhibition=https://evil.example']) assert.equal(exhibitionJourney(query,'b',exhibitions,visits),null);
  assert.equal(exhibitionJourney('?exhibition=surface','absent',exhibitions,visits),null);
});
const world = {places:[{id:'egypt',label:'Egypt'}],dateMin:-4000,dateMax:2026,featured:['b'],works:[
  {slug:'a',title:'A',placeId:'egypt',start:-2000,end:-1900,url:'/works/a/'},
  {slug:'b',title:'B',placeId:'egypt',start:-100,end:100,url:'/works/b/'},
  {slug:'c',title:'C',placeId:'egypt',start:null,end:null,url:'/works/c/'},
  {slug:'d',title:'D',placeId:null,start:-100,end:100,url:'/works/d/'},
]};
test('world returns to exact place, timeline and map mode, with filtered neighbours',()=>{
  const query='?origin=world&place=egypt&from=-200&to=200&mode=map';
  const only = worldJourney(query,'b',world,'https://atrium.earth/works/b/');
  assert.equal(only.returnHref,'/world/?place=egypt&from=-200&to=200&mode=map#world-results');
  assert.equal(only.next,null); assert.equal(only.previous,null);
  assert.equal(worldJourney(query,'c',world,'https://atrium.earth/'),null);
  assert.equal(worldJourney('?origin=world&place=egypt','b',world,'https://atrium.earth/').next.title,'A');
  assert.equal(worldJourney('?origin=world&place=__unplaced__','d',world,'https://atrium.earth/').next,null);
});
test('world handoff never accepts arbitrary external destinations',()=>{
  const href=worldWorkHref('https://evil.example/',{all:true,mode:'globe'},world,'https://atrium.earth/');
  assert.equal(href,'/world/?mode=globe&origin=world');
});
