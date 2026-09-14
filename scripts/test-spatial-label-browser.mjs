import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dev } from 'astro';
import { chromium } from 'playwright';

// Runs server + browser together, including environments with per-command networks.
const server = await dev({ root: new URL('../', import.meta.url), server: { host: '127.0.0.1', port: 4334 }, logLevel: 'error' });
const base = 'http://127.0.0.1:4334';
const output = process.env.ATRIUM_TEST_OUTPUT || '/tmp/atrium-artwork-label-tests';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...(process.env.ATRIUM_TEST_EXECUTABLE ? { executablePath: process.env.ATRIUM_TEST_EXECUTABLE } : {}), headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Layout and capture fixtures need no remote model, tracking hardware or uploads.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const page = await context.newPage();
  await page.goto(`${base}/works/modern/dubuffet-la-chiffonniere/`);
  await page.locator('[data-spatial-open]').click();
  await page.locator('[data-spatial-dialog][open]').waitFor();
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
  for (const [width,height] of [[390,844],[320,640],[844,390]]) {
    await page.setViewportSize({width,height});
    const box = await page.locator('[data-artwork-label]').boundingBox();
    assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=width && box.y+box.height<=height);
    assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.scrollWidth<=el.clientWidth));
    await page.screenshot({path:`${output}/overlay-${width}.png`});
  }
  await page.setViewportSize({width:320,height:640});
  await page.goto(`${base}/ar-label/asia/sutra-container-cleveland/`);
  assert.equal(await page.locator('.artwork-label-maker').count(),0, 'Unknown maker is omitted from Apple banner');
  assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.getBoundingClientRect().height<=161));
  await page.screenshot({path:`${output}/apple-banner.png`});
  for (const slug of ['sub-saharan-africa/nkisi-power-figure','americas/digital-heart-rhythm-monitor-haywood-nmaahc','asia/asad-al-lat-new-palmyra-commons','asia/prasat-krahom-vishnu-narasimha-lintel-cast-guimet-threedscans']) {
    await page.goto(`${base}/ar-label/${slug}/`);
    assert.ok(await page.locator('[data-artwork-label]').evaluate(el=>el.getBoundingClientRect().height<=161),`Long Apple banner fits: ${slug}`);
  }

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
  console.log('Browser label checks passed: responsive overlays, missing fields, native photo import and failed import, stamped pixels, actual camera/3D composition, orientation, tone mapping, HUD disposal and capture fallback.');
} finally { await browser.close(); await server.stop(); }
