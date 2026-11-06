// Bounded acquisition of already-reviewed public institution models. No catalog writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const output='.atrium-ingest/reviewed-public-institution-sources';
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
const safe=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validatorKeys=new Set(['etag','last-modified','x-goog-generation','x-goog-metageneration']);
const exactKeys=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort());

export function validateManifest(request) {
  exactKeys(request,['schema','batch','models']);
  assert.equal(request.schema,'atrium-reviewed-public-institution-source-request/1');
  assert(safe.test(request.batch)&&request.batch.length<=120);
  assert(Array.isArray(request.models)&&request.models.length>=1&&request.models.length<=6);
  assert.equal(new Set(request.models.map(model=>model.uid)).size,request.models.length);
  assert.equal(new Set(request.models.map(model=>model.slug)).size,request.models.length);
  assert.equal(new Set(request.models.map(model=>model.url)).size,request.models.length);
  let total=0;
  for(const model of request.models) {
    exactKeys(model,['uid','slug','url','format','mime','bytes','validators']);
    assert(safe.test(model.uid)&&model.uid.length<=120);
    assert(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(model.slug)&&model.slug.length<=240);
    assert(Number.isSafeInteger(model.bytes)&&model.bytes>=84);
    total+=model.bytes;
    const url=new URL(model.url);
    assert.equal(url.protocol,'https:');
    assert(!url.username&&!url.password&&!url.port&&!url.search&&!url.hash);
    if(url.hostname==='api.smk.dk') {
      assert(/^\/api\/v1\/download-3d\/[A-Za-z0-9._-]+\.stl$/.test(url.pathname));
      assert.equal(model.format,'stl');assert.equal(model.mime,'model/stl');
    } else {
      assert.equal(url.hostname,'culturalinstitute-3d-serving.storage.googleapis.com');
      assert(/^\/[0-9]+\/[A-Za-z0-9_-]+\/[0-9]+\/gltf\/model\.glb$/.test(url.pathname));
      assert.equal(model.format,'glb');assert(['application/octet-stream','model/gltf-binary'].includes(model.mime));
      assert(/^[0-9]+$/.test(model.validators?.['x-goog-generation']||''));
    }
    assert(model.validators&&typeof model.validators==='object'&&!Array.isArray(model.validators));
    for(const [key,value]of Object.entries(model.validators))assert(validatorKeys.has(key)&&typeof value==='string'&&value.length>0&&value.length<=512&&!/[\r\n]/.test(value));
    assert(/^(?:W\/)?"[^"\r\n]+"$/.test(model.validators.etag||''));
    assert(Number.isFinite(Date.parse(model.validators['last-modified'])));
  }
  assert(total<=500*1024*1024,'Aggregate source budget exceeded');
  return total;
}

function inspectContainer(body,format) {
  if(format==='stl') {
    const triangles=body.readUInt32LE(80);
    assert(triangles>0&&body.length===84+50*triangles,'Binary STL extent differs');
    for(let face=0;face<triangles;face++)for(let component=0;component<12;component++)assert(Number.isFinite(body.readFloatLE(84+50*face+4*component)),'Nonfinite STL position/normal');
    return {binaryStlTriangles:triangles,allPositionAndNormalComponentsFinite:true};
  }
  assert.equal(body.readUInt32LE(0),0x46546c67);assert.equal(body.readUInt32LE(4),2);
  assert.equal(body.readUInt32LE(8),body.length);assert.equal(body.readUInt32LE(16),0x4e4f534a);
  const length=body.readUInt32LE(12);
  assert(length>0&&length%4===0&&20+length<=body.length);
  const document=JSON.parse(body.subarray(20,20+length).toString('utf8'));
  assert.equal(document.asset.version,'2.0');
  let cursor=20+length;
  if(cursor<body.length){assert(cursor+8<=body.length);const bytes=body.readUInt32LE(cursor);assert.equal(body.readUInt32LE(cursor+4),0x004e4942);assert.equal(bytes%4,0);cursor+=8+bytes;}
  assert.equal(cursor,body.length,'GLB chunk extent differs');
  assert((document.meshes||[]).length>0);
  for(const dependency of [...(document.buffers||[]),...(document.images||[])])assert(!dependency.uri||dependency.uri.startsWith('data:'),'External GLB dependency');
  for(const accessor of document.accessors||[])for(const value of [...(accessor.min||[]),...(accessor.max||[])])assert(Number.isFinite(value));
  return {glbVersion:2,selfContained:true,meshes:document.meshes.length,extensionsUsed:document.extensionsUsed||[]};
}

async function checkedRequest(model,method,deadline,condition={}) {
  const response=await fetch(model.url,{method,redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(300000)]),headers:{'Accept-Encoding':'identity',...condition}});
  try {
    assert.equal(response.status,200);assert.equal(response.url,model.url);
    assert.equal((response.headers.get('content-type')||'').split(';')[0].trim(),model.mime);
    assert.equal(Number(response.headers.get('content-length')),model.bytes);
    assert(['','identity'].includes(response.headers.get('content-encoding')||''));
    for(const [key,value]of Object.entries(model.validators))assert.equal(response.headers.get(key),value,'Provider changed '+key);
    const headers=Object.fromEntries(['content-type','content-length',...Object.keys(model.validators)].map(key=>[key,response.headers.get(key)]));
    return {response,headers};
  } catch(error) {await response.body?.cancel().catch(()=>{});throw error;}
}

async function fetchModel(model,deadline) {
  const headBefore=await checkedRequest(model,'HEAD',deadline);
  await headBefore.response.body?.cancel();
  const condition=model.validators.etag.startsWith('W/')?{'If-Unmodified-Since':model.validators['last-modified']}:{'If-Match':model.validators.etag};
  const directory=path.join(output,model.uid);await fs.mkdir(directory);
  const partial=path.join(directory,'source.'+model.format+'.partial');
  const final=path.join(directory,'source.'+model.format);
  const file=await fs.open(partial,'wx');const digest=crypto.createHash('sha256');let bytes=0;
  let get;
  try {
    get=await checkedRequest(model,'GET',deadline,condition);
    for await(const chunk of get.response.body) {
      bytes+=chunk.length;assert(bytes<=model.bytes,'Body exceeds frozen source extent');digest.update(chunk);
      let offset=0;while(offset<chunk.length){const written=await file.write(chunk,offset,chunk.length-offset);assert(written.bytesWritten>0);offset+=written.bytesWritten;}
    }
    assert.equal(bytes,model.bytes);await file.sync();
  } finally {await file.close();await get?.response.body?.cancel().catch(()=>{});}
  const sha256=digest.digest('hex');const body=await fs.readFile(partial);
  assert.equal(body.length,bytes);assert.equal(sha(body),sha256);
  const container=inspectContainer(body,model.format);
  const headAfter=await checkedRequest(model,'HEAD',deadline);await headAfter.response.body?.cancel();
  await fs.link(partial,final); // Exclusive publication of the completed inode, partial alias retained.
  return {uid:model.uid,slug:model.slug,sourceUrl:model.url,format:model.format,bytes,sha256,
    file:path.posix.join(model.uid,'source.'+model.format),status:'complete-whole-http-200',condition,
    headBefore:headBefore.headers,getHeaders:get.headers,headAfter:headAfter.headers,container};
}

async function main() {
  const manifest=process.env.MANIFEST;
  assert(/^docs\/ingest\/[a-z0-9-]+-source-request\.json$/.test(manifest||''),'Expected constrained docs/ingest manifest');
  const stat=await fs.lstat(manifest);assert(stat.isFile()&&!stat.isSymbolicLink());
  assert.equal(await fs.realpath(manifest),path.resolve(manifest));
  const body=await fs.readFile(manifest);assert(body.length<=65536);
  const request=JSON.parse(body);const total=validateManifest(request);
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.mkdir(output,{recursive:false});
  const deadline=AbortSignal.timeout(900000);const works=[],holds=[];
  for(const model of request.models)try{works.push(await fetchModel(model,deadline));}catch(error){holds.push({uid:model.uid,slug:model.slug,status:'held',reason:String(error.message).slice(0,300)});}
  const receipt={schema:'atrium-reviewed-public-institution-acquisition/1',batch:request.batch,
    checkedAt:new Date().toISOString(),request:{file:manifest,bytes:body.length,sha256:sha(body)},
    scriptSha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),requestedBytes:total,
    status:holds.length?'complete-with-holds':'pass',works,holds,sourceFilesRetained:true,
    requestTimeoutSeconds:300,totalDeadlineSeconds:900,publicCatalogWrites:false};
  await fs.writeFile(path.join(output,'acquisition.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({complete:works.length,held:holds.length,bytes:works.reduce((sum,work)=>sum+work.bytes,0)}));
  if(holds.length)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
