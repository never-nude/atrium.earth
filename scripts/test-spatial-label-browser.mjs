import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'three/examples/jsm/libs/fflate.module.js';

// Runs server + browser together, including environments with per-command networks.
const server = await dev({ root: new URL('../', import.meta.url), server: { host: '127.0.0.1', port: 4334 }, vite: { server: { watch: null, hmr: false } }, logLevel: 'error' });
const base = 'http://127.0.0.1:4334';
const output = process.env.ATRIUM_TEST_OUTPUT || '/tmp/atrium-artwork-label-tests';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.ATRIUM_TEST_EXECUTABLE ? { executablePath: process.env.ATRIUM_TEST_EXECUTABLE } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(30000);
  // Layout and capture fixtures need no remote model, tracking hardware or uploads.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const page = await context.newPage();
  page.on('pageerror',error=>console.error('Page error:',error.message));
  await page.goto(`${base}/works/modern/dubuffet-la-chiffonniere/`);
  await page.waitForFunction(()=>Boolean(document.querySelector('[data-spatial-url]')?.value));
  await page.locator('[data-spatial-open]').click();
  await page.locator('[data-spatial-dialog][open]').waitFor();
  // Let Vite finish lazy viewer imports before exercising the photo controls.
  await page.waitForLoadState('networkidle');
  const label = await page.locator('[data-spatial]').evaluate(el => JSON.parse(el.dataset.artworkLabelJson));
  assert.equal(label.title, 'La Chiffonnière');
  assert.equal(label.maker, 'Jean Dubuffet');
  assert.equal(label.material, 'Stainless steel with black coating');
  const photoData = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 780; canvas.height = 1688;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#769fa7'; ctx.fillRect(0,0,780,1688);
    ctx.fillStyle = '#d5ceb9'; ctx.fillRect(340,300,220,750);
    return canvas.toDataURL('image/png');
  });
  await page.locator('[data-spatial-photo-input]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(photoData.split(',')[1], 'base64') });
  await page.locator('[data-spatial-photo-result]:not([hidden])').waitFor({state:'attached'});
  assert.equal(await page.locator('[data-spatial-photo-panel]').evaluate(el=>el.open),true);
  assert.match(await page.locator('[data-spatial-photo-status]').textContent(), /Label added/);
  const result = await page.evaluate(async () => {
    const image = document.querySelector('[data-spatial-photo-preview]'); await image.decode();
    const canvas = document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0);
    return { width:canvas.width, height:canvas.height, corner:[...ctx.getImageData(50,1600,1,1).data], top:[...ctx.getImageData(10,10,1,1).data], data:canvas.toDataURL('image/png') };
  });
  assert.equal(result.width,780); assert.equal(result.height,1688);
  assert.ok(result.corner[0] < result.top[0], 'Label is baked into decoded photo pixels');
  await writeFile(`${output}/stamped-photo.png`, Buffer.from(result.data.split(',')[1],'base64'));
  await page.screenshot({ path: `${output}/photo-panel.png` });
  // iPhone JPEGs may store portrait pixels with EXIF rotation for a landscape photo.
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width=600; canvas.height=900;
    const ctx=canvas.getContext('2d');
    for (const [color,x,y] of [['#c81414',0,0],['#14c814',300,0],['#dcc814',0,450],['#14c8dc',300,450]]) {
      ctx.fillStyle=color; ctx.fillRect(x,y,300,450);
    }
    return canvas.toDataURL('image/jpeg',1);
  });
  const jpegBytes=Buffer.from(jpeg.split(',')[1],'base64');
  // APP1 Exif, little-endian TIFF, one SHORT Orientation tag = 6 (90° clockwise).
  const exif=Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000','hex');
  await page.locator('[data-spatial-photo-input]').setInputFiles({name:'landscape.jpg',mimeType:'image/jpeg',buffer:Buffer.concat([jpegBytes.subarray(0,2),exif,jpegBytes.subarray(2)])});
  await page.waitForFunction(() => {
    const img=document.querySelector('[data-spatial-photo-preview]');
    return !document.querySelector('[data-spatial-photo-result]').hidden && img.naturalWidth===900;
  });
  const landscapePhoto=await page.evaluate(async () => {
    const img=document.querySelector('[data-spatial-photo-preview]'); await img.decode();
    const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    return {width:canvas.width,height:canvas.height,topLeft:[...ctx.getImageData(20,20,1,1).data],topRight:[...ctx.getImageData(880,20,1,1).data],label:[...ctx.getImageData(30,550,1,1).data],data:canvas.toDataURL()};
  });
  assert.equal(landscapePhoto.height,600,'Landscape import follows EXIF orientation');
  assert.ok(landscapePhoto.topLeft[0]>180 && landscapePhoto.topLeft[1]>180 && landscapePhoto.topLeft[2]<40);
  assert.ok(landscapePhoto.topRight[0]>180 && landscapePhoto.topRight[1]<40 && landscapePhoto.topRight[2]<40);
  assert.ok(landscapePhoto.label[0]<100,'Landscape output has the label baked into its lower left');
  await writeFile(`${output}/stamped-landscape.png`,Buffer.from(landscapePhoto.data.split(',')[1],'base64'));
  await page.locator('[data-spatial-photo-input]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await page.waitForFunction(() => document.querySelector('[data-spatial-photo-status]').textContent.includes('could not be opened'));
  assert.equal(await page.locator('[data-spatial-photo-result]').isVisible(),false, 'A failed new import must not offer the previous photo');

  // Inspect the real overlay DOM at phone sizes; this is not an XR hardware test.
  await page.evaluate(() => {
    document.querySelector('.spatial-panel').hidden=true;
    document.querySelector('[data-spatial-overlay]').hidden=false;
    document.querySelector('[data-spatial-photo-capture]').hidden=false;
    document.querySelector('[data-spatial-photo-capture]').disabled=false;
    document.querySelector('[data-spatial-overlay]').style.background='linear-gradient(150deg, #799ba2, #d4ceb9)';
  });
  for (const [width,height] of [[390,844],[320,640],[844,390],[568,320],[390,844]]) {
    await page.setViewportSize({width,height});
    const box = await page.locator('[data-artwork-label]').boundingBox();
    assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height);
    assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.scrollWidth<=el.clientWidth));
    const shutter=await page.locator('[data-spatial-photo-capture]').boundingBox();
    assert.ok(shutter.x>=0 && shutter.y>=0 && shutter.x+shutter.width<=width && shutter.y+shutter.height<=height);
    assert.ok(shutter.x>=box.x+box.width || shutter.y>=box.y+box.height,'Artwork label does not overlap the shutter after rotation');
    assert.ok(await page.locator('[data-spatial-photo-capture]').evaluate(el=>{
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),'The shutter remains reachable by touch');
    await page.locator('.spatial-overlay-controls').evaluate(el=>el.open=true);
    assert.ok(await page.locator('[data-spatial-photo-capture]').evaluate(el=>{
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),'Opening placement controls does not cover the shutter');
    await page.locator('.spatial-overlay-controls').evaluate(el=>el.open=false);
    await page.screenshot({path:`${output}/overlay-${width}.png`});
  }
  await page.setViewportSize({width:320,height:640});
  await page.goto(`${base}/ar-label/asia/sutra-container-cleveland/`);
  assert.equal(await page.locator('.artwork-label-maker').count(),0, 'Unknown maker is omitted from Apple banner');
  assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.getBoundingClientRect().height<=161));
  await page.screenshot({path:`${output}/apple-banner.png`});
  await page.goto(`${base}/ar-label/europe/venus-of-willendorf-nhmw-44-686/`);
  assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.getBoundingClientRect().height<=121),'The reported Venus label uses the shorter banner without truncating text');
  await page.screenshot({path:`${output}/apple-venus-banner.png`});
  for (const slug of ['sub-saharan-africa/nkisi-power-figure','americas/digital-heart-rhythm-monitor-haywood-nmaahc','asia/asad-al-lat-new-palmyra-commons','asia/prasat-krahom-vishnu-narasimha-lintel-cast-guimet-threedscans']) {
    await page.goto(`${base}/ar-label/${slug}/`);
    assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.getBoundingClientRect().height<=161),`Long Apple banner fits: ${slug}`);
  }

  // Exercise the real native-launch binding and USDZ export with a small fixture.
  // This verifies URLs and controls, not Apple's native UI or device rotation.
  const apple=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1'});
  await apple.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  await apple.addInitScript(()=>Object.defineProperty(navigator,'xr',{configurable:true,value:undefined}));
  const native=await apple.newPage();
  native.on('console',message=>{if(message.type()==='warning') console.warn('Native fixture:',message.text());});
  native.on('pageerror',error=>console.error('Native error:',error.message));
  await native.goto(`${base}/works/europe/venus-of-willendorf-nhmw-44-686/`);
  await native.waitForFunction(()=>Boolean(document.querySelector('[data-spatial-url]')?.value));
  await native.waitForLoadState('networkidle');
  await native.evaluate(async () => {
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {bindSpatialViewing}=await import('/src/lib/spatial-viewer.mjs');
    const original=document.querySelector('[data-spatial]');
    const fixture=original.cloneNode(true);original.replaceWith(fixture);
    fixture.dataset.artworkLabelUrl='https://atrium.earth/ar-label/europe/venus-of-willendorf-nhmw-44-686/';
    const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.2,.1),new THREE.MeshStandardMaterial()));
    const box=new THREE.Box3().setFromObject(model);
    bindSpatialViewing(fixture,()=>({THREE,model,box,verifiedAsset:true}),()=>{});
  });
  await native.locator('[data-spatial-open]').click();
  assert.equal(await native.locator('[data-quick-look-label]').isChecked(),true,'The artwork label starts enabled on iPhone');
  await native.locator('[data-spatial-ar]').click();
  await native.locator('[data-quick-look]:not([hidden])').waitFor();
  const href=await native.locator('[data-quick-look]').getAttribute('href');
  const fragment=url=>new URLSearchParams(url.split('#')[1]);
  assert.equal(fragment(href).has('custom'),false,'Default labeled launch preserves the native shutter');
  assert.equal(fragment(href).has('customHeight'),false);
  const exportedBytes = async () => Buffer.from(await native.evaluate(async () => {
    const url=document.querySelector('[data-quick-look]').href.split('#')[0];
    return [...new Uint8Array(await (await fetch(url)).arrayBuffer())];
  }));
  const labeledBytes=await exportedBytes();
  await writeFile(`${output}/apple-labeled.usdz`,labeledBytes);
  const archive=unzipSync(labeledBytes);
  const usd=strFromU8(archive['model.usda']);
  assert.match(usd,/def Xform "AtriumArtworkLabel_[^"]+"/,'Label is inside the actual USDZ');
  assert.match(usd,/info:id = "LookAtCamera"/);
  assert.match(usd,/uniform bool loops = true/,'Label keeps facing the camera throughout the session');
  assert.match(usd,/rel affectedObjects = \[ <\/Root\/Scenes\/Scene\/AtriumArtworkLabel_[^>]+> \]/,'Camera action targets only the label');
  assert.match(usd,/inputs:emissiveColor.connect/,'Label remains readable independently of room lighting');
  assert.ok(Object.keys(archive).some(name=>name.startsWith('textures/')),'All label text is embedded in a texture');
  let zipOffset=0;
  while(labeledBytes.readUInt32LE(zipOffset)===0x04034b50) {
    assert.equal(labeledBytes.readUInt16LE(zipOffset+8),0,'USDZ entries are uncompressed');
    const start=zipOffset+30+labeledBytes.readUInt16LE(zipOffset+26)+labeledBytes.readUInt16LE(zipOffset+28);
    assert.equal(start%64,0,'Every USDZ entry is aligned to 64 bytes after behavior insertion');
    zipOffset=start+labeledBytes.readUInt32LE(zipOffset+18);
  }
  await native.locator('[data-quick-look-label]').uncheck();
  assert.equal(await native.locator('[data-quick-look]').isVisible(),false,'Changing the scene invalidates the prepared export');
  await native.locator('[data-spatial-ar]').click();
  await native.locator('[data-quick-look]:not([hidden])').waitFor();
  const camera=await native.locator('[data-quick-look]').getAttribute('href');
  assert.equal(fragment(camera).has('custom'),false,'Unlabeled launch also preserves native controls');
  assert.notEqual(camera.split('#')[0],href.split('#')[0],'Changing labels prepares a new USDZ');
  assert.equal(fragment(camera).get('allowsContentScaling'),fragment(href).get('allowsContentScaling'));
  const unlabelled=unzipSync(await exportedBytes());
  const plainUsd=strFromU8(unlabelled['model.usda']);
  assert.ok(!plainUsd.includes('AtriumArtworkLabel_'),'The optional unlabeled scene omits the plaque');
  // The label is a sibling: every original geometry and Artwork transform survives.
  for(const [name,data] of Object.entries(unlabelled)) if(name.startsWith('geometries/')) assert.ok(Object.entries(archive).some(([other,bytes])=>other.startsWith('geometries/') && Buffer.from(bytes).equals(Buffer.from(data))),'Label does not change exported sculpture geometry');
  const artworkTransform=text=>text.match(/def Xform "Artwork"\s*\{\s*(matrix4d[^\n]+)/)[1];
  assert.equal(artworkTransform(usd),artworkTransform(plainUsd),'Label does not alter physical scale or placement');
  await native.locator('[data-quick-look-label]').check();
  await native.locator('[data-spatial-ar]').click();
  await native.locator('[data-quick-look]:not([hidden])').waitFor();
  assert.match(strFromU8(unzipSync(await exportedBytes())['model.usda']),/AtriumArtworkLabel_/,'Restoring the label embeds it again');
  await native.screenshot({path:`${output}/apple-camera-options.png`});
  await native.locator('[data-quick-look-label]').uncheck();
  await native.reload();
  await native.waitForFunction(()=>Boolean(document.querySelector('[data-spatial-url]')?.value));
  await native.locator('[data-spatial-open]').click();
  assert.equal(await native.locator('[data-quick-look-label]').isChecked(),true,'A fresh page visit restores the artwork label default');

  // Render the scene plaque at phone aspect ratios, including an elevated side
  // view. Three lookAt previews the intended native action, not Apple playback.
  const sceneViews=await native.evaluate(async () => {
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {makeQuickLookScene}=await import('/src/lib/spatial-session.mjs');
    const {addQuickLookArtworkLabel}=await import('/src/lib/spatial-quick-look-label.mjs');
    const label=JSON.parse(document.querySelector('[data-spatial]').dataset.artworkLabelJson);
    const model=new THREE.Group();
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.05,24,16),new THREE.MeshStandardMaterial({color:'#d5ceb9'}));
    mesh.scale.set(.65,1.1,.55);model.add(mesh);
    const box=new THREE.Box3().setFromObject(model);
    const converted=makeQuickLookScene(THREE,model,box,{axis:'y',meters:.11},{mode:'surface'});
    const plaque=addQuickLookArtworkLabel(THREE,converted.scene,label);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#99a7ad');scene.add(converted.scene,new THREE.HemisphereLight(0xffffff,0x555555,3));
    const bounds=new THREE.Box3().setFromObject(converted.scene);
    const center=bounds.getCenter(new THREE.Vector3());
    const radius=bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});
    const views=[];
    for(const [width,height,angle] of [[390,844,0],[844,390,0],[844,390,.5]]) {
      const camera=new THREE.PerspectiveCamera(45,width/height,.001,100);
      const fov=Math.min(camera.fov*Math.PI/180,2*Math.atan(Math.tan(camera.fov*Math.PI/360)*width/height));
      const distance=radius/Math.sin(fov/2)*1.15;
      camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle),.35,Math.cos(angle)).normalize().multiplyScalar(distance));
      camera.lookAt(center);plaque.object.lookAt(camera.position);
      renderer.setSize(width,height);renderer.render(scene,camera);
      const projected=new THREE.Box3().setFromObject(plaque.object);
      let inFrame=true;
      for(const x of [projected.min.x,projected.max.x]) for(const y of [projected.min.y,projected.max.y]) for(const z of [projected.min.z,projected.max.z]) {
        const p=new THREE.Vector3(x,y,z).project(camera);inFrame &&= Math.abs(p.x)<1 && Math.abs(p.y)<1;
      }
      views.push({name:`scene-label-${width}-${angle}`,inFrame,data:renderer.domElement.toDataURL()});
    }
    plaque.dispose();converted.dispose();mesh.geometry.dispose();mesh.material.dispose();renderer.dispose();
    return views;
  });
  for(const view of sceneViews) {
    assert.ok(view.inFrame,'Scene label can be framed in portrait and landscape');
    await writeFile(`${output}/${view.name}.png`,Buffer.from(view.data.split(',')[1],'base64'));
  }
  await apple.close();

  // Exercise real WebGL copying/composition with an asymmetric camera image.
  const gpu = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { captureSpatialFrame } = await import('/src/lib/spatial-capture.mjs');
    const { createSpatialLabelHUD } = await import('/src/lib/spatial-label-hud.mjs');
    const { stampArtworkPhoto } = await import('/src/lib/spatial-artwork-label.mjs');
    const renderer = new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true});
    renderer.setSize(390,520); renderer.setClearColor(0,0);
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.9;
    const scene=new THREE.Scene();
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.4),new THREE.MeshBasicMaterial({color:'#2244cc'}));
    mesh.position.z=-2; scene.add(mesh);
    const translucent=new THREE.Mesh(new THREE.PlaneGeometry(.25,.25),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.5}));
    translucent.position.set(-.4,.5,-2); scene.add(translucent);
    const camera=new THREE.PerspectiveCamera(45,390/520,.01,100); camera.updateMatrixWorld();
    camera.viewport=new THREE.Vector4(0,0,390,520);
    renderer.xr.getCamera=()=>({cameras:[camera]});
    const gl=renderer.getContext();
    const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
    // WebGL bottom row red/green, top row yellow/cyan: tests both axes and flip.
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,2,2,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([200,20,20,255,20,200,20,255,220,200,20,255,20,200,220,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    renderer.resetState();
    const label={title:'La Chiffonnière',maker:'Jean Dubuffet',period:'1978',region:'France',material:'Stainless steel with black coating'};
    const hud=createSpatialLabelHUD(THREE,label,'immersive-vr'); scene.add(hud.object);
    hud.update({transform:{matrix:new THREE.Matrix4().elements},views:[{projectionMatrix:camera.projectionMatrix.elements}]});
    const hudVisible=hud.object.visible;
    const xrEnabled=renderer.xr.enabled;
    const view={camera:{width:390,height:520}};
    const photo=captureSpatialFrame({THREE,renderer,scene},view,'immersive-ar',{getCameraImage:()=>texture},[hud.object]);
    const ctx=photo.getContext('2d');
    const pixel=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    const corners=[pixel(2,2),pixel(387,2),pixel(2,517),pixel(387,517)];
    const center=pixel(195,260);
    const translucentPixel=pixel(70,103);
    const restored=renderer.xr.enabled===xrEnabled && renderer.getRenderTarget()===null && hud.object.visible===hudVisible;
    hud.object.visible=false; renderer.render(scene,camera);
    const rendered=document.createElement('canvas'); rendered.width=390;rendered.height=520;
    const rc=rendered.getContext('2d'); rc.drawImage(renderer.domElement,0,0);
    const reference=[...rc.getImageData(195,260,1,1).data];
    const translucentReference=[...rc.getImageData(70,103,1,1).data];
    const alpha=translucentReference[3]/255;
    const expectedTranslucent=translucentReference.slice(0,3).map((channel,i)=>Math.round(channel*alpha+[220,200,20][i]*(1-alpha)));
    let refused=false;
    try {captureSpatialFrame({THREE,renderer,scene},{},'immersive-ar',null);} catch {refused=true;}
    stampArtworkPhoto(photo,label);
    const data=photo.toDataURL();
    hud.dispose(); gl.deleteTexture(texture); mesh.geometry.dispose();mesh.material.dispose();translucent.geometry.dispose();translucent.material.dispose();renderer.dispose();
    return {corners,center,reference,restored,refused,data,translucentPixel,expectedTranslucent,alpha};
  });
  assert.deepEqual(gpu.corners,[[220,200,20,255],[20,200,220,255],[200,20,20,255],[20,200,20,255]],'Camera keeps its orientation and is present in all four corners');
  assert.ok(gpu.center[2]>gpu.center[0] && gpu.center[2]>gpu.center[1],'Sculpture is composited over the camera');
  assert.ok(gpu.center.slice(0,3).every((n,i)=>Math.abs(n-gpu.reference[i])<=2),`Capture retains the live renderer tone mapping: ${JSON.stringify({capture:gpu.center,reference:gpu.reference})}`);
  assert.ok(gpu.restored,'Capture restores renderer and label visibility');
  assert.ok(gpu.refused,'No AR photo is generated without camera pixels');
  assert.ok(gpu.alpha>.4 && gpu.alpha<.6);
  assert.ok(gpu.translucentPixel.slice(0,3).every((n,i)=>Math.abs(n-gpu.expectedTranslucent[i])<=2),'Transparent surfaces composite correctly over the camera');
  await writeFile(`${output}/camera-capture.png`,Buffer.from(gpu.data.split(',')[1],'base64'));
  console.log('Browser label checks passed: unobstructed web shutter through rotation, Apple scene label enabled by default without a banner, camera-facing behavior, aligned USDZ archive, preserved sculpture geometry/scale, label toggling, EXIF landscape photo stamping, camera/3D composition and capture fallback.');
} finally { await browser.close(); await server.stop(); }
