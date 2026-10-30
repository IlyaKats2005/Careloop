import {readFile,writeFile,mkdir,rename,chmod,open,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {Lucid,Blockfrost,Koios} from '@lucid-evolution/lucid';
import {groth16} from 'snarkjs';
import {preparePool,prepareClaim,readPool,NETWORK,NETWORK_MAGIC,KOIOS} from '../src/cardano.js';
import {publicRewardDeployment} from '../src/reward-status.js';
import {validateJob,jobFingerprint,checkedDeployment,validateSponsoredProof,checkedReceipt,assertRelayBudget,journalSignedTransaction,submitJournaledTransaction} from '../src/sponsor-relay-core.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const resolve=value=>path.resolve(root,value);
const directory=resolve(process.env.SPONSOR_STATE_DIR||'.local/sponsor-relay');
const statePath=path.join(directory,'journal.json'),lockPath=path.join(directory,'relay.lock');
const site=new URL(process.env.SPONSOR_SITE_URL||'http://localhost:8789');
if(site.protocol!=='https:'&&!(site.protocol==='http:'&&['localhost','127.0.0.1'].includes(site.hostname)))throw Error('Use HTTPS for the sponsored-payment service.');
if(site.pathname!=='/'||site.search||site.hash||site.username||site.password)throw Error('SPONSOR_SITE_URL must be a bare site origin.');
const token=process.env.SPONSOR_RELAY_TOKEN||'';
const maxJobs=Number(process.env.SPONSOR_MAX_JOBS||4),maxSpendADA=Number(process.env.SPONSOR_MAX_SPEND_ADA||100);
if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>20||!Number.isSafeInteger(maxSpendADA)||maxSpendADA<25||maxSpendADA>1000)throw Error('Invalid bounded test sponsor budget.');
if(NETWORK!=='Preprod'||NETWORK_MAGIC!==1)throw Error('The sponsor relay only supports Cardano Preprod.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const output=value=>console.log(JSON.stringify({at:new Date().toISOString(),...value}));
const secrets=[token];
const safeError=error=>{let value=String(error?.message||error);for(const secret of secrets)if(secret)value=value.replaceAll(secret,'[REDACTED]');return value.slice(0,700);};
const encode=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);
let stopped=false,locked=false,journal,lucid,provider;
const observedJobs=new Map();
const budget={maxJobs,maxSpendLovelace:BigInt(maxSpendADA)*1000000n};
async function persist(){
 const file=await open(statePath+'.tmp','w',0o600);
 try{await file.chmod(0o600);await file.writeFile(encode(journal));await file.sync();}finally{await file.close();}
 await rename(statePath+'.tmp',statePath);
 const folder=await open(directory,'r');try{await folder.sync();}finally{await folder.close();}
}
async function privateText(filename){const file=resolve(filename);const mode=(await stat(file)).mode;if(mode&0o077)throw Error('Sponsor private files must have owner-only permissions (chmod 600).');return (await readFile(file,'utf8')).trim();}
async function api(route,body){
 const r=await fetch(new URL(route,site),{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+token},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 let result;try{result=await r.json();}catch{throw Error('Sponsor API returned an unreadable response (HTTP '+r.status+').');}
 if(!r.ok)throw Error('Sponsor API '+route+' HTTP '+r.status+': '+String(result.message||result.error||'request failed'));
 return result;
}
const readJSON=async filename=>JSON.parse(await readFile(resolve(filename),'utf8'));
const blueprint=await readJSON('contracts/plutus.json'),vk=await readJSON('public/zk/verification_key.json');
async function initializeWallet(){
 if(!process.env.SPONSOR_SEED_FILE)throw Error('Set SPONSOR_SEED_FILE to a private dedicated Preprod wallet seed file.');
 const seed=await privateText(process.env.SPONSOR_SEED_FILE);secrets.push(seed);
 if(![15,24].includes(seed.split(/\s+/).length))throw Error('The sponsor seed file must contain a 15- or 24-word phrase.');
 let key=process.env.SPONSOR_BLOCKFROST_KEY||'';
 if(process.env.SPONSOR_BLOCKFROST_KEY_FILE)key=await privateText(process.env.SPONSOR_BLOCKFROST_KEY_FILE);
 secrets.push(key);
 if(key&&!key.startsWith('preprod'))throw Error('A Preprod Blockfrost key is required.');
 provider=key?new Blockfrost('https://cardano-preprod.blockfrost.io/api/v0',key):new Koios(KOIOS);
 lucid=await Lucid(provider,'Preprod');lucid.selectWallet.fromSeed(seed);
 const address=await lucid.wallet().address(),utxos=await lucid.wallet().getUtxos();
 const balance=utxos.reduce((sum,u)=>sum+u.assets.lovelace,0n);
 if(journal?.sponsorAddress&&journal.sponsorAddress!==address)throw Error('This journal belongs to another sponsor wallet.');
 return {address,balanceLovelace:balance.toString(),utxoCount:utxos.length,network:'Preprod',networkMagic:1};
}
async function koiosInfo(hash){
 const r=await fetch(KOIOS+'/tx_info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_tx_hashes:[hash],_inputs:true,_assets:true,_scripts:true,_bytecode:true}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Preprod receipt verification is temporarily unavailable (HTTP '+r.status+').');
 const rows=await r.json();return Array.isArray(rows)?rows.find(row=>row.tx_hash===hash)||null:null;
}
async function chainConfirmed(hash){const result=await lucid.transactionStatus(hash);return result.status==='confirmed';}
async function retryExact(record,beforeBroadcast){
 if(record.status==='confirmed')return;
 if(record.lastAttemptAt&&Date.now()-Date.parse(record.lastAttemptAt)<60000)return;
 record.lastAttemptAt=new Date().toISOString();await persist();
 output({event:'submission_starting',txHash:record.hash,message:'Saving the transaction reference, then broadcasting these exact signed bytes.'});
 try{await submitJournaledTransaction(record,{submit:cbor=>provider.submitTx(cbor),persist,beforeBroadcast});output({event:'transaction_submitted',txHash:record.hash});}
 catch(error){record.lastSubmissionError=safeError(error);await persist();output({event:'submission_pending',txHash:record.hash,message:'Signed bytes retained. The relay will verify or retry this same transaction.',detail:safeError(error)});}
}
async function ensureSeed(job,record){
 const us=await lucid.wallet().getUtxos();
 if(us.some(u=>Object.keys(u.assets).length===1&&u.assets.lovelace>=25000000n))return true;
 if(record.split){
  if(await chainConfirmed(record.split.hash)){record.split.status='confirmed';await persist();throw Error('Confirmed sponsor split output is unavailable; no replacement payment was created.');}
  await retryExact(record.split,async()=>{});return false;
 }
 const input=us.find(u=>u.assets.lovelace>=35000000n);
 const collateral=us.find(u=>u!==input&&Object.keys(u.assets).length===1&&u.assets.lovelace>=5000000n);
 if(!input||!collateral)throw Error('Sponsor needs a funded UTxO and separate 5 test ADA collateral.');
 const tx=await lucid.newTx().collectFrom([input]).pay.ToAddress(journal.sponsorAddress,{lovelace:30000000n}).complete({coinSelection:false});
 const entry=await journalSignedTransaction({journal,jobId:job.id,kind:'split',tx,persist,...budget});
 await retryExact(entry,async()=>{});return false;
}
async function processJob(job,leaseToken){
 validateJob(job);const fingerprint=jobFingerprint(job);
 if(observedJobs.get(job.id)!==job.state){observedJobs.set(job.id,job.state);output({event:'job_progress',reportId:job.reportId,state:job.state,stage:job.stage});}
 let record=journal.jobs[job.id];
 if(record&&record.fingerprint!==fingerprint)throw Error('Immutable sponsor job changed; refusing to spend.');
 if(!record){record=journal.jobs[job.id]={fingerprint,reportId:job.reportId,recipientAddress:job.recipientAddress};await persist();}
 const update=body=>api('/api/sponsor/jobs/'+encodeURIComponent(job.id)+'/update',{leaseToken,...body});
 const expectedKind=job.stage==='fund'?'fund':'claim';
 const remoteHash=job.stage==='fund'?job.fundTxHash:job.claimTxHash;
 if(remoteHash&&record[expectedKind]&&remoteHash!==record[expectedKind].hash)throw Error('Remote transaction does not match the private journal.');
 let dep=record.dep?checkedDeployment(record.dep,blueprint,vk):job.dep?checkedDeployment(job.dep,blueprint,vk):null;
 if(job.stage==='fund'){
  if(!record.fund&&!remoteHash){
   assertRelayBudget(journal,{...budget,kind:'fund'});
   if(!await ensureSeed(job,record))return;
   const prepared=await preparePool(lucid,blueprint,vk,{...job.approval.c,root:job.approval.root});
   dep=prepared.dep;record.dep=publicRewardDeployment(dep);await persist();
   await journalSignedTransaction({journal,jobId:job.id,kind:'fund',tx:prepared.tx,persist,extra:{dep:record.dep},...budget});
   output({event:'funding_prepared',reportId:job.reportId,txHash:record.fund.hash});
  }
  const hash=record.fund?.hash||remoteHash;
  if(!hash||!dep)throw Error('Saved sponsor funding metadata is incomplete.');
  if(await chainConfirmed(hash)){
   const info=await koiosInfo(hash);if(!info)return;
   const receipt=checkedReceipt('fund',hash,info,dep,job);
   if(record.fund){record.fund.status='confirmed';record.fund.receipt=receipt;await persist();}
   await update({state:'awaiting_proof',txHash:hash,dep:publicRewardDeployment(dep),receipt});
   output({event:'pool_confirmed',reportId:job.reportId,txHash:hash});return;
  }
  if(!record.fund)throw Error('Remote funding is unconfirmed and its exact signed bytes are unavailable. Restore the sponsor journal; no replacement is allowed.');
  await retryExact(record.fund,()=>update({state:'funding',txHash:hash,dep:publicRewardDeployment(dep)}));return;
 }
 const claim=await validateSponsoredProof(job,vk,(...args)=>groth16.verify(...args));
 if(!dep)throw Error('The approved report has no confirmed reward pool.');
 if(!record.claim&&!remoteHash){
  const pool=await readPool(lucid,dep);
  if(pool.state.used.includes(claim.publicSignals[1]))throw Error('This nullifier is already spent. A replacement payout is forbidden.');
  const tx=await prepareClaim(lucid,dep,claim,job.recipientAddress);
  await journalSignedTransaction({journal,jobId:job.id,kind:'claim',tx,persist,extra:{nullifier:claim.publicSignals[1]},...budget});
  output({event:'claim_prepared',reportId:job.reportId,txHash:record.claim.hash});
 }
 const hash=record.claim?.hash||remoteHash;
 if(await chainConfirmed(hash)){
  const info=await koiosInfo(hash);if(!info)return;
  const receipt=checkedReceipt('claim',hash,info,dep,job);
  if(record.claim){record.claim.status='confirmed';record.claim.receipt=receipt;await persist();}
  await update({state:'confirmed',txHash:hash,dep:publicRewardDeployment(dep),receipt});
  output({event:'reward_confirmed',reportId:job.reportId,txHash:hash,amount:'2000000',network:'Preprod'});return;
 }
 if(!record.claim)throw Error('Remote claim is unconfirmed and its exact signed bytes are unavailable. Restore the sponsor journal; no replacement is allowed.');
 await retryExact(record.claim,()=>update({state:'submitted',txHash:hash,dep:publicRewardDeployment(dep)}));
}

async function acquireLock(){
 try{const f=await open(lockPath,'wx',0o600);await f.writeFile(String(process.pid));await f.close();locked=true;}
 catch(error){if(error.code!=='EEXIST')throw error;const pid=Number(await readFile(lockPath,'utf8'));let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)throw Error('A sponsor relay already owns this state directory.');await unlink(lockPath);return acquireLock();}
}
process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
try{
 if(process.argv.includes('--check')){const wallet=await initializeWallet();const remote=await api('/api/sponsor/status');output({event:'preflight',...wallet,remote,maxJobs,maxSpendADA});}
 else{
  if(token.length<32)throw Error('SPONSOR_RELAY_TOKEN must contain at least 32 characters.');
  await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);await acquireLock();
  try{journal=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Sponsor journal cannot be read; preserve it and restore a valid copy.');journal={version:1,network:'Preprod',workerId:'relay-'+randomUUID(),jobs:{}};}
  if(journal.version!==1||journal.network!=='Preprod'||!journal.jobs)throw Error('Unsupported sponsor journal.');
  const wallet=await initializeWallet();journal.sponsorAddress=wallet.address;await persist();output({event:'relay_ready',...wallet,maxJobs,maxSpendADA});
  do{
   try{
    await api('/api/sponsor/heartbeat',{workerId:journal.workerId});
    await writeFile(path.join(directory,'health.json'),JSON.stringify({pid:process.pid,network:'Preprod',lastHeartbeat:Date.now()}),{mode:0o600});
    const lease=await api('/api/sponsor/lease',{workerId:journal.workerId});
    if(lease.job){try{await processJob(lease.job,lease.leaseToken);}catch(error){output({event:'job_waiting',reportId:lease.job.reportId,message:safeError(error)});}}
   }catch(error){output({event:'relay_waiting',message:safeError(error)});}
   if(process.argv.includes('--once')||stopped)break;
   for(let i=0;i<15&&!stopped;i++)await sleep(1000);
  }while(!stopped);
 }
}catch(error){output({event:'relay_error',message:safeError(error)});process.exitCode=1;}
finally{await globalThis.curve_bls12381?.terminate();if(locked){try{if((await readFile(lockPath,'utf8'))===String(process.pid))await unlink(lockPath);}catch{}}}
