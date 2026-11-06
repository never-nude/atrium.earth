// Transfer only hash-pinned, visually approved GLBs from this repository's
// acquisition artifacts. No local originals or private backup credentials move.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifest=process.env.MANIFEST,repo='never-nude/atrium.earth';
assert(/^docs\/ingest\/[a-z0-9-]+-artifact-preview-upload\.json$/.test(manifest||''));
const body=fs.readFileSync(manifest),input=JSON.parse(body);
assert.equal(input.schema,'atrium-reviewed-artifact-preview-upload/1');
assert(input.artifacts?.length>=1&&input.artifacts.length<=3);
assert(input.models?.length>=1&&input.models.length<=20);
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8',maxBuffer:8e6}));
const root='.atrium-ingest/reviewed-preview-upload';
fs.mkdirSync(root,{recursive:true});
const artifacts=new Map(),seen=new Set(),proofs=[];
for(const a of input.artifacts){
  assert(Number.isSafeInteger(a.id)&&a.id>0&&Number.isSafeInteger(a.run)&&a.run>0);
  assert(Number.isSafeInteger(a.bytes)&&a.bytes>0&&a.bytes<=2000000000);
  assert(/^[a-f0-9]{64}$/.test(a.sha256)&&/^[a-f0-9]{40}$/.test(a.headSha));
  assert(!artifacts.has(a.id));
  const meta=json(['api',`repos/${repo}/actions/artifacts/${a.id}`]);
  assert.equal(meta.expired,false);assert.equal(meta.size_in_bytes,a.bytes);
  assert.equal(meta.digest,'sha256:'+a.sha256);assert.equal(meta.workflow_run.id,a.run);
  assert.equal(meta.workflow_run.head_sha,a.headSha);
  const zip=path.join(root,`artifact-${a.id}.zip`),fd=fs.openSync(zip,'wx');
  try{execFileSync('gh',['api',`repos/${repo}/actions/artifacts/${a.id}/zip`],{stdio:['ignore',fd,'pipe'],timeout:300000});}finally{fs.closeSync(fd);}
  const bytes=fs.readFileSync(zip);assert.equal(bytes.length,a.bytes);assert.equal(sha(bytes),a.sha256);
  artifacts.set(a.id,zip);proofs.push({...a,completeArchiveHashVerified:true});
}
for(const m of input.models){
  assert(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/.test(m.slug||'')&&!seen.has(m.slug));
  assert(/^[a-f0-9]{32}$/.test(m.uid||''));assert.equal(m.member,m.uid+'/source.glb');
  assert(/^[a-f0-9]{64}$/.test(m.sha256)&&Number.isSafeInteger(m.bytes)&&m.bytes>20&&m.bytes<=100000000);
  assert(m.nativeAndPairedReviewApproved===true&&artifacts.has(m.artifactId));
  const bytes=execFileSync('unzip',['-p',artifacts.get(m.artifactId),m.member],{maxBuffer:100000001});
  assert.equal(bytes.length,m.bytes);assert.equal(sha(bytes),m.sha256);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const dir=path.join(root,'models',m.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'preview.glb'),bytes,{flag:'wx'});seen.add(m.slug);
}
fs.writeFileSync(path.join(root,'slugs.txt'),[...seen].join('\n')+'\n',{flag:'wx'});
fs.writeFileSync(path.join(root,'previews.json'),'{}\n',{flag:'wx'});
fs.writeFileSync(path.join(root,'source-proof.json'),JSON.stringify({schema:input.schema,manifestSha256:sha(body),artifacts:proofs,models:input.models,status:'pass'},null,2)+'\n',{flag:'wx'});
console.log(`Verified ${seen.size} reviewed GLBs from complete authenticated artifacts.`);
