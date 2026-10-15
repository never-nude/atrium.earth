// One-off recovery of a completed acquisition whose final Git push was denied.
// Sources come exclusively from exact Actions artifacts; previews are public R2.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const request=read('docs/ingest/etruscan-greek-20261015-recovery-request.json');
const index=read('.atrium-ingest/recovery-index/source-backup-index.json');
if(request.schema!=='atrium-acquisition-artifact-recovery/1'||request.batch!=='etruscan-greek-20261015'||index.logical_batch_id!==request.batch||index.candidates.length!==41||request.previews.length!==39)throw Error('Unexpected recovery request/index');
if(process.argv[2]==='prepare'){
  const candidates=index.candidates.map(c=>{
    const f=c.fetched;
    for(const key of ['downloaded_path','local_source_path']){
      const relative=f[key];
      if(!relative.startsWith('.atrium-ingest/sources/')||relative.split('/').includes('..'))throw Error('Unsafe source member');
      const p=fs.realpathSync(relative),root=fs.realpathSync('.atrium-ingest/sources')+path.sep;
      if(!p.startsWith(root))throw Error('Source escaped artifact root');
      const b=fs.readFileSync(p);
      if(b.length!==f.original_download_bytes||hash(b)!==f.sha256)throw Error('Source alias differs from exact incoming bytes');
    }
    return c;
  });
  write('.atrium-ingest/fetched.json',{schema:'atrium-auto-ingest-fetched/1',generated_at:new Date().toISOString(),source_candidates:'docs/ingest/etruscan-greek-20261015-leads-chunk2.json',candidates,report:{recovered_from_exact_artifact:request.sourceArtifactId}});
  console.log('41 complete unchanged incoming sources verified; no provider requests made.');
}else if(process.argv[2]==='finish'){
  const report=read('.atrium-ingest/last-report.json'),previews=read('src/data/previews.json');
  if(report.accepted.length!==39||report.rejected.length!==2)throw Error('Recovered measured acceptance differs from original run');
  const accepted=new Map(report.accepted.map(c=>[c.slug,c])),uploaded=[];
  for(const item of request.previews){
    const a=accepted.get(item.slug),c=index.candidates.find(c=>c.slug===item.slug);
    if(!a||!a.integrity_data||a.integrity_data.skipped||!c)throw Error('Missing actual measured accepted source');
    const u=new URL(item.url);
    if(u.origin!=='https://models.atrium.earth'||u.search||u.hash||!u.pathname.startsWith(`/models/previews/${item.slug}/preview-`))throw Error('Invalid immutable preview URL');
    const response=await fetch(item.url,{signal:AbortSignal.timeout(180000)});
    if(!response.ok)throw Error(`Preview HTTP${response.status}`);
    const body=Buffer.from(await response.arrayBuffer()),sha256=hash(body);
    if(body.toString('ascii',0,4)!=='glTF'||body.readUInt32LE(8)!==body.length||!item.url.endsWith(`preview-${sha256.slice(0,12)}.glb`))throw Error('Preview complete hash/GLB binding failed');
    const gltf=JSON.parse(body.subarray(20,20+body.readUInt32LE(12)).toString().trim());
    if([...(gltf.buffers||[]),...(gltf.images||[])].some(r=>r.uri&&!r.uri.startsWith('data:')))throw Error('Preview has external dependencies');
    const faces=(gltf.meshes||[]).flatMap(m=>m.primitives).reduce((n,p)=>{if((p.mode??4)!==4)throw Error('Nontriangle preview');const count=gltf.accessors[p.indices??p.attributes.POSITION]?.count;if(!count||count%3)throw Error('Unmeasurable primitive');return n+count/3;},0);
    if(!faces)throw Error('Preview has no measured faces');
    previews[item.slug]={url:item.url,bytes:body.length,sourceBytes:c.fetched.original_download_bytes,sourceFormat:'glb',faces,sourceFaces:a.integrity_data.faces};
    uploaded.push({slug:item.slug,url:item.url,bytes:body.length,sha256,content_type:response.headers.get('content-type')?.split(';')[0]});
  }
  write('src/data/previews.json',previews);
  write('.atrium-ingest/r2-upload.json',{generated_at:new Date().toISOString(),public_base:'https://models.atrium.earth',uploaded,recovery:'Full GET/hash verification of previews uploaded by acquisition38816449456; no R2 writes'});
  console.log('39 measured accepted records and existing immutable preview full hashes recovered; two unchanged integrity holds.');
}else throw Error('Use prepare or finish');
