// One paid analysis per immutable report. Only the authenticated payment worker
// can advance escrow/result/settlement; a browser cannot invent payment evidence.
import {reserveDemoCharge,settleDemoCharge} from './demo-funding.js';
const first=(DB,sql,...args)=>DB.prepare(sql).bind(...args).first();
const run=(DB,sql,...args)=>DB.prepare(sql).bind(...args).run();
const now=()=>Math.floor(Date.now()/1000);
const fail=(message,status=400,code='PAID_AI_ERROR')=>Object.assign(new Error(message),{status,code});
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const TEST_USDM='16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d';
export const paidAIEnabled=env=>env.PAID_AI_ENABLED==='true';
export const hashText=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
export function paidInput(report){return {prompt:'CARELOOP_REPORT_JSON\n'+JSON.stringify({fictional:true,answers:JSON.parse(report.answers_json),program:JSON.parse(report.program_json)})};}
export function paidAIJSON(row){
 if(!row)return null;
 return{id:row.id,state:row.state,network:'Preprod',price:'1',asset:'test USDM',inputHash:row.input_hash,...JSON.parse(row.metadata_json),error:row.error||null,createdAt:new Date(row.created_at*1000).toISOString(),updatedAt:new Date(row.updated_at*1000).toISOString()};
}
export async function enqueuePaidAI(DB,env,report){
 const existing=await first(DB,'SELECT * FROM care_paid_ai_jobs WHERE report_id=?',report.id);if(existing)return existing;
 if(!paidAIEnabled(env)||typeof env.SPONSOR_RELAY_TOKEN!=='string'||env.SPONSOR_RELAY_TOKEN.length<32)throw fail('Paid AI is not configured for this installation.',503);
 const input=paidInput(report);if(input.prompt.length>16000)throw fail('This questionnaire is too large for the paid analysis service.');
 const max=Math.min(20,Math.max(0,Number(env.PAID_AI_MAX_JOBS||4)));if(!Number.isSafeInteger(max))throw fail('Paid AI allowance is invalid.',503);
 const nonce=randomHex(10),inputHash=await hashText(nonce+';'+JSON.stringify(input));
 await reserveDemoCharge(DB,report,'ai');
 const id=crypto.randomUUID();
 await run(DB,"INSERT OR IGNORE INTO care_paid_ai_jobs (id,report_id,nonce,input_hash,state,created_at,updated_at) SELECT ?,?,?,?,'queued',?,? WHERE (SELECT count(*) FROM care_paid_ai_jobs)<?",id,report.id,nonce,inputHash,now(),now(),max);
 const saved=await first(DB,'SELECT * FROM care_paid_ai_jobs WHERE report_id=?',report.id);
 if(!saved){await settleDemoCharge(DB,report,'ai',false);throw fail('The sponsor’s paid AI allowance is fully allocated. No new analysis has been purchased.',409,'PAID_AI_BUDGET');}
 // The real payment is independently capped above. App credits remain a demo ledger.
 await run(DB,"UPDATE care_reports SET ai_status='running',ai_error='',ai_started_at=?,updated_at=? WHERE id=? AND ai_json IS NULL",now(),now(),report.id);
 return saved;
}
async function authorize(request,env){
 const expected=env.SPONSOR_RELAY_TOKEN||'',actual=request.headers.get('authorization')||'';
 if(expected.length<32||actual.length>1000||!actual.startsWith('Bearer '))throw fail('Unauthorized.',401);
 const a=await hashText(actual.slice(7)),b=await hashText(expected);let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);if(difference)throw fail('Unauthorized.',401);
}
async function readBody(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('JSON required.',415);
 const reader=request.body?.getReader();if(!reader)throw fail('JSON required.');let size=0,chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>60000){await reader.cancel();throw fail('Request too large.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('Invalid JSON.');}
}
const states=['queued','escrow_pending','funded','running','result_submitted','result_ready','settled'];
function checkedMetadata(body,job){
 const old=JSON.parse(job.metadata_json),m={...old};
 if(body.inputHash!==job.input_hash)throw fail('Paid job input does not match this report.',409);
 if(!states.includes(body.state)&&body.state!=='blocked')throw fail('Invalid paid job state.');
 if(body.state!=='blocked'&&job.state!=='blocked'&&states.indexOf(body.state)<states.indexOf(job.state))throw fail('A confirmed paid job cannot move backwards.',409);
 for(const key of ['blockchainIdentifier','agentIdentifier','sellerAddress','jobId'])if(body[key]!==undefined){
  if(typeof body[key]!=='string'||!body[key]||body[key].length>1000)throw fail('Invalid payment identity.');
  if(old[key]&&body[key]!==old[key])throw fail('The paid job identity is immutable.',409);m[key]=body[key];
 }
 for(const key of ['fundingTxHash','resultTxHash','settlementTxHash','resultHash'])if(body[key]!==undefined){
  if(!/^[a-f0-9]{64}$/.test(body[key]))throw fail('Invalid transaction or result hash.');
  if(old[key]&&old[key]!==body[key])throw fail('The saved receipt cannot be replaced.',409);m[key]=body[key];
 }
 if(body.state!=='queued'&&body.state!=='blocked'&&!m.blockchainIdentifier)throw fail('The Masumi payment identity is required.');
 const rank=states.indexOf(body.state);
 if(rank>=2&&!m.fundingTxHash)throw fail('Confirmed escrow funding is required.');
 if(rank>=4&&(!m.resultHash))throw fail('A committed result hash is required.');
 if(rank>=5&&(!m.resultTxHash))throw fail('A confirmed result transaction is required.');
 if(body.state==='settled'){
  const r=body.receipt;
  if(!m.settlementTxHash||!r?.verified||r.txHash!==m.settlementTxHash||r.network!=='Preprod'||r.sellerAddress!==m.sellerAddress||r.unit!==TEST_USDM||r.netAtomicUnits!=='1000000'||!Number.isInteger(r.blockHeight)||r.blockHeight<=0)throw fail('A matching confirmed seller receipt is required.');
  m.receipt={verified:true,network:'Preprod',txHash:r.txHash,sellerAddress:r.sellerAddress,unit:TEST_USDM,netAtomicUnits:'1000000',blockHeight:r.blockHeight,verifiedAt:new Date().toISOString()};
 }
 return m;
}
export async function paidAIWorkerAPI(request,env,services={}){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/paid-ai/'))return null;
 try{
  const DB=env.DB;if(!DB?.prepare)throw fail('Paid analysis storage is unavailable.',503);
  if(path==='/api/paid-ai/status'&&request.method==='GET'){
   const heart=await first(DB,"SELECT last_seen FROM care_sponsor_relay WHERE id='paid-ai'");
   return json({configured:paidAIEnabled(env),online:paidAIEnabled(env)&&!!heart&&heart.last_seen>=now()-180,price:'1',asset:'test USDM',network:'Preprod'});
  }
  if(request.method!=='POST')throw fail('Method not allowed.',405);
  await authorize(request,env);const body=await readBody(request);
  if(path==='/api/paid-ai/lease'){
   if(!paidAIEnabled(env))return json({job:null});
   if(!/^[a-zA-Z0-9_-]{1,80}$/.test(body.workerId||''))throw fail('Worker identity required.');
   await run(DB,"INSERT INTO care_sponsor_relay (id,last_seen) VALUES ('paid-ai',?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",now());
   const job=await first(DB,"SELECT j.*,r.answers_json,r.program_json FROM care_paid_ai_jobs j JOIN care_reports r ON r.id=j.report_id WHERE j.state NOT IN ('settled','blocked') AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=?) ORDER BY j.updated_at,j.id LIMIT 1",now());
   if(!job)return json({job:null});
   const token=randomHex(24),saved=await run(DB,'UPDATE care_paid_ai_jobs SET lease_token=?,lease_worker=?,lease_expires_at=? WHERE id=? AND (lease_expires_at IS NULL OR lease_expires_at<=?)',token,body.workerId,now()+180,job.id,now());
   if(!Number(saved.meta?.changes??saved.changes))return json({job:null});
   return json({job:{...paidAIJSON(job),reportId:job.report_id,nonce:job.nonce,inputData:paidInput(job)},leaseToken:token});
  }
  const match=path.match(/^\/api\/paid-ai\/jobs\/([a-f0-9-]{36})$/);if(!match)throw fail('Not found.',404);
  const job=await first(DB,'SELECT * FROM care_paid_ai_jobs WHERE id=?',match[1]);if(!job)throw fail('Job not found.',404);
  if(!job.lease_token||body.leaseToken!==job.lease_token||job.lease_expires_at<now())throw fail('Paid analysis lease expired. Resume the saved job.',409);
  const m=checkedMetadata(body,job);
  if(['result_ready','settled'].includes(body.state)){
   if(typeof body.resultText!=='string'||body.resultText.length>24000||await hashText(job.nonce+';'+body.resultText)!==m.resultHash)throw fail('Result does not match the paid job hash.',409);
   if(typeof services.complete!=='function')throw fail('Result processing unavailable.',503);
   await services.complete(job.report_id,body.resultText);
  }
  const message=body.state==='blocked'?String(body.error||'This paid job needs operator inspection. Its payment references are preserved.').slice(0,600):'';
  await run(DB,'UPDATE care_paid_ai_jobs SET state=?,metadata_json=?,error=?,updated_at=?,lease_expires_at=? WHERE id=? AND lease_token=?',body.state,JSON.stringify(m),message,now(),body.keepLease===true?now()+180:null,job.id,body.leaseToken);
  return json({ok:true,job:paidAIJSON(await first(DB,'SELECT * FROM care_paid_ai_jobs WHERE id=?',job.id))});
 }catch(error){return json({error:error.code||'PAID_AI_ERROR',message:error.status?error.message:'Paid analysis update could not be verified.'},error.status||500);}
}
