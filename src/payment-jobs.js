import {bech32} from '@scure/base';
import {field,hash} from './zk-core.js';
import {publicRewardDeployment} from './reward-status.js';
import {rewardDecision} from './reward-policy.js';

const now=()=>Math.floor(Date.now()/1000);
const fail=(message,status=400,code='PAYMENT_INPUT')=>Object.assign(new Error(message),{status,code});
const first=(DB,sql,...args)=>DB.prepare(sql).bind(...args).first();
const run=(DB,sql,...args)=>DB.prepare(sql).bind(...args).run();
const changes=result=>Number(result?.meta?.changes??result?.changes??0);
const parse=value=>value?JSON.parse(value):null;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const canonical=value=>typeof value==='string'&&/^(0|[1-9]\d{0,76})$/.test(value)&&field(value).toString()===value;
const txHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const enabled=env=>typeof env.SPONSOR_RELAY_TOKEN==='string'&&env.SPONSOR_RELAY_TOKEN.length>=32;
const maxJobs=env=>Math.min(100,Math.max(0,Number.isSafeInteger(Number(env.SPONSOR_MAX_JOBS))?Number(env.SPONSOR_MAX_JOBS):4));
const LEASE_SECONDS=300;
const publicError='Sponsor payment needs attention. No replacement transaction will be created automatically.';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

// CIP-19 key-payment addresses only. A testnet address does not encode its
// testnet magic; all actual transactions are separately pinned to Preprod.
export function normalizeRecipient(value){
 if(value===undefined||value===null||value==='')return null;
 try{
  if(typeof value!=='string'||value!==value.trim()||value.length>120||value!==value.toLowerCase())throw Error();
  const decoded=bech32.decode(value,120),bytes=bech32.fromWords(decoded.words),type=bytes[0]>>4;
  if(decoded.prefix!=='addr_test'||(bytes[0]&15)!==0||!((type===0||type===2)&&bytes.length===57||type===6&&bytes.length===29))throw Error();
  return{address:value,paymentKey:hex(bytes.slice(1,29))};
 }catch{throw fail('Enter a valid Cardano testnet receiving address with a payment key.');}
}

export function payoutJSON(row){
 if(!row)return{state:'not_requested',recipientAddress:null,fundTxHash:null,claimTxHash:null,dep:null,error:null};
 return{id:row.id,state:row.state,network:'Preprod',amount:'2000000',recipientAddress:row.recipient_address,fundTxHash:row.fund_tx_hash||null,claimTxHash:row.claim_tx_hash||null,dep:parse(row.dep_json),error:row.error||null,receipt:parse(row.receipt_json),createdAt:new Date(row.created_at*1000).toISOString(),updatedAt:new Date(row.updated_at*1000).toISOString()};
}

export async function enqueuePayment(DB,env,report){
 const existing=await first(DB,'SELECT * FROM care_payment_jobs WHERE report_id=?',report.id);if(existing)return existing;
 if(!enabled(env)||!report.approval_json||!report.recipient_address)return null;
 const recipient=normalizeRecipient(report.recipient_address),limit=maxJobs(env);
 await run(DB,"INSERT OR IGNORE INTO care_payment_jobs (id,report_id,state,recipient_address,approval_json,error,created_at,updated_at) SELECT ?,?,'queued',?,?, '',?,? WHERE (SELECT count(*) FROM care_payment_jobs)<?",crypto.randomUUID(),report.id,recipient.address,report.approval_json,now(),now(),limit);
 const job=await first(DB,'SELECT * FROM care_payment_jobs WHERE report_id=?',report.id);
 if(!job)throw fail('The sponsor’s demonstration budget is fully allocated. The report remains approved; no payment has been sent.',409,'SPONSOR_BUDGET');
 return job;
}

async function resumeBudgetBlockedPayments(DB,env){
 const used=await first(DB,'SELECT count(*) AS n FROM care_payment_jobs');
 const available=maxJobs(env)-Number(used.n);if(available<=0)return 0;
 const {results}=await DB.prepare("SELECT r.* FROM care_reports r JOIN care_workspaces w ON w.id=r.workspace_id WHERE r.payout_error!='' AND r.approval_json IS NOT NULL AND json_extract(r.reward_decision_json,'$.state')='approved' AND json_extract(r.chain_json,'$.fund') IS NULL AND json_extract(r.chain_json,'$.claim') IS NULL AND (w.expires_at IS NULL OR w.expires_at>?) AND NOT EXISTS (SELECT 1 FROM care_payment_jobs j WHERE j.report_id=r.id) ORDER BY r.created_at,r.id LIMIT ?").bind(now(),Math.min(available,20)).all();
 let resumed=0;
 for(const report of results){
  const decision=parse(report.reward_decision_json);
  if(decision.source!=='clinic'&&rewardDecision(parse(report.answers_json),parse(report.program_json),parse(report.ai_json)).state!=='approved')continue;
  try{
   const job=await enqueuePayment(DB,env,report);
   if(job){await run(DB,"UPDATE care_reports SET payout_error='',updated_at=? WHERE id=?",now(),report.id);resumed++;}
  }catch(error){if(error.code==='SPONSOR_BUDGET')break;throw error;}
 }
 return resumed;
}

export async function submitPaymentProof(DB,report,body){
 const job=await first(DB,'SELECT * FROM care_payment_jobs WHERE report_id=?',report.id);
 if(!job||!report.approval_json)throw fail('An approved, sponsor-funded report is required before submitting a proof.',409);
 if(!['awaiting_proof','claim_queued','submitted','confirmed'].includes(job.state))throw fail('Wait for the sponsor’s pool confirmation before submitting a proof.',409);
 const approval=parse(job.approval_json),recipient=normalizeRecipient(job.recipient_address),p=body.publicSignals;
 try{
  if(!Array.isArray(p)||p.length!==8||!p.every(canonical)||p[0]!==approval.root||p[2]!==approval.c.program||p[3]!==approval.c.period||p[4]!=='2000000'||p[4]!==approval.c.amount||p[5]!==BigInt('0x'+recipient.paymentKey).toString()||p[6]!==approval.c.domain||p[1]==='0'||p[7]!==hash(p[1],p[5]).toString())throw Error();
  const proof=body.proof,coordinate=x=>typeof x==='string'&&/^(0|[1-9]\d{0,115})$/.test(x),g1=x=>Array.isArray(x)&&x.length===3&&x.every(coordinate),g2=x=>Array.isArray(x)&&x.length===3&&x.every(a=>Array.isArray(a)&&a.length===2&&a.every(coordinate));
  if(!proof||proof.protocol!=='groth16'||!['bls12381','bls12-381'].includes(proof.curve)||!g1(proof.pi_a)||!g2(proof.pi_b)||!g1(proof.pi_c))throw Error();
 }catch{throw fail('The proof does not match this report, reporting period or receiving address.');}
 const claim={proof:{protocol:body.proof.protocol,curve:body.proof.curve,pi_a:body.proof.pi_a,pi_b:body.proof.pi_b,pi_c:body.proof.pi_c},publicSignals:[...p]},serialized=JSON.stringify(claim);
 if(job.claim_json){if(job.claim_json!==serialized)throw fail('A different proof is already recorded for this payout.',409,'PROOF_CONFLICT');return job;}
 await run(DB,"UPDATE care_payment_jobs SET claim_json=?,state='claim_queued',updated_at=? WHERE id=? AND state='awaiting_proof' AND claim_json IS NULL",serialized,now(),job.id);
 const saved=await first(DB,'SELECT * FROM care_payment_jobs WHERE id=?',job.id);
 if(saved.claim_json!==serialized)throw fail('A different proof was recorded concurrently. Refresh this report.',409,'PROOF_CONFLICT');
 return saved;
}

function relayJob(row){
 if(!row)return null;
 return{id:row.id,reportId:row.report_id,state:row.state,stage:['claim_queued','submitted','confirmed'].includes(row.state)?'claim':'fund',approval:parse(row.approval_json),recipientAddress:row.recipient_address,claim:parse(row.claim_json),dep:parse(row.dep_json),fundTxHash:row.fund_tx_hash||null,claimTxHash:row.claim_tx_hash||null,receipt:parse(row.receipt_json)};
}
async function authorized(request,env){
 if(!enabled(env))throw fail('Sponsor relay is not configured.',503,'SPONSOR_UNAVAILABLE');
 const value=request.headers.get('authorization')||'';if(!value.startsWith('Bearer ')||value.length>1000)throw fail('Unauthorized.',401);
 const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([digest(value.slice(7)),digest(env.SPONSOR_RELAY_TOKEN)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)throw fail('Unauthorized.',401);
}
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('JSON required.',415);
 const reader=request.body?.getReader();if(!reader)throw fail('JSON body required.');let length=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16000){await reader.cancel();throw fail('Request too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw fail('Invalid JSON.');}
}
function confirmedReceipt(body,job,kind){
 const receipt=body.receipt,expected=kind==='claim'?job.claim_tx_hash:job.fund_tx_hash;
 if(!receipt||receipt.verified!==true||receipt.network!=='Preprod'||receipt.txHash!==expected||!Number.isInteger(receipt.blockHeight)||receipt.blockHeight<=0)throw fail('A verified Preprod transaction receipt is required.');
 if(kind==='claim'){
  const p=parse(job.claim_json)?.publicSignals;
  if(receipt.recipientAddress!==job.recipient_address||String(receipt.amount)!=='2000000'||receipt.nullifier!==p?.[1])throw fail('The payment receipt does not match this claim.');
 }
 const poolBalance=kind==='claim'?'18000000':'20000000';
 if(receipt.poolRemainingLovelace!==undefined&&receipt.poolRemainingLovelace!==poolBalance)throw fail('The pool balance does not match this transaction.');
 return{verified:true,verification:'sponsor-relay',network:'Preprod',txHash:expected,blockHeight:receipt.blockHeight,verifiedAt:new Date().toISOString(),...(receipt.poolRemainingLovelace!==undefined?{poolRemainingLovelace:receipt.poolRemainingLovelace}:{}),...(kind==='claim'?{recipientAddress:job.recipient_address,amount:'2000000',nullifier:receipt.nullifier}:{})};
}

export async function sponsorAPI(request,env={}){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/sponsor/'))return null;
 try{
  const DB=env.DB;if(!DB?.prepare)throw fail('Sponsor storage is unavailable.',503);
  if(path==='/api/sponsor/status'&&request.method==='GET'){
   const heart=await first(DB,"SELECT last_seen FROM care_sponsor_relay WHERE id='relay'"),used=await first(DB,'SELECT count(*) AS n FROM care_payment_jobs');
   return json({configured:enabled(env),online:enabled(env)&&!!heart&&heart.last_seen>=now()-90,network:'Preprod',remainingBudget:Math.max(0,maxJobs(env)-Number(used.n)),rewardLovelace:'2000000',lastSeen:heart?new Date(heart.last_seen*1000).toISOString():null});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  await authorized(request,env);const body=await readBody(request);
  if(path==='/api/sponsor/heartbeat'){
   await run(DB,"INSERT INTO care_sponsor_relay (id,last_seen) VALUES ('relay',?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",now());const resumed=await resumeBudgetBlockedPayments(DB,env);return json({ok:true,network:'Preprod',resumed});
  }
  if(path==='/api/sponsor/lease'){
   if(typeof body.workerId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(body.workerId))throw fail('Invalid worker identity.');
   const current=await first(DB,"SELECT * FROM care_payment_jobs WHERE state IN ('queued','funding','claim_queued','submitted') AND lease_worker=? AND lease_expires_at>? ORDER BY created_at,id LIMIT 1",body.workerId,now());
   if(current){await run(DB,'UPDATE care_payment_jobs SET lease_expires_at=? WHERE id=? AND lease_token=?',now()+LEASE_SECONDS,current.id,current.lease_token);return json({job:relayJob(current),leaseToken:current.lease_token,leaseExpiresAt:now()+LEASE_SECONDS});}
   const candidate=await first(DB,"SELECT * FROM care_payment_jobs WHERE state IN ('queued','funding','claim_queued','submitted') AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY CASE WHEN state='submitted' THEN 0 WHEN state='funding' THEN 1 WHEN state='claim_queued' THEN 2 ELSE 3 END,created_at,id LIMIT 1",now());
   if(!candidate)return json({job:null,leaseToken:null,leaseExpiresAt:null});
   const token=randomToken(),expires=now()+LEASE_SECONDS;
   const result=await run(DB,'UPDATE care_payment_jobs SET lease_token=?,lease_worker=?,lease_expires_at=? WHERE id=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)',token,body.workerId,expires,candidate.id,now());
   if(!changes(result))return json({job:null,leaseToken:null,leaseExpiresAt:null});
   return json({job:relayJob(candidate),leaseToken:token,leaseExpiresAt:expires});
  }
  const match=path.match(/^\/api\/sponsor\/jobs\/([a-f0-9-]{36})\/update$/);if(!match)return json({error:'Not found'},404);
  let job=await first(DB,'SELECT * FROM care_payment_jobs WHERE id=?',match[1]);if(!job)throw fail('Payment job not found.',404);
  if(typeof body.leaseToken!=='string'||body.leaseToken!==job.lease_token)throw fail('Payment job lease is unavailable. Lease it again before proceeding.',409,'LEASE_CONFLICT');
  if(body.state===job.state&&['awaiting_proof','confirmed','failed'].includes(job.state)){
   if(job.state!=='failed')confirmedReceipt(body,job,job.state==='confirmed'?'claim':'fund');
   return json({job:relayJob(job),leaseToken:null,leaseExpiresAt:null});
  }
  if(job.lease_expires_at<=now())throw fail('Payment job lease is unavailable. Lease it again before proceeding.',409,'LEASE_CONFLICT');
  const allowed={queued:['queued','funding','failed'],funding:['funding','awaiting_proof','failed'],claim_queued:['claim_queued','submitted','failed'],submitted:['submitted','confirmed','failed']};
  if(!allowed[job.state]?.includes(body.state))throw fail('Invalid payment state transition.',409);
  let fund=job.fund_tx_hash,claim=job.claim_tx_hash,dep=job.dep_json,receipt=job.receipt_json;
  if(body.state==='funding'){
   if(!txHash(body.txHash))throw fail('The funding transaction hash must be saved before broadcast.');
   if(fund&&fund!==body.txHash)throw fail('The existing funding transaction cannot be replaced.',409);
   let value;try{value=JSON.stringify(publicRewardDeployment(body.dep));}catch{throw fail('Valid Preprod pool metadata is required.');}
   if(dep&&dep!==value)throw fail('The existing reward pool cannot be replaced.',409);
   fund=body.txHash;dep=value;
  }
  if(body.state==='submitted'){
   if(!txHash(body.txHash)||!job.claim_json||!dep||!fund)throw fail('A bound proof, funded pool and claim hash are required.');
   if(claim&&claim!==body.txHash)throw fail('The existing claim transaction cannot be replaced.',409);
   claim=body.txHash;
  }
  if(body.state==='awaiting_proof'){if(!fund||!dep)throw fail('Funding must be recorded first.',409);receipt=JSON.stringify(confirmedReceipt(body,job,'fund'));}
  if(body.state==='confirmed'){if(!claim)throw fail('A submitted claim is required.',409);receipt=JSON.stringify(confirmedReceipt(body,job,'claim'));}
  const terminal=['awaiting_proof','confirmed','failed'].includes(body.state),error=body.state==='failed'?publicError:'';
  const result=await run(DB,'UPDATE care_payment_jobs SET state=?,fund_tx_hash=?,claim_tx_hash=?,dep_json=?,receipt_json=?,error=?,lease_expires_at=?,updated_at=? WHERE id=? AND lease_token=? AND lease_expires_at>? AND state=?',body.state,fund||null,claim||null,dep||null,receipt||null,error,terminal?null:now()+LEASE_SECONDS,now(),job.id,body.leaseToken,now(),job.state);
  if(!changes(result))throw fail('Payment changed concurrently. Reload the leased job.',409,'LEASE_CONFLICT');
  const kind=body.state==='funding'||body.state==='awaiting_proof'?'fund':body.state==='submitted'||body.state==='confirmed'?'claim':null;
  if(kind){const value={txHash:kind==='fund'?fund:claim,dep:parse(dep),verified:body.state==='awaiting_proof'||body.state==='confirmed',verification:'sponsor-relay',...(body.state==='confirmed'?{nullifier:parse(receipt).nullifier}:{})};await run(DB,"UPDATE care_reports SET chain_json=json_set(chain_json,?,json(?)),updated_at=? WHERE id=?",'$.'+kind,JSON.stringify(value),now(),job.report_id);}
  job=await first(DB,'SELECT * FROM care_payment_jobs WHERE id=?',job.id);
  return json({job:relayJob(job),leaseToken:terminal?null:job.lease_token,leaseExpiresAt:job.lease_expires_at});
 }catch(error){return json({error:error.code||'SPONSOR_ERROR',message:error.status?error.message:'Sponsor service is temporarily unavailable.'},error.status||500);}
}
