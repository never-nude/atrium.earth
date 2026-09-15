import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright';
const modelRoot = process.env.ATRIUM_REVIEW_MODELS || '/tmp/atrium-model-review';
const output = process.env.ATRIUM_REVIEW_OUTPUT || '/tmp/atrium-spatial-review';
await mkdir(output, { recursive: true });
const records = [];
const decode = s => s.replace(/&#34;|&quot;/g, '"').replace(/&amp;/g, '&');
for (const p of (await readdir('dist/works', { recursive: true })).filter(p=>p.endsWith('/index.html'))) {
  const html = await readFile(join('dist/works',p),'utf8');
  const appearance = html.match(/data-material-appearance="([^"]+)"/);
  if (!appearance) continue;
  records.push({slug:p.replace(/\/index.html$/,''), appearance:JSON.parse(decode(appearance[1])), transform:decode(html.match(/data-model-transform="([^"]+)"/)?.[1]||'{}')});
}
const manifest = JSON.parse(await readFile(join(modelRoot,'manifest.json'),'utf8'));
const chosen = new Set((process.env.ATRIUM_REVIEW_ONLY || '').split(',').filter(Boolean));
const priority = ['michelangelo/david','europe/venus-of-willendorf-nhmw-44-686','rodin/the-thinker','the-wrestlers'];
let cases = records.filter(r=>manifest.some(m=>m.slug===r.slug)&&(!chosen.size||chosen.has(r.slug)));
cases.sort((a,b)=>(priority.includes(a.slug)?priority.indexOf(a.slug):-1)-(priority.includes(b.slug)?priority.indexOf(b.slug):-1));
let html = await readFile('public/__render.html','utf8');
html = html.replace('const W=1000,H=1250;', 'const W=320,H=400;').replace('renderer.setPixelRatio(2)','renderer.setPixelRatio(1)').replace('antialias:true,alpha:true','antialias:true,alpha:true,preserveDrawingBuffer:true');
html = html.replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { rememberSpatialAppearance, startSpatialAppearance } from '/src/lib/spatial-materials.mjs';\nimport { makeQuickLookScene } from '/src/lib/spatial-session.mjs';");
html = html.replace("  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));", "  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors,3)); mesh.geometry.userData.atriumPaletteBase=appearance.baseColor;");
html = html.replace('  const target=new THREE.Color(appearance.baseColor);', '  rememberSpatialAppearance(material, appearance);\n  const target=new THREE.Color(appearance.baseColor);');
html = html.replace('  if(current){ scene.remove(current); current=null; }', '  if(current){ scene.remove(current); current.traverse(o=>{ if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}); current=null; }');
html = html.replace('    setTimeout(()=>res(true),350);', '    window.review={model:m,box,appearance,transform}; res(true);');
html = html.replace('window.__ready=true;', `
window.captureReview = async variant => {
  const {model,box,transform} = window.review;
  const saved=[];
  if(variant==='before') model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){saved.push([m,m.userData.atriumGeneratedAppearance]);delete m.userData.atriumGeneratedAppearance;}});
  const converted=makeQuickLookScene(THREE,model,box,null,{mode:'surface'});
  for(const [m,a] of saved)m.userData.atriumGeneratedAppearance=a;
  scene.remove(model);scene.add(converted.scene);
  frameCameraToBox(THREE,camera,new THREE.Box3().setFromObject(converted.scene),{direction:transform.viewDirection || [0.15,0.12,1],padding:1.25});
  // A controlled Three render of the exported surfaces, not an Apple AR emulator.
  const restore=startSpatialAppearance(THREE,new THREE.Group(),scene,renderer);
  scene.background=null;
  renderer.render(scene,camera);
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
  const pixels=ctx.getImageData(0,0,W,H).data, values=[];
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>250)values.push((.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255);
  if(values.length<30)throw new Error("No visible artwork pixels in review");
  values.sort((a,b)=>a-b);
  const quantile=q=>values[Math.min(values.length-1,Math.floor(values.length*q))];
  const result={png:canvas.toDataURL('image/png').split(',')[1],p10:quantile(.1),median:quantile(.5),p90:quantile(.9),shadowFraction:values.filter(v=>v<.12).length/values.length,highlightFraction:values.filter(v=>v>.96).length/values.length};
  restore();scene.remove(converted.scene);converted.dispose();scene.add(model);
  return result;
};
window.__ready=true;`);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/review.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  const file=path.startsWith('/models/')?join(modelRoot,path.slice(8)):path==='/model-render-utils.js'?resolve('public/model-render-utils.js'):resolve('.'+path);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(4342,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.ATRIUM_TEST_EXECUTABLE,headless:true,args:['--enable-unsafe-swiftshader']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:320,height:400}});
 await page.goto('http://127.0.0.1:4342/review.html');await page.waitForFunction(()=>window.__ready);
 for(const record of cases){
  try{
   await page.evaluate(async r=>window.loadModel('/models/'+r.slug+'/preview.glb',r.transform,JSON.stringify(r.appearance)),record);
   const row={slug:record.slug,profile:record.appearance.key};
   for(const variant of ['before','after']){
    const result=await page.evaluate(v=>window.captureReview(v),variant);
    const {png,...stats}=result;row[variant]=stats;
    await writeFile(join(output,record.slug.replaceAll('/','__')+'-'+variant+'.png'),Buffer.from(png,'base64'));
   }
   results.push(row);
  }catch(error){results.push({slug:record.slug,error:String(error)});}
  if(results.length%20===0)console.log('Rendered',results.length,'/',cases.length);
 }
 await writeFile(join(output,'results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({count:results.length,failures:results.filter(r=>r.error),examples:results.filter(r=>priority.includes(r.slug))},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
