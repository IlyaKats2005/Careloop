import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {dataAPI,currentPeriod,normalizeAnswers} from '../src/data-api.js';
import {commitment,leaf,hash,field} from '../src/zk-core.js';
import {bech32} from '@scure/base';
let ip=0;
function database(){const sqlite=new DatabaseSync(':memory:');for(const name of ['0000_email_auth','0001_workspace_data','0002_automatic_rewards'])sqlite.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));return{sqlite,prepare(sql){const statement=sqlite.prepare(sql);return{bind(...args){return{async first(){return statement.get(...args)||null;},async all(){return{results:statement.all(...args)};},async run(){const result=statement.run(...args);return{meta:{changes:Number(result.changes)}};}};}};}};}
const sha=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
async function user(DB,role){const id=crypto.randomUUID(),token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');DB.sqlite.prepare('INSERT INTO auth_users VALUES (?,?,?,?,?,?,?,?)').run(id,id+'@example.test',role,role,'hash','salt',100000,1);DB.sqlite.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(await sha(token),id,1,Math.floor(Date.now()/1000)+3600);return{cookie:'__Host-careloop_session='+token,id};}
async function call(DB,path,{cookie='',method='GET',body,services={},env={}}={}){const request=new Request('https://careloop.test'+path,{method,headers:{cookie,'Content-Type':'application/json',Origin:'https://careloop.test','cf-connecting-ip':'data-test-'+(++ip)},...(body===undefined?{}:{body:JSON.stringify(body)})});const response=await dataAPI(request,{DB,...env},services);return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const answerFor=p=>({dose:'',lastDose:'',missed:'No',changes:'',details:'',status:'Feeling okay',medication:p.medicationOptions[0]||'',symptoms:Object.fromEntries(p.symptoms.map(s=>[s,'None'])),urgent:[],impact:'Not at all',hydration:'Yes',contact:'No',notes:'Fictional report.'});
const reportFor=(p,secret='123')=>({programId:p.id,periodId:currentPeriod(p).id,fictional:true,answers:answerFor(p),commitment:commitment(secret)});
async function setup(){const DB=database(),clinic=await user(DB,'clinic'),patient=await user(DB,'patient');const workspace=(await call(DB,'/api/workspace',{cookie:clinic.cookie})).body;const program=workspace.programs[0];await call(DB,'/api/data/enroll',{cookie:patient.cookie,method:'POST',body:{code:program.invitationCode}});return{DB,clinic,patient,workspace,program};}

test('clinic programs, invitations and reports are shared only with enrolled accounts',async()=>{
 const {DB,clinic,patient,program}=await setup();const otherClinic=await user(DB,'clinic'),stranger=await user(DB,'patient');
 const other=(await call(DB,'/api/workspace',{cookie:otherClinic.cookie})).body;assert.equal(other.programs.length,3);assert.ok(other.programs.every(p=>p.id!==program.id));
 const enrolled=(await call(DB,'/api/workspace',{cookie:patient.cookie})).body;assert.equal(enrolled.programs.length,1);assert.equal(enrolled.programs[0].invitationCode,undefined);assert.equal(enrolled.enrollments[0].commitment,null);
 const submitted=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...reportFor(program),payment:'Paid',clinical:'Reviewed',ai:{summary:'client injection'}}});assert.equal(submitted.status,201);const report=submitted.body.report;
 assert.equal(report.payment,'Pending');assert.equal(report.clinical,'Awaiting review');assert.equal(report.ai,null);assert.ok(report.participant.startsWith('P-'));
 const clinicView=(await call(DB,'/api/workspace',{cookie:clinic.cookie})).body;assert.equal(clinicView.reports[0].id,report.id);assert.ok(!JSON.stringify(clinicView).includes(patient.id+'@example.test'));
 const nextSession=await call(DB,'/api/workspace',{cookie:patient.cookie});assert.deepEqual(nextSession.body.reports[0].answers,answerFor(program));
 assert.equal((await call(DB,'/api/workspace',{cookie:stranger.cookie})).body.reports.length,0);
 assert.equal((await call(DB,'/api/data/reports/'+report.id+'/review',{cookie:otherClinic.cookie,method:'POST',body:{action:'review',note:'wrong clinic'}})).status,404);
 assert.equal((await call(DB,'/api/data/reports/'+report.id+'/review',{cookie:patient.cookie,method:'POST',body:{action:'approve',eligible:true}})).status,403);
 assert.equal((await call(DB,'/api/data/reports/'+report.id+'/analyze',{cookie:stranger.cookie,method:'POST',body:{}})).status,404);
 assert.equal((await call(DB,'/api/data/programs/'+program.id,{cookie:patient.cookie,method:'PATCH',body:{program}})).status,403);
 DB.sqlite.close();
});

test('database enforces one report per enrollment/period and binds the original commitment',async()=>{
 const {DB,patient,program}=await setup();const payload=reportFor(program);
 const concurrent=await Promise.all([call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:payload}),call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:payload})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_reports').get().n,1);
 const future=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...payload,periodId:'2099-W01'}});assert.equal(future.status,409);
 const changed=await call(DB,'/api/data/enroll',{cookie:patient.cookie,method:'POST',body:{code:program.invitationCode,commitment:commitment('456')}});assert.equal(changed.status,409);assert.equal(changed.body.error,'COMMITMENT_MISMATCH');
 DB.sqlite.close();
});

test('AI uses immutable saved answers/configuration; only completion policy creates an approval',async()=>{
 const {DB,clinic,patient,program}=await setup();const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:reportFor(program)});const id=created.body.report.id;
 const updated={...program,name:'Changed program',symptoms:['New topic']};assert.equal((await call(DB,'/api/data/programs/'+program.id,{cookie:clinic.cookie,method:'PATCH',body:{program:updated}})).status,200);
 let calls=0;const services={analyze:async(answers,env,fetcher,saved)=>{calls++;assert.deepEqual(answers,answerFor(program));assert.equal(saved.name,program.name);return{status:200,body:{summary:'Fixture analysis',review_priority:'routine',findings:[],missing_information:[],possible_contradictions:[],submission_validity:{status:'clear',issues:[]},approval:true,clinical_validation:true}};}};
 const result=await call(DB,'/api/data/reports/'+id+'/analyze',{cookie:patient.cookie,method:'POST',body:{answers:{status:'injected'},program:updated},services});assert.equal(result.status,200);assert.equal(result.body.report.ai.approval,false);assert.equal(result.body.report.clinical,'Routine');assert.equal(result.body.report.payment,'Approved');assert.equal(result.body.report.rewardDecision.state,'approved');assert.ok(result.body.report.rewardApproval);assert.equal(result.body.report.payout.state,'not_requested');
 const reread=(await call(DB,'/api/workspace',{cookie:clinic.cookie})).body.reports[0];assert.equal(reread.ai.summary,'Fixture analysis');assert.equal(reread.programConfig.name,program.name);
 await call(DB,'/api/data/reports/'+id+'/analyze',{cookie:patient.cookie,method:'POST',body:{},services});assert.equal(calls,1);
 DB.sqlite.close();
});

test('clinic approval produces a valid public Merkle path and chain metadata never claims payment',async()=>{
 const {DB,clinic,patient,program}=await setup();const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:reportFor(program)});const id=created.body.report.id;
 const approved=await call(DB,'/api/data/reports/'+id+'/review',{cookie:clinic.cookie,method:'POST',body:{action:'approve',eligible:true,note:'Complete report'}});assert.equal(approved.status,200);const approval=approved.body.report.rewardApproval;
 assert.equal(approval.commitment,commitment('123'));assert.equal(approval.c.amount,'2000000');assert.equal(approval.secret,undefined);assert.equal(approval.nullifier,undefined);
 let node=field(leaf(approval.commitment,approval.c));approval.siblings.forEach((s,i)=>{node=approval.directions[i]==='0'?hash(node,s):hash(s,node);});assert.equal(node.toString(),approval.root);
 const chain=await call(DB,'/api/data/reports/'+id+'/chain',{cookie:patient.cookie,method:'POST',body:{kind:'claim',txHash:'a'.repeat(64),confirmed:true,payment:'Paid',secret:'never-store'}});assert.equal(chain.status,200);assert.equal(chain.body.report.payment,'Approved');assert.equal(chain.body.report.chain.claim.verified,false);assert.equal(chain.body.report.chain.claim.secret,undefined);
 const dep={network:'Preprod',seed:{txHash:'c'.repeat(64),outputIndex:0,secret:'never-store'},clinic:'d'.repeat(56),address:'addr_test1'+'a'.repeat(55),unit:'e'.repeat(56),secret:'never-store'};
 const parallel=await Promise.all([call(DB,'/api/data/reports/'+id+'/chain',{cookie:clinic.cookie,method:'POST',body:{kind:'fund',txHash:'b'.repeat(64),dep}}),call(DB,'/api/data/reports/'+id+'/chain',{cookie:patient.cookie,method:'POST',body:{kind:'claim',txHash:'a'.repeat(64)}})]);assert.ok(parallel.every(r=>r.status===200));
 const saved=(await call(DB,'/api/workspace',{cookie:clinic.cookie})).body.reports[0];assert.equal(saved.chain.fund.txHash,'b'.repeat(64));assert.equal(saved.chain.claim.txHash,'a'.repeat(64));assert.ok(!JSON.stringify(saved.chain).includes('never-store'));
 assert.equal((await call(DB,'/api/data/reports/'+id+'/chain',{cookie:clinic.cookie,method:'POST',body:{kind:'fund',txHash:'f'.repeat(64)}})).status,409);
 assert.equal((await call(DB,'/api/data/reports/'+id+'/chain',{cookie:patient.cookie,method:'POST',body:{kind:'fund',txHash:'b'.repeat(64)}})).status,403);
 const again=await call(DB,'/api/data/reports/'+id+'/review',{cookie:clinic.cookie,method:'POST',body:{action:'approve',eligible:true}});assert.equal(again.body.report.rewardApproval.root,approval.root);
 DB.sqlite.close();
});

test('custom questionnaire names cannot modify object prototypes',()=>{
 const program={symptoms:['__proto__','constructor'],urgentOptions:[]};
 const answers=normalizeAnswers({fictional:true,answers:{status:'Fictional',symptoms:JSON.parse('{"__proto__":"Mild","constructor":"None"}'),urgent:[],impact:'Not at all',hydration:'Yes',contact:'No'}},program);
 assert.equal(Object.getPrototypeOf(answers.symptoms),null);assert.equal(answers.symptoms.__proto__,'Mild');assert.equal(answers.symptoms.constructor,'None');
});

test('guest demos persist privately across reloads and never mix with accounts or another guest',async()=>{
 const DB=database();const a=await call(DB,'/api/demo/start',{method:'POST',body:{}}),b=await call(DB,'/api/demo/start',{method:'POST',body:{}});assert.equal(a.body.programs.length,3);assert.equal(a.body.enrollments.length,3);assert.notEqual(a.body.workspace.id,b.body.workspace.id);
 const program=a.body.programs[0],submitted=await call(DB,'/api/data/reports?mode=demo',{cookie:a.cookie,method:'POST',body:reportFor(program)});assert.equal(submitted.status,201);
 const reload=await call(DB,'/api/workspace?mode=demo',{cookie:a.cookie});assert.equal(reload.body.reports.length,1);
 assert.equal((await call(DB,'/api/workspace?mode=demo',{cookie:b.cookie})).body.reports.length,0);
 assert.equal((await call(DB,'/api/data/reports/'+submitted.body.report.id+'/review?mode=demo',{cookie:b.cookie,method:'POST',body:{action:'approve',eligible:true}})).status,404);
 assert.equal((await call(DB,'/api/workspace',{cookie:a.cookie})).status,401);
 DB.sqlite.prepare('UPDATE care_workspaces SET expires_at=1 WHERE id=?').run(a.body.workspace.id);assert.equal((await call(DB,'/api/workspace?mode=demo',{cookie:a.cookie})).status,401);
 DB.sqlite.close();
});

const recipientAddress=bech32.encode('addr_test',bech32.toWords(Uint8Array.from([0x60,...new Array(28).fill(17)])),120);
const relayEnv={SPONSOR_RELAY_TOKEN:'test-only-'.repeat(5),SPONSOR_MAX_JOBS:'4'};
const cleanAI={summary:'Fictional completed check-in.',review_priority:'routine',findings:[],missing_information:[],possible_contradictions:[],submission_validity:{status:'clear',issues:[]}};

test('clean report automatically queues a real sponsor job and status is scoped to its participant',async()=>{
 const {DB,patient,clinic,program}=await setup();const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...reportFor(program),recipientAddress},env:relayEnv});assert.equal(created.status,201);const id=created.body.report.id;
 const result=await call(DB,`/api/data/reports/${id}/analyze`,{cookie:patient.cookie,method:'POST',body:{payment:'Paid'},env:relayEnv,services:{analyze:async()=>({status:200,body:cleanAI})}});
 assert.equal(result.status,200);assert.equal(result.body.report.payment,'Approved');assert.equal(result.body.report.rewardDecision.state,'approved');assert.equal(result.body.report.payout.state,'queued');assert.equal(result.body.report.payout.recipientAddress,recipientAddress);assert.equal(result.body.report.payout.claimTxHash,null);
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,1);
 const again=await call(DB,`/api/data/reports/${id}/analyze`,{cookie:patient.cookie,method:'POST',body:{},env:relayEnv,services:{analyze:()=>{throw Error('must use saved analysis')}}});assert.equal(again.status,200);assert.equal(again.body.report.rewardApproval.root,result.body.report.rewardApproval.root);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,1);
 const fresh=await call(DB,`/api/data/reports/${id}/status`,{cookie:patient.cookie});assert.equal(fresh.body.report.payout.id,result.body.report.payout.id);
 const other=await user(DB,'patient');assert.equal((await call(DB,`/api/data/reports/${id}/status`,{cookie:other.cookie})).status,404);
 assert.equal((await call(DB,`/api/data/reports/${id}/proof`,{cookie:clinic.cookie,method:'POST',body:{}})).status,403);
 assert.equal((await call(DB,`/api/data/reports/${id}/chain`,{cookie:patient.cookie,method:'POST',body:{kind:'claim',txHash:'a'.repeat(64),confirmed:true}})).status,409);
 DB.sqlite.close();
});

test('concerning symptoms still authorize completion while answer inconsistencies go on hold',async()=>{
 for(const contradict of [false,true]){
  const {DB,patient,program}=await setup();const payload=reportFor(program);payload.answers.symptoms[program.symptoms[0]]='Severe';payload.answers.contact='Yes';
  const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...payload,recipientAddress},env:relayEnv});const id=created.body.report.id;
  const result=await call(DB,`/api/data/reports/${id}/analyze`,{cookie:patient.cookie,method:'POST',body:{},env:relayEnv,services:{analyze:async()=>({status:200,body:{...cleanAI,review_priority:'priority_review',missing_information:['dose'],possible_contradictions:contradict?['The timing statements conflict.']:[]}})}});
  assert.equal(result.status,200);assert.equal(result.body.report.clinical,'Priority review');assert.equal(result.body.report.rewardDecision.state,contradict?'on_hold':'approved');assert.equal(result.body.report.payout.state,contradict?'not_requested':'queued');assert.equal(!!result.body.report.rewardApproval,!contradict);
  DB.sqlite.close();
 }
});

test('AI outage persists an explicit hold; sponsor budget exhaustion never fabricates payment',async()=>{
 const {DB,patient,clinic,program}=await setup();const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...reportFor(program),recipientAddress}});const id=created.body.report.id;
 const failure=await call(DB,`/api/data/reports/${id}/analyze`,{cookie:patient.cookie,method:'POST',body:{},services:{analyze:async()=>({status:503,body:{message:'Fixture outage'}})}});
 assert.equal(failure.status,503);assert.equal(failure.body.report.rewardDecision.state,'on_hold');assert.equal(failure.body.report.payment,'On hold');assert.equal(failure.body.report.rewardApproval,null);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,0);
 const approved=await call(DB,`/api/data/reports/${id}/review`,{cookie:clinic.cookie,method:'POST',body:{action:'approve',eligible:true},env:{...relayEnv,SPONSOR_MAX_JOBS:'0'}});
 assert.equal(approved.status,200);assert.equal(approved.body.report.rewardDecision.source,'clinic');assert.equal(approved.body.report.rewardDecision.state,'approved');assert.equal(approved.body.report.payout.state,'not_requested');assert.match(approved.body.report.payout.error,/budget/);assert.equal(approved.body.report.payout.claimTxHash,undefined);
 DB.sqlite.close();
});

test('the screenshot regression saves clinical flags but creates no approval, job or proof for a bare death answer',async()=>{
 const {DB,patient,program}=await setup();const payload=reportFor(program);
 payload.answers={...payload.answers,details:'I died',notes:'Fuck you',symptoms:Object.fromEntries(program.symptoms.map(s=>[s,'Severe'])),urgent:program.urgentOptions.slice(0,2),impact:'Unable to do usual activities',hydration:'Unable to keep fluids down'};
 const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...payload,recipientAddress},env:relayEnv});assert.equal(created.status,201);const id=created.body.report.id;
 const options={cookie:patient.cookie,method:'POST',body:{},env:relayEnv,services:{analyze:async()=>({status:200,body:{...cleanAI,review_priority:'priority_review'}})}};
 for(let i=0;i<2;i++){
  const result=await call(DB,`/api/data/reports/${id}/analyze`,options);
  assert.equal(result.status,200);assert.equal(result.body.report.clinical,'Priority review');assert.equal(result.body.report.payment,'On hold');
  assert.equal(result.body.report.rewardDecision.state,'on_hold');assert.match(result.body.report.rewardDecision.reasons.join(' '),/I died/);
  assert.equal(result.body.report.rewardApproval,null);assert.equal(result.body.report.payout.state,'not_requested');
 }
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,0);
 assert.equal((await call(DB,`/api/data/reports/${id}/proof`,{cookie:patient.cookie,method:'POST',body:{}})).status,409);
 DB.sqlite.close();
});

test('legacy analysis without a validity check cannot create a new sponsor payment on retry',async()=>{
 const {DB,patient,clinic,program}=await setup();
 const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:{...reportFor(program),recipientAddress}});const id=created.body.report.id;
 const legacy={...cleanAI};delete legacy.submission_validity;
 DB.sqlite.prepare("UPDATE care_reports SET ai_json=?,ai_status='complete' WHERE id=?").run(JSON.stringify(legacy),id);
 const options={cookie:patient.cookie,method:'POST',body:{},env:relayEnv,services:{analyze:()=>assert.fail('Cached analysis must be checked before reusing it')}};
 const held=await call(DB,`/api/data/reports/${id}/analyze`,options);assert.equal(held.body.report.payment,'On hold');assert.equal(held.body.report.rewardDecision.state,'on_hold');
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,0);
 // A historical policy approval is not sufficient to bypass the new check.
 const approval=(await call(DB,`/api/data/reports/${id}/review`,{cookie:clinic.cookie,method:'POST',body:{action:'approve',eligible:true}})).body.report.rewardApproval;
 DB.sqlite.prepare('UPDATE care_reports SET reward_decision_json=? WHERE id=?').run(JSON.stringify({state:'approved',source:'policy',version:1}),id);
 const retry=await call(DB,`/api/data/reports/${id}/analyze`,options);assert.equal(retry.status,200);assert.deepEqual(retry.body.report.rewardApproval,approval);
 assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM care_payment_jobs').get().n,0);
 // Explicit clinic resolution still authorizes the normal sponsored path.
 const reviewed=await call(DB,`/api/data/reports/${id}/review`,{cookie:clinic.cookie,method:'POST',body:{action:'approve',eligible:true},env:relayEnv});
 assert.equal(reviewed.body.report.payout.state,'queued');
 DB.sqlite.close();
});
