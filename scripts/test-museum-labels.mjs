import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';
import { museumLabelFor } from '../src/lib/museum-label.mjs';

assert.deepEqual(museumLabelFor({ title: ' A work ', maker: 'Unknown', displayDate: 'Undated', era: 'Bronze Age', geography: 'Region', medium: 'Bronze', materialAppearance: 'Marble' }),
  { title: 'A work', maker: '', period: 'Bronze Age', region: 'Region', material: 'Bronze' });
assert.equal(museumLabelFor({ maker: 'Unknown Paleolithic artist' }).maker, 'Unknown Paleolithic artist');
const output = '/tmp/atrium-museum-label-tests';
await mkdir(output, { recursive: true });
const works = new URL('../dist/works/', import.meta.url);
const records = (await Promise.all((await readdir(works, { recursive: true })).filter(p => p.endsWith('/index.html'))
  .map(async p => (await readFile(new URL(p, works), 'utf8')).match(/data-museum-label-json="([^"]+)"/)?.[1]))).filter(Boolean);
assert.ok(records.length >= 1046, 'Build includes labels across the catalogue');
const server = await dev({ root: new URL('../', import.meta.url), devToolbar: { enabled: false }, server: { host: '127.0.0.1', port: 4338 },
  vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.ATRIUM_TEST_EXECUTABLE, headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'xr', { configurable: true, value: undefined });
    window.shareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.shareCalls.push({ title: data.title, name: data.files[0].name, active: navigator.userActivation.isActive });
      if (window.rejectShare) throw new DOMException('Sharing denied', 'NotAllowedError');
    } });
  });
  const page = await context.newPage();
  const errors = [], cameraRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/external\/xr|8thwall|spatial-browser-ar/.test(request.url())) cameraRequests.push(request.url()); });
  await page.goto('http://127.0.0.1:4338/works/europe/venus-of-willendorf-nhmw-44-686/');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-spatial-url]')?.value));
  await page.locator('[data-spatial-open]').tap();
  const label = JSON.parse(await page.locator('[data-spatial]').getAttribute('data-museum-label-json'));
  assert.equal(label.title, 'Venus of Willendorf');
  assert.equal(label.maker, 'Unknown Paleolithic artist');
  assert.match(label.region, /Lower Austria/);
  assert.match(label.material, /limestone/);
  assert.equal(await page.locator('.spatial-artwork-label [data-museum-title]').textContent(), label.title);
  await page.screenshot({ path: `${output}/entry-portrait.png` });

  const pure = await page.evaluate(async ({ records, label }) => {
    const { captionMuseumPhoto, paintMuseumPhotoLabel, layoutMuseumPhotoLabel, museumLabelLines } = await import('/src/lib/museum-label.mjs');
    const decoder = document.createElement('textarea');
    window.museumRecords = records.map(record => { decoder.innerHTML = record; return JSON.parse(decoder.value); });
    const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 844;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#a6aaa4'; ctx.fillRect(0,0,390,844);
    const left = captionMuseumPhoto(canvas, label, 'left');
    const right = captionMuseumPhoto(canvas, label, 'right');
    const leftLayout = layoutMuseumPhotoLabel(ctx, label,390,844,'left');
    const rightLayout = layoutMuseumPhotoLabel(ctx,label,390,844,'right');
    // The independent source remains untouched; placement does not stamp twice.
    const original = [...ctx.getImageData(25,800,1,1).data];
    const transparent = document.createElement('canvas'); transparent.width=390;transparent.height=844;
    paintMuseumPhotoLabel(transparent.getContext('2d'),leftLayout);
    const pixels=transparent.getContext('2d').getImageData(0,0,390,844).data;
    let ink=0; for(let i=3;i<pixels.length;i+=4) if(pixels[i])ink++;
    let checked = 0;
    for(const record of window.museumRecords) for(const [w,h] of [[390,844],[844,390],[568,320]]) {
      const layout=layoutMuseumPhotoLabel(ctx,record,w,h);
      if(layout.x<0||layout.y<0||layout.x+layout.width>w||layout.y+layout.height>h||layout.height>h*.35)
        throw new Error('Label exceeds image bounds: '+record.title);
      if(layout.rows.map(row=>row.text).join('').replace(/\s/g,'')!==museumLabelLines(record).join('').replace(/\s/g,''))
        throw new Error('Label dropped facts: '+record.title);
      checked++;
    }
    window.photoSourceData=canvas.toDataURL('image/png');
    return {checked,original,ink,blank:[...transparent.getContext('2d').getImageData(0,0,1,1).data],
      source:canvas.toDataURL(),left:left.toDataURL(),right:right.toDataURL(),leftX:leftLayout.x,rightX:rightLayout.x};
  }, { records, label });
  assert.ok(pure.ink>300 && pure.ink<390*844*.08, 'Caption has text and a close halo, without a background panel');
  assert.deepEqual(pure.blank,[0,0,0,0]);
  assert.deepEqual(pure.original,[166,170,164,255]);
  assert.notEqual(pure.left,pure.right); assert.ok(pure.rightX>pure.leftX);
  console.log('Catalogue photo layouts checked:',pure.checked);
  await page.locator('[data-museum-photo-input]').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(pure.source.split(',')[1],'base64')});
  await page.locator('[data-museum-photo-save]:not([hidden])').waitFor();
  assert.equal(await page.locator('.spatial-panel').isVisible(),false);
  for(const [width,height] of [[390,844],[320,568],[844,390],[568,320]]) {
    await page.setViewportSize({width,height});
    assert.ok(await page.locator('[data-spatial-dialog]').evaluate(el=>el.scrollWidth<=el.clientWidth),'Editor fits narrow screens');
    await page.locator('[data-museum-photo-save]').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('[data-museum-photo-save]').evaluate(el=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),'Download is reachable');
    await page.screenshot({path:`${output}/photo-editor-${width}.png`});
  }
  const first = await page.locator('[data-museum-photo-preview]').getAttribute('src');
  await page.locator('[data-museum-photo-position="right"]').tap();
  await page.waitForFunction(before=>document.querySelector('[data-museum-photo-preview]').getAttribute('src')&&document.querySelector('[data-museum-photo-preview]').getAttribute('src')!==before,first);
  assert.equal(await page.locator('[data-museum-photo-position="right"]').getAttribute('aria-pressed'),'true');
  const exported = await page.evaluate(async()=>[...new Uint8Array(await(await fetch(document.querySelector('[data-museum-photo-save]').href)).arrayBuffer())]);
  await writeFile(`${output}/captioned-portrait.jpg`,Buffer.from(exported));
  await page.locator('[data-museum-photo-share]').tap();
  assert.equal(await page.evaluate(()=>window.shareCalls[0].active),true,'Share sheet starts inside the tap');
  await page.evaluate(()=>{window.rejectShare=true;});
  await page.locator('[data-museum-photo-share]').tap();
  await page.waitForFunction(()=>document.querySelector('[data-museum-photo-status]').textContent.includes('Download photo'));
  assert.ok(await page.locator('[data-museum-photo-save]').isVisible());

  // iPhone JPEGs often encode portrait pixels plus a landscape EXIF transform.
  const jpeg = await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=900;const x=c.getContext('2d');x.fillStyle='#c81414';x.fillRect(0,0,600,900);x.fillStyle='#14c814';x.fillRect(0,450,600,450);return c.toDataURL('image/jpeg',1);});
  const bytes=Buffer.from(jpeg.split(',')[1],'base64');
  const exif=Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000','hex');
  await page.locator('[data-museum-photo-input]').setInputFiles({name:'landscape.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([bytes.subarray(0,2),exif,bytes.subarray(2)])});
  await page.waitForFunction(()=>{const p=document.querySelector('[data-museum-photo-preview]');return p.naturalWidth===900&&!document.querySelector('[data-museum-photo-save]').hidden;});
  assert.equal(await page.locator('[data-museum-photo-preview]').evaluate(el=>el.naturalHeight),600);
  const rotated = await page.locator('[data-museum-photo-preview]').evaluate(img=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');x.drawImage(img,0,0);return [...x.getImageData(10,10,1,1).data];});
  assert.ok(rotated[1]>150&&rotated[0]<50,'EXIF rotation is applied before the caption');
  await page.screenshot({path:`${output}/landscape-photo.png`});
  await page.locator('[data-museum-photo-input]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.waitForFunction(()=>document.querySelector('[data-museum-photo-status]').textContent.includes('could not be opened'));
  assert.equal(await page.locator('[data-museum-photo-save]').isVisible(),false,'Failed imports cannot offer a previous photo');
  await page.locator('[data-museum-photo-back]').tap();
  assert.ok(await page.locator('.spatial-panel').isVisible());
  assert.equal(await page.locator('[data-spatial-overlay]').isVisible(),false);
  assert.deepEqual(cameraRequests,[],'Photo labeling cannot replace the native camera');
  await page.locator('[data-spatial-close]').tap();

  // A WebXR fixture exercises only public session and placement callbacks.
  // Camera matrices, orientation and tracked anchors remain native-owned.
  await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {bindSpatialViewing}=await import('/src/lib/spatial-viewer.mjs');
    const original=document.querySelector('[data-spatial]');const el=original.cloneNode(true);original.replaceWith(el);
    const scene=new THREE.Scene(),model=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,1,.01,100);
    model.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.1),new THREE.MeshStandardMaterial()));
    const ground=new THREE.Object3D(),grid=new THREE.Object3D();scene.add(model,ground,grid);
    const session=new EventTarget();session.requestReferenceSpace=async()=>({});session.requestHitTestSource=async()=>({cancel(){}});session.end=async()=>session.dispatchEvent(new Event('end'));
    const renderer={xr:{enabled:false,setReferenceSpaceType(){},async setSession(){},getReferenceSpace(){return {};}},getClearColor(c){return c.set(0);},getClearAlpha(){return 0;},setClearColor(){},render(){},setAnimationLoop(callback){this.loop=callback;}};
    Object.defineProperty(navigator,'xr',{configurable:true,value:{isSessionSupported:async()=>true,requestSession:()=>Promise.resolve(session),addEventListener(){}}});
    const fixture={THREE,scene,model,camera,renderer,ground,grid,box:new THREE.Box3().setFromObject(model),verifiedAsset:true,suspend:()=>()=>{}};
    window.xrFixture={...fixture,session};bindSpatialViewing(el,()=>fixture,()=>{});
  });
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-spatial-open]').tap();
  await page.getByRole('button',{name:'Place in your room',exact:true}).tap();
  await page.waitForFunction(()=>Boolean(window.xrFixture.renderer.loop));
  assert.equal(await page.locator('[data-spatial-museum-hud]').isVisible(),false,'Live label waits for placement');
  await page.evaluate(()=>{const f=window.xrFixture,m=new f.THREE.Matrix4().makeTranslation(.5,-.8,-2);f.renderer.loop(0,{getHitTestResults:()=>[{getPose:()=>({transform:{matrix:m.elements}})}]});f.session.dispatchEvent(new Event('select'));});
  assert.ok(await page.locator('[data-spatial-museum-hud]').isVisible());
  for(const [width,height] of [[390,844],[844,390],[568,320],[320,568],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')));
    assert.deepEqual(await page.evaluate(()=>window.xrFixture.model.parent.parent.position.toArray()),[.5,-.8,-2]);
    const bounds=await page.locator('[data-spatial-museum-hud]').boundingBox();
    assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
    assert.equal(await page.locator('[data-spatial-museum-hud]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    await page.screenshot({path:`${output}/webxr-label-${width}.png`});
  }
  for (const viewport of [{width:568,height:320},{width:320,height:568}]) {
  await page.setViewportSize(viewport);
  const liveCatalogue=await page.evaluate(()=>{
    const hud=document.querySelector('[data-spatial-museum-hud]');
    let maxHeight=0;
    for(const record of window.museumRecords){
      for(const [selector,text] of [['[data-museum-title]',record.title],['[data-museum-maker]',record.maker],['[data-museum-origin]',[record.period,record.region].filter(Boolean).join(' · ')],['[data-museum-material]',record.material]])hud.querySelector(selector).textContent=text;
      const r=hud.getBoundingClientRect(); if(r.top<60)throw new Error('Live label collides with top control: '+record.title);maxHeight=Math.max(maxHeight,r.height);
    }
    return maxHeight;
  });
  console.log('Maximum catalogue live label height:',viewport.width,liveCatalogue);
  }
  await page.locator('[data-spatial-adjust] > summary').tap();
  assert.equal(await page.locator('[data-spatial-museum-hud]').isVisible(),false,'Adjustment panel clears the label');
  await page.locator('[data-spatial-place]').tap();
  assert.equal(await page.locator('[data-spatial-museum-hud]').isVisible(),false);
  assert.equal(await page.locator('[data-spatial-adjust]').getAttribute('open'),null);
  assert.ok(await page.locator('[data-spatial-instructions]').isVisible());
  await page.locator('[data-spatial-exit]').tap();
  await page.waitForFunction(()=>document.querySelector('[data-spatial-overlay]').hidden);
  assert.equal(await page.evaluate(()=>window.xrFixture.model.parent===window.xrFixture.scene),true);
  assert.deepEqual(errors,[]);
  console.log('Museum labels passed: catalogue facts, transparent captions, portrait/landscape layouts, EXIF, corner changes, share/error handling, native-camera isolation and WebXR placement lifecycle.');
} finally {await browser.close();await server.stop();}
