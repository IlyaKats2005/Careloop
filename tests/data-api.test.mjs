import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {dataAPI,currentPeriod,normalizeAnswers} from '../src/data-api.js';
import {commitment,leaf,hash,field} from '../src/zk-core.js';
let ip=0;
function database(){const sqlite=new DatabaseSync(':memory:');for(const name of ['0000_email_auth','0001_workspace_data'])sqlite.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));return{sqlite,prepare(sql){const statement=sqlite.prepare(sql);return{bind(...args){return{async first(){return statement.get(...args)||null;},async all(){return{results:statement.all(...args)};},async run(){const result=statement.run(...args);return{meta:{changes:Number(result.changes)}};}};}};}};}
const sha=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
async function user(DB,role){const id=crypto.randomUUID(),token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');DB.sqlite.prepare('INSERT INTO auth_users VALUES (?,?,?,?,?,?,?,?)').run(id,id+'@example.test',role,role,'hash','salt',100000,1);DB.sqlite.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(await sha(token),id,1,Math.floor(Date.now()/1000)+3600);return{cookie:'__Host-careloop_session='+token,id};}
async function call(DB,path,{cookie='',method='GET',body,services={}}={}){const request=new Request('https://careloop.test'+path,{method,headers:{cookie,'Content-Type':'application/json',Origin:'https://careloop.test','cf-connecting-ip':'data-test-'+(++ip)},...(body===undefined?{}:{body:JSON.stringify(body)})});const response=await dataAPI(request,{DB},services);return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const answerFor=p=>({dose:'',lastDose:'',missed:'',changes:'',details:'',status:'Feeling okay',medication:p.medicationOptions[0]||'',symptoms:Object.fromEntries(p.symptoms.map(s=>[s,'None'])),urgent:[],impact:'Not at all',hydration:'Yes',contact:'No',notes:'Fictional report.'});
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

test('AI uses immutable saved answers/configuration and cannot approve rewards',async()=>{
 const {DB,clinic,patient,program}=await setup();const created=await call(DB,'/api/data/reports',{cookie:patient.cookie,method:'POST',body:reportFor(program)});const id=created.body.report.id;
 const updated={...program,name:'Changed program',symptoms:['New topic']};assert.equal((await call(DB,'/api/data/programs/'+program.id,{cookie:clinic.cookie,method:'PATCH',body:{program:updated}})).status,200);
 let calls=0;const services={analyze:async(answers,env,fetcher,saved)=>{calls++;assert.deepEqual(answers,answerFor(program));assert.equal(saved.name,program.name);return{status:200,body:{summary:'Fixture analysis',review_priority:'routine',findings:[],missing_information:[],possible_contradictions:[],approval:true,clinical_validation:true}};}};
 const result=await call(DB,'/api/data/reports/'+id+'/analyze',{cookie:patient.cookie,method:'POST',body:{answers:{status:'injected'},program:updated},services});assert.equal(result.status,200);assert.equal(result.body.report.ai.approval,false);assert.equal(result.body.report.clinical,'Awaiting review');assert.equal(result.body.report.payment,'Pending');
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
