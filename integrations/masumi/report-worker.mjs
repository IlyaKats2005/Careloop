import {readFile,writeFile,mkdir,rename,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {answer} from './client.mjs';
import {sellerTokenNet} from './settlement.mjs';
import {createReportProcessor,inspection} from './report-processor.mjs';
import {acquireWorkerLock} from './worker-lock.mjs';
const directory=path.resolve(process.env.PAID_AI_STATE_DIR||'.local/report-worker');
const site=new URL(process.env.SPONSOR_SITE_URL||'http://localhost:8787');
if(site.protocol!=='https:'&&!(site.protocol==='http:'&&['localhost','127.0.0.1'].includes(site.hostname)))throw Error('Use HTTPS or a loopback API origin.');
if(site.pathname!=='/'||site.search||site.hash||site.username||site.password)throw Error('Use a bare API origin.');
const token=process.env.SPONSOR_RELAY_TOKEN||'',admin=process.env.ADMIN_KEY||'',runtime=process.env.MPS_RUNTIME_TOKEN||'',blockfrost=process.env.BLOCKFROST_API_KEY_PREPROD||'';
if(token.length<32||!admin||!runtime||!blockfrost.startsWith('preprod')||!process.env.GEMINI_API_KEY)throw Error('Configure the private relay token, MPS keys, Gemini key and Preprod Blockfrost key.');
const secrets=[token,admin,runtime,blockfrost,process.env.GEMINI_API_KEY];
function message(error){let m=String(error?.message||error);for(const secret of secrets)if(secret)m=m.replaceAll(secret,'[REDACTED]');return m.slice(0,500);}
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));
const registration=await readJSON(process.env.MASUMI_REGISTRATION_FILE||'docs/registration-state.json');
const seller=await readJSON(process.env.MASUMI_PAYMENT_STATE_FILE||'docs/payment-state.json');
await mkdir(directory,{recursive:true,mode:0o700});
const release=acquireWorkerLock(path.join(directory,'worker.lock'));
const workerId='paid-ai-'+randomUUID();let stopped=false,currentLease;
async function save(record){
 const target=path.join(directory,record.id+'.json');const file=await open(target+'.tmp','w',0o600);
 try{await file.writeFile(JSON.stringify(record,null,2));await file.sync();}finally{await file.close();}
 await rename(target+'.tmp',target);
 const folder=await open(directory,'r');try{await folder.sync();}finally{await folder.close();}
}
async function load(id){try{return await readJSON(path.join(directory,id+'.json'));}catch(error){if(error.code==='ENOENT')return null;throw inspection('Paid job journal cannot be read. Restore it before continuing.');}}
async function request(url,body,headers={}){
 const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok)throw Error('Service HTTP '+response.status+': '+String(data.message||data.error||'request failed').slice(0,250));return data;
}
const siteRequest=(route,body)=>request(new URL(route,site),body,{Authorization:'Bearer '+token});
const mps=async(route,body,buyer=false)=>(await request(process.env.MPS_URL+'/api/v1'+route,body,{token:buyer?admin:runtime})).data;
async function verifyTransaction(hash){
 const tx=await request('https://cardano-preprod.blockfrost.io/api/v0/txs/'+hash,undefined,{project_id:blockfrost});
 if(tx.hash!==hash||tx.valid_contract!==true||!Number.isInteger(tx.block_height)||tx.block_height<=0)throw Error('The matching Preprod transaction is not confirmed and valid.');return tx;
}
const advance=createReportProcessor({mps,registration,seller,load,save,
 analyze:(prompt,id,deadline)=>answer(prompt,path.join(directory,id+'-model.json'),deadline),
 verifyTransaction,
 verifySeller:async(hash,address,unit)=>{
  const tx=await verifyTransaction(hash),utxos=await request('https://cardano-preprod.blockfrost.io/api/v0/txs/'+hash+'/utxos',undefined,{project_id:blockfrost});
  if(utxos.hash!==hash)throw inspection('Seller outputs belong to another transaction.');
  const net=sellerTokenNet(utxos,address,unit);if(net!==1000000n)throw inspection('The confirmed seller receipt differs from 1 test USDM.');
  return {verified:true,network:'Preprod',txHash:hash,sellerAddress:address,unit,netAtomicUnits:net.toString(),blockHeight:tx.block_height};
 },
 post:(id,body)=>siteRequest('/api/paid-ai/jobs/'+id,{...body,leaseToken:currentLease})
});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopped=true;});
try{
 console.log(JSON.stringify({event:'paid_ai_worker_ready',site:site.origin,price:'1 test USDM',network:'Preprod'}));
 do{
  let job;
  try{
   const leased=await siteRequest('/api/paid-ai/lease',{workerId});job=leased.job;currentLease=leased.leaseToken;
   if(job){const result=await advance(job);console.log(JSON.stringify({event:'paid_ai_progress',reportId:job.reportId,state:result?.job?.state||job.state}));}
  }catch(error){
   console.log(JSON.stringify({event:'paid_ai_waiting',reportId:job?.reportId,message:message(error)}));
   if(job&&error.code==='INSPECTION_REQUIRED')try{await siteRequest('/api/paid-ai/jobs/'+job.id,{leaseToken:currentLease,inputHash:job.inputHash,state:'blocked',error:message(error)});}catch{}
  }
  if(process.argv.includes('--once')||stopped)break;
  for(let i=0;i<10&&!stopped;i++)await new Promise(resolve=>setTimeout(resolve,1000));
 }while(!stopped);
}finally{release();}
