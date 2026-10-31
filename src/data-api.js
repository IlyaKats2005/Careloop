import {getSession} from './auth.js';
import {DEFAULT_PROGRAMS,normalizeProgram} from './programs.js';
import {field,commitment as makeCommitment,leaf,tree,randomSecret,config} from './zk-core.js';
import {programFieldId,periodFieldId} from './reward-status.js';
import {rewardDecision} from './reward-policy.js';
import {enqueuePayment,payoutJSON,submitPaymentProof,normalizeRecipient} from './payment-jobs.js';
const COOKIE='__Host-careloop_demo';
const TTL=7*24*60*60;
const encoder=new TextEncoder();
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const randomHex=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const digest=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))));
const now=()=>Math.floor(Date.now()/1000);
const fail=(message,status=400,code='INVALID_INPUT')=>Object.assign(new Error(message),{status,code});
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff',...extra}});
const parse=(value,fallback=null)=>value?JSON.parse(value):fallback;
const event=message=>new Date().toISOString()+' · '+message;
const limits=new Map();
function throttle(key,max){const time=Date.now();for(const [k,v] of limits)if(v.until<=time)limits.delete(k);const entry=limits.get(key)||{count:0,until:time+3600000};if(entry.count>=max||limits.size>=2000&&!limits.has(key))throw fail('Demo request limit reached. Please try again later.',429,'RATE_LIMITED');entry.count++;limits.set(key,entry);}
function database(env){if(!env.DB?.prepare)throw fail('Workspace storage is temporarily unavailable.',503,'STORAGE_UNAVAILABLE');return env.DB;}
const first=(DB,sql,...args)=>DB.prepare(sql).bind(...args).first();
const run=(DB,sql,...args)=>DB.prepare(sql).bind(...args).run();
const all=async(DB,sql,...args)=>(await DB.prepare(sql).bind(...args).all()).results;
const changed=result=>Number(result?.meta?.changes??result?.changes??0);
function cookieToken(request){const values=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));if(values.length!==1)return null;const token=values[0].slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;}
function checkMutation(request){const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw fail('Origin not allowed.',403);if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('JSON required.',415);}
async function bodyOf(request){const reader=request.body?.getReader();if(!reader)throw fail('Request body required.');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw fail('Request too large.',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length;}try{const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw fail('Invalid JSON.');}}
function canonicalCommitment(value){if(typeof value!=='string'||!/^[1-9]\d{0,76}$/.test(value))throw fail('A valid public enrollment commitment is required.');try{if(field(value).toString()!==value)throw Error();}catch{throw fail('Invalid enrollment commitment.');}return value;}
export function currentPeriod(program,date=new Date()){
 const day=date.toISOString().slice(0,10);if(program.cadence==='Daily')return{id:day,label:day};
 if(program.cadence==='Monthly')return{id:day.slice(0,7),label:date.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})};
 const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const year=d.getUTCFullYear(),week=Math.ceil((((d-new Date(Date.UTC(year,0,1)))/86400000)+1)/7);const n=program.cadence==='Fortnightly'?Math.ceil(week/2):week;return{id:year+'-'+(program.cadence==='Fortnightly'?'F':'W')+String(n).padStart(2,'0'),label:(program.cadence==='Fortnightly'?'Fortnight ':'Week ')+n+' · '+year};
}
export function normalizeAnswers(body,program){
 if(body.fictional!==true)throw fail('Only fictional demo reports are accepted.');const source=body.answers;if(!source||typeof source!=='object'||Array.isArray(source))throw fail('Questionnaire answers required.');if(JSON.stringify(source).length>12000)throw fail('Report is too long.');
 const answers={};for(const key of ['medication','status','dose','lastDose','missed','changes','impact','hydration','details','contact','notes']){const value=source[key]??'';if(typeof value!=='string'||value.length>2500)throw fail('Invalid answer: '+key);answers[key]=value;}
 if(!answers.status.trim())throw fail('Current status is required.');
 if(!source.symptoms||typeof source.symptoms!=='object'||Array.isArray(source.symptoms))throw fail('Experience answers required.');
 const levels=new Set(['None','Mild','Moderate','Severe','Not sure']);answers.symptoms=Object.create(null);
 if(Object.keys(source.symptoms).some(key=>!program.symptoms.includes(key)))throw fail('Unknown questionnaire topic.');
 for(const topic of program.symptoms){if(!levels.has(source.symptoms[topic]))throw fail('Answer each experience topic.');answers.symptoms[topic]=source.symptoms[topic];}
 if(!Array.isArray(source.urgent)||source.urgent.length>10||source.urgent.some(x=>!program.urgentOptions.includes(x)))throw fail('Invalid concern indicator.');answers.urgent=[...new Set(source.urgent)];
 if(!answers.impact.trim()||!answers.hydration.trim()||!['Yes','No'].includes(answers.contact))throw fail('Complete the daily impact and contact questions.');
 return answers;
}
async function seed(DB,workspace){
 for(const template of DEFAULT_PROGRAMS){const id='P'+workspace.id.replaceAll('-','').slice(0,10)+'-'+template.id;const program=normalizeProgram({...template,id});await run(DB,'INSERT OR IGNORE INTO care_programs (id,workspace_id,config_json,invitation_code,created_at,updated_at) VALUES (?,?,?,?,?,?)',program.id,workspace.id,JSON.stringify(program),randomHex(12).toUpperCase(),now(),now());}
 if(workspace.mode==='demo'){const programs=await all(DB,'SELECT id FROM care_programs WHERE workspace_id=?',workspace.id);for(const p of programs)await ensureEnrollment(DB,p.id,workspace.id,'demo:'+workspace.id);}
}
async function ensureEnrollment(DB,programId,workspaceId,key){
 let enrollment=await first(DB,'SELECT * FROM care_enrollments WHERE program_id=? AND participant_key=?',programId,key);if(enrollment)return enrollment;
 await run(DB,'INSERT OR IGNORE INTO care_enrollments (id,program_id,workspace_id,participant_key,pseudonym,commitment,created_at) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),programId,workspaceId,key,'P-'+randomHex(4).toUpperCase(),null,now());
 return first(DB,'SELECT * FROM care_enrollments WHERE program_id=? AND participant_key=?',programId,key);
}
async function context(request,env){
 const DB=database(env),mode=new URL(request.url).searchParams.get('mode')||'account';
 if(mode==='demo'){const token=cookieToken(request);if(!token)throw fail('Start or resume your private demo first.',401,'DEMO_REQUIRED');const workspace=await first(DB,'SELECT * FROM care_workspaces WHERE demo_token_hash=? AND mode=?',await digest(token),'demo');if(!workspace||workspace.expires_at<=now())throw fail('This demo has expired. Start a new demo.',401,'DEMO_EXPIRED');return{DB,mode,role:'demo',workspace,key:'demo:'+workspace.id};}
 if(mode!=='account')throw fail('Invalid workspace mode.');
 const session=await getSession(request,env);if(!session.user)throw fail('Sign in to access your workspace.',401,'AUTH_REQUIRED');
 const user=session.user;if(user.role==='patient')return{DB,mode,role:'patient',workspace:{id:'patient:'+user.id,mode:'account'},key:user.id};
 let workspace=await first(DB,'SELECT * FROM care_workspaces WHERE owner_user_id=?',user.id);
 if(!workspace){await run(DB,'INSERT OR IGNORE INTO care_workspaces (id,owner_user_id,demo_token_hash,mode,expires_at,created_at) VALUES (?,?,?,?,?,?)',crypto.randomUUID(),user.id,null,'account',null,now());workspace=await first(DB,'SELECT * FROM care_workspaces WHERE owner_user_id=?',user.id);}
 await seed(DB,workspace);return{DB,mode,role:'clinic',workspace,key:user.id};
}
function canClinic(ctx){if(ctx.role!=='clinic'&&ctx.role!=='demo')throw fail('Only the program clinic can do this.',403,'CLINIC_REQUIRED');}
function canPatient(ctx){if(ctx.role!=='patient'&&ctx.role!=='demo')throw fail('Only an enrolled participant can do this.',403,'PARTICIPANT_REQUIRED');}
function enrollmentJSON(row){return{id:row.id,programId:row.program_id,participant:row.pseudonym,commitment:row.commitment};}
function reportJSON(row){return{recipientAddress:row.recipient_address||null,rewardDecision:parse(row.reward_decision_json,{state:row.approval_json?'approved':'checking',reasons:[],clinicalReview:'routine'}),payout:row.payment_job?payoutJSON(row.payment_job):{state:'not_requested',recipientAddress:row.recipient_address||null,error:row.payout_error||''},id:row.id,programId:row.program_id,programConfig:parse(row.program_json),participant:row.pseudonym,periodId:row.period_id,period:row.period_label,date:new Date(row.created_at*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),quality:row.quality,clinical:row.clinical,payment:row.payment,answers:parse(row.answers_json),ai:parse(row.ai_json),aiError:row.ai_error,aiStatus:row.ai_status,audit:parse(row.audit_json,[]),decision:row.decision,rewardApproval:parse(row.approval_json),chain:parse(row.chain_json,{}),createdAt:new Date(row.created_at*1000).toISOString()};}
async function payload(ctx){
 const {DB}=ctx;let programs,enrollments,reports;
 if(ctx.role==='patient'){
  programs=await all(DB,'SELECT p.* FROM care_programs p JOIN care_enrollments e ON e.program_id=p.id WHERE e.participant_key=? ORDER BY p.created_at,p.id',ctx.key);
  enrollments=await all(DB,'SELECT * FROM care_enrollments WHERE participant_key=?',ctx.key);
  reports=await all(DB,'SELECT r.*,e.pseudonym FROM care_reports r JOIN care_enrollments e ON e.id=r.enrollment_id WHERE e.participant_key=? ORDER BY r.created_at DESC,r.id',ctx.key);
 }else{
  programs=await all(DB,'SELECT * FROM care_programs WHERE workspace_id=? ORDER BY created_at,id',ctx.workspace.id);
  enrollments=await all(DB,'SELECT * FROM care_enrollments WHERE workspace_id=?',ctx.workspace.id);
  reports=await all(DB,'SELECT r.*,e.pseudonym FROM care_reports r JOIN care_enrollments e ON e.id=r.enrollment_id WHERE r.workspace_id=? ORDER BY r.created_at DESC,r.id',ctx.workspace.id);
 }
 const jobs=await all(DB,'SELECT j.* FROM care_payment_jobs j JOIN care_reports r ON r.id=j.report_id WHERE '+(ctx.role==='patient'?'r.enrollment_id IN (SELECT id FROM care_enrollments WHERE participant_key=?)':'r.workspace_id=?'),ctx.role==='patient'?ctx.key:ctx.workspace.id);const jobsByReport=new Map(jobs.map(j=>[j.report_id,j]));for(const report of reports)report.payment_job=jobsByReport.get(report.id);
 return{workspace:{id:ctx.workspace.id,mode:ctx.mode,role:ctx.role,expiresAt:ctx.workspace.expires_at?new Date(ctx.workspace.expires_at*1000).toISOString():null},programs:programs.map(p=>({...parse(p.config_json),...(ctx.role==='patient'?{}:{invitationCode:p.invitation_code})})),enrollments:enrollments.map(enrollmentJSON),reports:reports.map(reportJSON)};
}
async function programFor(ctx,id,ownerOnly=false){
 const program=await first(ctx.DB,'SELECT * FROM care_programs WHERE id=?',id);
 if(!program)throw fail('Program not found.',404);
 if(ownerOnly||ctx.role!=='patient'){if(program.workspace_id!==ctx.workspace.id)throw fail('Program not found.',404);}
 else if(!await first(ctx.DB,'SELECT id FROM care_enrollments WHERE program_id=? AND participant_key=?',id,ctx.key))throw fail('Program not found.',404);
 return program;
}
async function reportFor(ctx,id){
 const row=await first(ctx.DB,'SELECT r.*,e.pseudonym,e.participant_key,e.commitment FROM care_reports r JOIN care_enrollments e ON e.id=r.enrollment_id WHERE r.id=?',id);
 if(!row||(ctx.role==='patient'?row.participant_key!==ctx.key:row.workspace_id!==ctx.workspace.id))throw fail('Report not found.',404);
 row.payment_job=await first(ctx.DB,'SELECT * FROM care_payment_jobs WHERE report_id=?',id);return row;
}
async function bindCommitment(ctx,enrollment,value){
 if(value===undefined||value===null){if(!enrollment.commitment)throw fail('Create a private enrollment before submitting this report.');return enrollment.commitment;}
 const commit=canonicalCommitment(value);if(enrollment.commitment&&enrollment.commitment!==commit)throw fail('This enrollment uses a different private secret. Restore its recovery file.',409,'COMMITMENT_MISMATCH');
 try{await run(ctx.DB,'UPDATE care_enrollments SET commitment=? WHERE id=? AND (commitment IS NULL OR commitment=?)',commit,enrollment.id,commit);}catch(error){if(/unique|constraint/i.test(String(error)))throw fail('This commitment is already enrolled in the program.',409);throw error;}
 const current=await first(ctx.DB,'SELECT commitment FROM care_enrollments WHERE id=?',enrollment.id);if(current.commitment!==commit)throw fail('Enrollment commitment changed. Reload and retry.',409);return commit;
}
async function approveReport(ctx,report,decision,source,env){
 if(decision.state!=='approved')throw fail('Reward clarification is required before authorization.',409);
 const DB=ctx.DB;
 if(!report.approval_json){
  const commit=canonicalCommitment(report.commitment),c={...config,program:programFieldId(report.program_id),period:periodFieldId(report.period_id),domain:randomSecret()};
  const leaves=Array.from({length:8},()=>leaf(makeCommitment(randomSecret()),c));const index=crypto.getRandomValues(new Uint8Array(1))[0]%8;leaves[index]=leaf(commit,c);
  const approval={...tree(leaves,index),c,commitment:commit,reportId:report.id,programId:report.program_id,periodId:report.period_id,periodLabel:report.period_label};
  await run(DB,"UPDATE care_reports SET approval_json=?,payment='Approved',reward_decision_json=?,audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=? AND approval_json IS NULL",JSON.stringify(approval),JSON.stringify(decision),event(source==='clinic'?'Clinic approved reward eligibility.':'Automatic completion policy approved the reward. This is not a medical decision.'),now(),report.id);
 }else if(source==='clinic'&&parse(report.reward_decision_json,{})?.source!=='clinic'){
  await run(DB,"UPDATE care_reports SET payment='Approved',reward_decision_json=?,audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=?",JSON.stringify(decision),event('Clinic confirmed reward eligibility after reviewing the saved report.'),now(),report.id);
 }
 const fresh=await reportFor(ctx,report.id);try{await enqueuePayment(DB,env,fresh);await run(DB,"UPDATE care_reports SET payout_error='' WHERE id=?",report.id);}catch(error){if(error.code!=='SPONSOR_BUDGET')throw error;await run(DB,'UPDATE care_reports SET payout_error=? WHERE id=?',error.message,report.id);}return reportFor(ctx,report.id);
}
function chainMetadata(body){
 if(!['fund','claim'].includes(body.kind)||typeof body.txHash!=='string'||!/^[a-f0-9]{64}$/i.test(body.txHash))throw fail('A valid transaction hash and kind are required.');
 const result={txHash:body.txHash.toLowerCase(),verified:false,submittedAt:new Date().toISOString()};
 if(body.dep!==undefined){const dep=body.dep;if(!dep||typeof dep!=='object'||dep.network!=='Preprod'||JSON.stringify(dep).length>3000)throw fail('Invalid Preprod pool metadata.');
  if(!dep.seed||typeof dep.seed.txHash!=='string'||!/^[a-f0-9]{64}$/i.test(dep.seed.txHash)||!Number.isSafeInteger(dep.seed.outputIndex)||dep.seed.outputIndex<0||typeof dep.clinic!=='string'||!/^[a-f0-9]{56}$/i.test(dep.clinic)||typeof dep.address!=='string'||!/^addr_test1[a-z0-9]{40,180}$/.test(dep.address)||typeof dep.unit!=='string'||!/^[a-f0-9]{56,120}$/i.test(dep.unit))throw fail('Invalid pool metadata.');
  result.dep={network:'Preprod',seed:{txHash:dep.seed.txHash,outputIndex:dep.seed.outputIndex},clinic:dep.clinic,address:dep.address,unit:dep.unit};}
 return result;
}
export async function dataAPI(request,env={},services={}){
 const url=new URL(request.url),path=url.pathname;
 if(path!=='/api/workspace'&&path!=='/api/demo/start'&&!path.startsWith('/api/data/'))return null;
 try{
  if(request.method!=='GET'){checkMutation(request);}
  if(path==='/api/demo/start'){
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   const DB=database(env);const previous=cookieToken(request);if(previous){const existing=await first(DB,'SELECT * FROM care_workspaces WHERE demo_token_hash=? AND mode=?',await digest(previous),'demo');if(existing&&existing.expires_at>now())return json(await payload({DB,mode:'demo',role:'demo',workspace:existing,key:'demo:'+existing.id}));}
   throttle('demo:'+(request.headers.get('cf-connecting-ip')||'local'),8);
   const token=randomHex(32),workspace={id:crypto.randomUUID(),mode:'demo',expires_at:now()+TTL};
   await run(DB,'INSERT INTO care_workspaces (id,owner_user_id,demo_token_hash,mode,expires_at,created_at) VALUES (?,?,?,?,?,?)',workspace.id,null,await digest(token),'demo',workspace.expires_at,now());await seed(DB,workspace);
   return json(await payload({DB,mode:'demo',role:'demo',workspace,key:'demo:'+workspace.id}),200,{'Set-Cookie':`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL}`});
  }
  const ctx=await context(request,env),DB=ctx.DB;
  if(path==='/api/workspace'){if(request.method!=='GET')return json({error:'Method not allowed'},405);return json(await payload(ctx));}
  const statusMatch=path.match(/^\/api\/data\/reports\/(R-[a-f0-9-]+)\/status$/);if(statusMatch&&request.method==='GET')return json({report:reportJSON(await reportFor(ctx,statusMatch[1]))});
  if(!['POST','PATCH'].includes(request.method))return json({error:'Method not allowed'},405);
  const body=await bodyOf(request);
  if(path==='/api/data/programs'&&request.method==='POST'){
   canClinic(ctx);const count=await first(DB,'SELECT count(*) AS n FROM care_programs WHERE workspace_id=?',ctx.workspace.id);if(count.n>=30)throw fail('This workspace supports up to 30 programs.',409);
   const input=normalizeProgram(body.program),program=normalizeProgram({...input,id:input.id.slice(0,21)+'-'+randomHex(5).toUpperCase()});const code=randomHex(12).toUpperCase();
   await run(DB,'INSERT INTO care_programs (id,workspace_id,config_json,invitation_code,created_at,updated_at) VALUES (?,?,?,?,?,?)',program.id,ctx.workspace.id,JSON.stringify(program),code,now(),now());
   if(ctx.mode==='demo')await ensureEnrollment(DB,program.id,ctx.workspace.id,ctx.key);
   return json({program:{...program,invitationCode:code}},201);
  }
  const programMatch=path.match(/^\/api\/data\/programs\/([A-Z0-9_-]+)$/);
  if(programMatch&&request.method==='PATCH'){
   canClinic(ctx);const existing=await programFor(ctx,programMatch[1],true),program=normalizeProgram(body.program);if(program.id!==existing.id)throw fail('Program ID cannot be changed.');
   await run(DB,'UPDATE care_programs SET config_json=?,updated_at=? WHERE id=? AND workspace_id=?',JSON.stringify(program),now(),program.id,ctx.workspace.id);return json({program:{...program,invitationCode:existing.invitation_code}});
  }
  if(path==='/api/data/enroll'&&request.method==='POST'){
   canPatient(ctx);if(typeof body.code!=='string'||!body.code.trim())throw fail('Enter a program invitation code.');
   const p=await first(DB,'SELECT p.*,w.mode AS workspace_mode,w.expires_at FROM care_programs p JOIN care_workspaces w ON w.id=p.workspace_id WHERE p.invitation_code=?',body.code.trim().toUpperCase());
   if(!p||(ctx.mode==='demo'?p.workspace_id!==ctx.workspace.id:p.workspace_mode!=='account')||!parse(p.config_json).active)throw fail('Invitation code is unavailable.',404);
   let enrollment=await ensureEnrollment(DB,p.id,p.workspace_id,ctx.key);if(body.commitment!=null){await bindCommitment(ctx,enrollment,body.commitment);enrollment=await first(DB,'SELECT * FROM care_enrollments WHERE id=?',enrollment.id);}
   return json({enrollment:enrollmentJSON(enrollment),program:parse(p.config_json)});
  }
  if(path==='/api/data/reports'&&request.method==='POST'){
   canPatient(ctx);const p=await programFor(ctx,body.programId),program=parse(p.config_json);if(!program.active)throw fail('This program is paused.',409);
   const period=currentPeriod(program);if(body.periodId!==period.id)throw fail('This report must use the current reporting period.',409,'PERIOD_MISMATCH');
   const enrollment=await first(DB,'SELECT * FROM care_enrollments WHERE program_id=? AND participant_key=?',program.id,ctx.key);if(!enrollment)throw fail('Join the program before submitting.',403);
   await bindCommitment(ctx,enrollment,body.commitment);const answers=normalizeAnswers(body,program),id='R-'+crypto.randomUUID();
   const recipient=normalizeRecipient(body.recipientAddress||''),decision=rewardDecision(answers,program,null);
   const quality=Object.values(answers.symptoms).includes('Not sure')?'Clarification needed':'Complete';
   try{await run(DB,'INSERT INTO care_reports (id,workspace_id,program_id,enrollment_id,period_id,period_label,program_json,answers_json,quality,clinical,payment,audit_json,created_at,updated_at,recipient_address,reward_decision_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,p.workspace_id,program.id,enrollment.id,period.id,period.label,JSON.stringify(program),JSON.stringify(answers),quality,'Awaiting review','Pending',JSON.stringify([event('Participant submitted a fictional report. Original answers saved.')]),now(),now(),recipient?.address||null,JSON.stringify(decision));}catch(error){if(/unique|constraint/i.test(String(error)))throw fail('A report is already saved for this program and reporting period.',409,'DUPLICATE_REPORT');throw error;}
   return json({report:reportJSON(await reportFor(ctx,id))},201);
  }
  const match=path.match(/^\/api\/data\/reports\/(R-[a-f0-9-]+)\/(review|analyze|chain|proof)$/);
  if(!match||request.method!=='POST')return json({error:'Not found'},404);
  const report=await reportFor(ctx,match[1]);
  if(match[2]==='review'){
   canClinic(ctx);if(!['review','clarify','approve'].includes(body.action))throw fail('Invalid review action.');const note=typeof body.note==='string'?body.note.trim():'';if(note.length>2500)throw fail('Review note is too long.');
   if(body.action==='approve'){
    if(body.eligible!==true)throw fail('Confirm reward eligibility.');const previous=parse(report.reward_decision_json,{});await approveReport(ctx,report,{state:'approved',source:'clinic',version:1,clinicalReview:previous.clinicalReview||'routine',reasons:['The clinic confirmed eligibility and completion.']},'clinic',env);
   }else{
    if(!note)throw fail('Add a clinic review note.');await run(DB,"UPDATE care_reports SET clinical=?,decision=?,audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=?",body.action==='review'?'Reviewed':'Clarification requested',note,event(body.action==='review'?'Clinic reviewed the report.':'Clinic requested clarification.'),now(),report.id);
   }
   return json({report:reportJSON(await reportFor(ctx,report.id))});
  }
  if(match[2]==='proof'){canPatient(ctx);if(!report.approval_json)throw fail('Reward approval is required before a claim.',409);await submitPaymentProof(DB,report,body);return json({report:reportJSON(await reportFor(ctx,report.id))});}
  if(match[2]==='chain'){
   if(body.kind==='fund')canClinic(ctx);else canPatient(ctx);if(!report.approval_json)throw fail('Clinic approval is required first.',409);
   if(report.payment_job)throw fail('This report uses the sponsor relay. Payment references are recorded by that relay.',409);
   const metadata=chainMetadata(body),previous=parse(report.chain_json,{})[body.kind];
   if(previous){if(previous.txHash!==metadata.txHash)throw fail('A different transaction is already recorded for this step. Its pool reference has been preserved.',409,'TRANSACTION_CONFLICT');if(previous.dep&&metadata.dep&&JSON.stringify(previous.dep)!==JSON.stringify(metadata.dep))throw fail('The saved pool metadata cannot be replaced.',409,'POOL_CONFLICT');if(previous.dep&&!metadata.dep)metadata.dep=previous.dep;}
   const path='$.'+body.kind,hashPath=path+'.txHash';
   const updated=await run(DB,"UPDATE care_reports SET chain_json=json_set(chain_json,?,json(?)),audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=? AND (json_extract(chain_json,?) IS NULL OR json_extract(chain_json,?)=?)",path,JSON.stringify(metadata),event('A '+body.kind+' transaction hash was recorded. Chain confirmation has not been verified by this server.'),now(),report.id,hashPath,hashPath,metadata.txHash);
   if(!changed(updated))throw fail('A transaction was recorded concurrently. Reload the report before continuing.',409,'TRANSACTION_CONFLICT');
   return json({report:reportJSON(await reportFor(ctx,report.id))});
  }
  if(typeof services.analyze!=='function')throw fail('AI analysis is temporarily unavailable.',503);
  if(report.ai_json){
   const previous=parse(report.reward_decision_json,{}),clinicApproved=report.approval_json&&previous.source==='clinic'&&previous.state==='approved';
   const decision=clinicApproved?previous:rewardDecision(parse(report.answers_json),parse(report.program_json),parse(report.ai_json));
   if(decision.state==='approved')return json({report:reportJSON(await approveReport(ctx,report,decision,clinicApproved?'clinic':'policy',env))});
   // Recheck cached analysis before creating any payment. Issued approvals and
   // existing transactions remain historical facts; this route cannot undo them.
   const chain=parse(report.chain_json,{});
   if(!report.payment_job&&!chain.fund&&!chain.claim)await run(DB,"UPDATE care_reports SET reward_decision_json=?,payment='On hold',updated_at=? WHERE id=?",JSON.stringify(decision),now(),report.id);
   return json({report:reportJSON(await reportFor(ctx,report.id))});
  }
  throttle('ai:'+ctx.key,6);
  const lock=await run(DB,"UPDATE care_reports SET ai_status='running',ai_started_at=?,ai_attempts=ai_attempts+1 WHERE id=? AND ai_attempts<5 AND (ai_status!='running' OR ai_started_at<?)",now(),report.id,now()-120);
  if(!changed(lock))throw fail(report.ai_attempts>=5?'Analysis retry limit reached for this report.':'Analysis is already running. Refresh the report shortly.',409,'ANALYSIS_BUSY');
  let result;try{result=await services.analyze(parse(report.answers_json),env,services.fetcher||fetch,parse(report.program_json));}catch{result={status:502,body:{message:'The model timed out or returned an invalid result. Clinic review can continue.'}};}
  if(result.status===200){
   const ai={...result.body,approval:false,clinical_validation:false},decision=rewardDecision(parse(report.answers_json),parse(report.program_json),ai);
   const clinical=decision.clinicalReview==='priority_review'?'Priority review':decision.clinicalReview==='review_requested'?'Review requested':'Routine';
   await run(DB,"UPDATE care_reports SET ai_json=?,ai_error='',ai_status='complete',clinical=CASE WHEN clinical IN ('Awaiting review','Routine','Review requested','Priority review') THEN ? ELSE clinical END,reward_decision_json=CASE WHEN approval_json IS NULL THEN ? ELSE reward_decision_json END,payment=CASE WHEN approval_json IS NULL AND ?='on_hold' THEN 'On hold' ELSE payment END,audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=?",JSON.stringify(ai),clinical,JSON.stringify(decision),decision.state,event(decision.state==='approved'?'AI analysis saved. Completion policy passed.':'AI analysis saved. Completion reward needs clarification.'),now(),report.id);
   let fresh=await reportFor(ctx,report.id);const previous=parse(fresh.reward_decision_json,{}),clinicApproved=fresh.approval_json&&previous.source==='clinic'&&previous.state==='approved';
   if(decision.state==='approved'||clinicApproved)fresh=await approveReport(ctx,fresh,clinicApproved?previous:decision,clinicApproved?'clinic':'policy',env);
   return json({report:reportJSON(fresh)});
  }
  const message=String(result.body?.message||result.body?.error||'AI analysis unavailable.').slice(0,1000),decision=rewardDecision(parse(report.answers_json),parse(report.program_json),null,{error:true});
  await run(DB,"UPDATE care_reports SET ai_error=?,ai_status='failed',reward_decision_json=CASE WHEN approval_json IS NULL THEN ? ELSE reward_decision_json END,payment=CASE WHEN approval_json IS NULL THEN 'On hold' ELSE payment END,audit_json=json_insert(audit_json,'$[#]',?),updated_at=? WHERE id=?",message,JSON.stringify(decision),event('AI analysis failed. Reward authorization is on hold unless already approved by the clinic.'),now(),report.id);
  return json({error:'ANALYSIS_UNAVAILABLE',message,report:reportJSON(await reportFor(ctx,report.id))},result.status||502);
 }catch(error){const status=error.status||(/must |required|invalid|choose |supports |contain |demo assistant/i.test(error.message||'')?400:500);return json({error:error.code||'WORKSPACE_ERROR',message:status===500?'Workspace service is temporarily unavailable. Please try again.':error.message},status);}
}
