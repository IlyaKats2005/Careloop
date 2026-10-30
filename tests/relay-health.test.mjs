import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('relay health rejects stale, missing and malformed heartbeat evidence',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'careloop-health-'));
 const check=()=>spawnSync(process.execPath,['scripts/relay-health.mjs'],{env:{...process.env,SPONSOR_STATE_DIR:dir}}).status;
 try{
  assert.equal(check(),1);
  for(const lastHeartbeat of [undefined,Date.now()-120000,Date.now()+60000,'today']){
   writeFileSync(path.join(dir,'health.json'),JSON.stringify({pid:process.pid,network:'Preprod',lastHeartbeat}));assert.equal(check(),1);
  }
  writeFileSync(path.join(dir,'health.json'),JSON.stringify({pid:process.pid,network:'Preprod',lastHeartbeat:Date.now()}));assert.equal(check(),0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
