// Small, source-only acquisition. No geometry transforms, preview generation or
// catalog writes. Credentials and signed download URLs never enter the artifact.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const manifest=process.env.MANIFEST,token=process.env.SKETCHFAB_TOKEN;
if (!/^docs\/ingest\/[a-z0-9-]+-source-request\.json$/.test(manifest||'') || !token) throw Error('Reviewed manifest and Sketchfab credential required');
const input=JSON.parse(await fs.readFile(manifest,'utf8'));
if (input.schema!=='atrium-reviewed-source-request/1' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.batch||'') || !Array.isArray(input.models) || !input.models.length || input.models.length>3) throw Error('Invalid bounded source request');
const out='.atrium-ingest/reviewed-source-originals',seen=new Set();
const report={schema:'atrium-reviewed-source-acquisition/1',batch:input.batch,checkedAt:new Date().toISOString(),requestSha256:createHash('sha256').update(await fs.readFile(manifest)).digest('hex'),works:[]};
await fs.mkdir(out,{recursive:true});
async function api(url){
 const r=await fetch(url,{headers:{Authorization:`Token ${token}`,accept:'application/json'},signal:AbortSignal.timeout(60000)});
 if (!r.ok) throw Error(`Sketchfab metadata HTTP ${r.status}`);
 return r.json();
}
try {
 for (const model of input.models) {
  if (!/^[a-f0-9]{32}$/.test(model.uid||'') || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(model.slug||'') || seen.has(model.uid)) throw Error('Invalid/duplicate source identity');
  seen.add(model.uid);
  const detail=await api(`https://api.sketchfab.com/v3/models/${model.uid}`);
  const dir=path.join(out,model.uid);await fs.mkdir(dir,{recursive:true});
  const detailBody=JSON.stringify(detail,null,2)+'\n';
  if (detailBody.includes(token) || /[?&](?:token|signature|awsaccesskeyid|x-amz-signature|x-amz-credential)=/i.test(detailBody)) throw Error('Credential-bearing metadata cannot enter the source artifact');
  await fs.writeFile(path.join(dir,'public-model-detail.json'),detailBody);
  const label=detail.license?.label||'',licenseUrl=detail.license?.url||'';
  if (detail.uid!==model.uid || !detail.isDownloadable || !['CC0 Public Domain','CC Attribution','CC Attribution-ShareAlike'].includes(label)
      || !/^https?:\/\/creativecommons\.org\/(licenses\/(by|by-sa)\/4\.0|publicdomain\/zero\/1\.0)\/?$/.test(licenseUrl)
      || detail.user?.username!==model.publisher) throw Error('Fresh source identity, publisher or eligible permission mismatch');
  const metadata=await api(`https://api.sketchfab.com/v3/models/${model.uid}/download`),delivery=metadata.glb;
  if (!delivery || !Number.isSafeInteger(delivery.size) || delivery.size<=0 || delivery.size>500_000_000) throw Error('No bounded authenticated GLB delivery');
  const url=new URL(delivery.url);
  // The authenticated API currently returns this exact provider-owned S3 bucket
  // as well as Sketchfab's media hosts. Never forward the API credential to it.
  if (url.protocol!=='https:' || !['media.sketchfab.com','archives.sketchfab.com','sketchfab-prod-media.s3.amazonaws.com'].includes(url.hostname)) throw Error(`Unexpected provider delivery host: ${url.hostname}`);
  const response=await fetch(url,{signal:AbortSignal.timeout(180000)});
  if (!response.ok) throw Error(`Source delivery HTTP ${response.status}`);
  const parts=[];let bytes=0;
  for await (const chunk of response.body) { bytes+=chunk.length;if(bytes>delivery.size) throw Error('Source exceeds authenticated byte count');parts.push(chunk); }
  const body=Buffer.concat(parts,bytes);
  if (bytes!==delivery.size || body.toString('ascii',0,4)!=='glTF' || body.readUInt32LE(4)!==2 || body.readUInt32LE(8)!==bytes || body.readUInt32LE(16)!==0x4e4f534a) throw Error('Original GLB completeness mismatch');
  const document=JSON.parse(body.subarray(20,20+body.readUInt32LE(12)).toString('utf8').trim());
  if ([...(document.buffers||[]),...(document.images||[])].some(x=>x.uri&&!x.uri.startsWith('data:'))) throw Error('Source has external dependencies');
  const sha256=createHash('sha256').update(body).digest('hex');
  await fs.writeFile(path.join(dir,'source.glb'),body,{flag:'wx'});
  report.works.push({uid:model.uid,slug:model.slug,title:detail.name,publisher:detail.user.username,source_url:`https://sketchfab.com/3d-models/${model.uid}`,license:label,license_url:licenseUrl,source:{file:`${model.uid}/source.glb`,bytes,sha256,format:'glb'},authenticatedMetadata:{format:'glb',bytes:delivery.size},originalUnchanged:true});
 }
 report.status='pass';
} catch(error) {
 report.status='fail';report.error=error.message;process.exitCode=1;
} finally {
 await fs.writeFile(path.join(out,'acquisition.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,acquired:report.works.length,error:report.error}));
}
