import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dataAPI} from '../src/data-api.js';
import {createLocalDatabase} from '../scripts/local-db.mjs';
import * as programsModule from '../src/programs.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const goodAnalysis={summary:'No new concern in the fictional check-in.',review_priority:'routine',findings:[],missing_information:[],possible_contradictions:[],submission_validity:{status:'clear',issues:[]},model:'gemini-2.5-flash',clinical_validation:false,approval:false};
const pending=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// A deliberately small HTTP fixture: the browser receives copies, and only
// successful HTTP mutations change this server state. Data API authorization,
// SQL constraints and real persistence have their own SQLite-backed tests.
function service({programs=programsModule.DEFAULT_PROGRAMS,reports=[]}={}){
 const state={programs:copy(programs).map(p=>({...p,invitationCode:'JOIN-'+p.id})),reports:copy(reports),enrollments:[],profile:{id:'alex',displayName:'Alex Morgan',recipientAddress:'addr_test1fixture'}};
 const requests=[],hooks={};
 async function fetch(url,options={},session={signedIn:false,user:null}){
  const parsed=new URL(url,'https://careloop.test'),path=parsed.pathname,method=options.method||'GET';
  const body=options.body?JSON.parse(options.body):undefined;
  const call={path,mode:parsed.searchParams.get('mode'),method,body,credentials:options.credentials};requests.push(call);
  if(hooks.request){const response=await hooks.request(call,state);if(response)return response;}
  if(path==='/api/session')return Response.json(session);
  if(path==='/api/sponsor/status')return Response.json({configured:true,online:true,network:'Preprod',remainingBudget:4});
  if(path==='/api/demo/start')return Response.json({started:true});
  if(path==='/api/auth/logout')return Response.json({signedIn:false,user:null});
  if(path==='/api/workspace')return Response.json({workspace:{id:'workspace-fixture',mode:call.mode,role:call.mode==='account'?session.user?.role:'demo'},...copy(state)});
  if(path==='/api/data/enroll'){
   const joined=copy(programsModule.getProgram('WELL-01'));if(body.code!=='JOIN-WELL-01')return Response.json({message:'Invitation code is unavailable.'},{status:404});
   if(!state.programs.some(p=>p.id===joined.id))state.programs.push(joined);
   const enrollment={id:'enrollment-fixture',programId:joined.id,participant:'P-SERVER',commitment:body.commitment};state.enrollments.push(enrollment);return Response.json({enrollment,program:joined});
  }
  if(path==='/api/data/programs'&&method==='POST'){
   const program=programsModule.normalizeProgram({...body.program,id:body.program.id+'-SERVER'});state.programs.push({...program,invitationCode:'INVITE-SERVER'});return Response.json({program},{status:201});
  }
  const programMatch=path.match(/^\/api\/data\/programs\/([^/]+)$/);
  if(programMatch&&method==='PATCH'){
   const at=state.programs.findIndex(p=>p.id===programMatch[1]);assert.ok(at>=0);const program=programsModule.normalizeProgram(body.program);state.programs[at]={...program,invitationCode:state.programs[at].invitationCode};return Response.json({program});
  }
  if(path==='/api/data/reports'&&method==='POST'){
   if(state.reports.some(r=>r.programId===body.programId&&r.periodId===body.periodId))return Response.json({message:'A report is already saved for this period.'},{status:409});
   const program=state.programs.find(p=>p.id===body.programId);assert.ok(program);
   const report={id:'R-'+randomUUID(),programId:program.id,programConfig:programsModule.normalizeProgram(program),participant:'P-SERVER',periodId:body.periodId,period:'Current period',date:'Server date',quality:'Complete',clinical:'Awaiting review',payment:'Pending',answers:copy(body.answers),audit:['Server saved a fictional report.'],decision:'',ai:null,aiError:'',rewardApproval:null,chain:{}};
   state.reports.unshift(report);return Response.json({report},{status:201});
  }
  const match=path.match(/^\/api\/data\/reports\/([^/]+)\/(analyze|review|chain|status|proof)$/);
  if(match){
   const report=state.reports.find(r=>r.id===match[1]);assert.ok(report);
   if(match[2]==='proof'){report.payout.state='claim_queued';}
   if(match[2]==='analyze'){report.ai=copy(goodAnalysis);report.aiError='';}
   if(match[2]==='review'){
    if(body.action==='approve'){report.payment='Approved';report.rewardApproval={reportId:report.id,commitment:'1234'};}
    else{report.clinical=body.action==='review'?'Reviewed':'Clarification requested';report.decision=body.note;}
   }
   if(match[2]==='chain')report.chain[body.kind]={txHash:body.txHash,verified:false};
   return Response.json({report});
  }
  throw Error('Unexpected request: '+method+' '+url);
 }
 return {state,requests,hooks,fetch};
}

async function workspace({backend=service(),session={signedIn:false,user:null},storage=new Map(),browserReload=false}={}){
 const elements=new Map(),storageWrites=[],blockchainCalls=[],cloudRewards=[],ownerChanges=[],proofCalls=[];
 const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',style:{},value:'',checked:false,focus(){}});return elements.get(selector)}};
 const window={careloopValidateRecipient:async address=>address,careloopBuildSponsoredProof:async(report,address)=>{proofCalls.push({id:report.id,address});return {proof:{pi_a:['test']},publicSignals:['public']};},scrollTo(){},CareloopPrograms:programsModule,privacyPanel:()=>'<div>Real wallet workspace</div>',careloopRecoveryPanel:()=>'<details><summary>Private enrollment recovery</summary><button>Download private recovery file</button><label>Restore recovery file<input type="file"></label></details>',zkEnroll(){window.careloopCommitment='1234';},careloopSetRewardOwner(owner){ownerChanges.push(owner)},careloopRewardBusy:()=>false,careloopUseCloudReport:async(report,options)=>cloudRewards.push({report:copy(report),options:copy(options)}),careloopChainSnapshot:()=>({network:'Preprod',poolConfirmed:false}),careloopBlockchain:{render(context){blockchainCalls.push(copy(context));return '<div>Blockchain lab fixture</div>';}}};
 const sessionStorage={get length(){return storage.size},key:index=>[...storage.keys()][index]??null,getItem:key=>storage.get(key)??null,setItem(key,value){storageWrites.push({key,value});storage.set(key,String(value));},removeItem:key=>storage.delete(key)};
 const context=vm.createContext({document,window,sessionStorage,crypto:{randomUUID},performance:{getEntriesByType:()=>[{type:browserReload?'reload':'navigate'}]},URLSearchParams,location:{search:''},setTimeout:()=>0,clearTimeout:()=>{},fetch:(url,options)=>backend.fetch(url,options,session)});
 const source=readFileSync('public/app.js','utf8');assert.match(source,/render\(\);initialize\(\);\s*$/);
 vm.runInContext(source.replace(/render\(\);initialize\(\);\s*$/,'render();globalThis.__ready=initialize();'),context);await context.__ready;
 const run=code=>vm.runInContext(code,context),data=code=>JSON.parse(run('JSON.stringify('+code+')')),element=selector=>document.querySelector(selector);
 return {run,data,element,storage,storageWrites,backend,blockchainCalls,cloudRewards,ownerChanges,proofCalls,html:()=>element('#app').innerHTML};
}
function fillReport(ui){ui.run("draft={...blankDraft(),status:currentProgram().medicationOptions.length?'Taking as prescribed':'About the same',missed:'No',symptoms:Object.fromEntries(currentProgram().symptoms.map(topic=>[topic,'None'])),impact:'Not at all',hydration:'Yes',contact:'No',confirmed:true,recipientAddress:'addr_test1fixture'};");}
function fillEditor(ui,program){const fields={cfgId:program.id,cfgName:program.name,cfgCondition:program.condition,cfgDescription:program.description,cfgCadence:program.cadence,cfgSymptoms:program.symptoms.join('\n'),cfgMedications:program.medicationOptions.join('\n'),cfgUrgent:program.urgentOptions.join('\n'),cfgAiLabel:program.ai.label,cfgAiFocus:program.ai.instructions};for(const [name,value] of Object.entries(fields))ui.element('#'+name).value=value;for(const [name,value] of Object.entries(program.labels))ui.element('#cfgLabel-'+name).value=value;}

// These assertions focus on user-visible transitions and persistence boundaries,
// rather than mirroring the implementation's rendering internals.
test('submission waits for the server record, then automatically requests AI without approving payment',async()=>{
 const backend=service(),saveGate=pending(),analysisGate=pending();backend.hooks.request=async call=>{if(call.path==='/api/data/reports')await saveGate.promise;if(call.path.endsWith('/analyze'))await analysisGate.promise;};
 const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);
 const submission=ui.run('submitReport()');await tick();
 assert.equal(ui.data('reports.length'),0);assert.equal(ui.data('page'),'overview');assert.match(ui.element('#formError').textContent,/Saving/);
 const request=backend.requests.find(r=>r.path==='/api/data/reports');assert.equal(request.mode,'demo');assert.equal(request.credentials,'same-origin');assert.equal(request.body.fictional,true);assert.equal(request.body.commitment,'1234');assert.equal(request.body.recipientAddress,undefined);assert.equal(request.body.secret,undefined);assert.equal(request.body.program,undefined);assert.equal(request.body.clinical,undefined);
 saveGate.resolve();await tick();
 assert.equal(ui.data('reports.length'),1);assert.equal(ui.data('reports[0].id'),backend.state.reports[0].id);assert.equal(ui.data('reports[0].participant'),'P-SERVER');assert.match(ui.html(),/Analyzing/);
 assert.equal(ui.data('reports[0].payment'),'Pending');assert.equal(ui.data('reports[0].clinical'),'Awaiting review');
 analysisGate.resolve();await submission;
 assert.match(ui.html(),/Analysis ready/);assert.equal(ui.data('reports[0].ai.approval'),false);assert.equal(ui.data('reports[0].payment'),'Pending');
 const analysisRequest=backend.requests.find(r=>r.path.endsWith('/analyze'));assert.deepEqual(analysisRequest.body,{});assert.equal(ui.data('rewardState(reports[0]).state'),'waiting');
 await ui.run('submitReport()');assert.equal(backend.requests.filter(r=>r.path==='/api/data/reports').length,1);
 assert.equal(ui.storageWrites.length,0,'Questionnaire data must never be written to browser storage');
});

test('a failed server save preserves the form and never shows a saved report or starts AI',async()=>{
 const backend=service();backend.hooks.request=call=>call.path==='/api/data/reports'?Response.json({message:'Database temporarily unavailable.'},{status:503}):undefined;
 const ui=await workspace({backend});await ui.run("enterWorkspace('patient');");ui.run("nav('checkin')");fillReport(ui);const before=ui.data('draft');await ui.run('submitReport()');
 assert.equal(ui.data('reports.length'),0);assert.equal(ui.data('page'),'checkin');assert.deepEqual(ui.data('draft'),before);assert.match(ui.element('#formError').textContent,/Database temporarily unavailable/);assert.equal(backend.requests.filter(r=>r.path.endsWith('/analyze')).length,0);assert.equal(ui.storageWrites.length,0);
});

test('a fresh browser loads saved reports from the server without a local questionnaire cache',async()=>{
 const backend=service(),first=await workspace({backend});await first.run("enterWorkspace('patient')");fillReport(first);await first.run('submitReport()');const saved=first.data('reports[0]');
 const fresh=await workspace({backend,storage:new Map()});assert.equal(fresh.data('reports.length'),0);await fresh.run("enterWorkspace('patient')");
 assert.deepEqual(fresh.data('reports[0]'),saved);assert.equal(fresh.storageWrites.length,0);assert.equal(backend.requests.filter(r=>r.path.endsWith('/analyze')).length,1,'Reading cloud data must not replay the AI request');
 backend.state.reports[0].clinical='Reviewed';backend.state.reports[0].decision='Clinic review on another device.';await fresh.run('refreshWorkspace()');assert.equal(fresh.data('reports[0].clinical'),'Reviewed');assert.equal(fresh.data('reports[0].decision'),'Clinic review on another device.');
});

test('account workspace uses the server role and empty participants join through a clinic code',async()=>{
 const backend=service({programs:[]}),session={signedIn:true,user:{id:'participant-account',displayName:'Fictional Participant',role:'patient'}};
 const ui=await workspace({backend,session});assert.equal(ui.data('role'),'patient');assert.match(ui.html(),/Join your first program/);assert.equal(ui.data('currentProgram()'),null);
 await ui.run("enterWorkspace('clinic','signed-in')");assert.equal(ui.data('role'),'patient');ui.run("switchRole('clinic')");assert.equal(ui.data('role'),'patient');
 await ui.run("enterWorkspace('patient','signed-in')");ui.element('#joinCode').value='JOIN-WELL-01';await ui.run('joinProgram()');
 assert.equal(ui.data('programId'),'WELL-01');const join=backend.requests.find(r=>r.path==='/api/data/enroll');assert.equal(join.mode,'account');assert.deepEqual(join.body,{code:'JOIN-WELL-01',commitment:'1234'});assert.equal(ui.data('programs[0].medicationOptions.length'),0);
 ui.run("nav('checkin')");assert.match(ui.html(),/no medication questions/);assert.doesNotMatch(ui.html(),/Most recent dose you actually took/);
});

test('program creation and editing await server persistence, preserve report snapshots and use server IDs',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('clinic')");ui.run('editProgram(null)');
 const custom=programsModule.normalizeProgram({id:'CUSTOM-01',name:'Custom follow-up',symptoms:['Sleep disruption','Fatigue']});fillEditor(ui,custom);await ui.run('saveProgram()');
 assert.equal(ui.data('programId'),'CUSTOM-01-SERVER');assert.equal(backend.requests.find(r=>r.path==='/api/data/programs').method,'POST');
 await ui.run("switchRole('patient')");fillReport(ui);await ui.run('submitReport()');const original=ui.data('reports[0]');
 await ui.run("switchRole('clinic')");ui.run("editProgram('CUSTOM-01-SERVER')");const changed=programsModule.normalizeProgram({...custom,id:'CUSTOM-01-SERVER',name:'Updated follow-up',symptoms:['Physical discomfort']});fillEditor(ui,changed);await ui.run('saveProgram()');
 assert.equal(ui.data('currentProgram().name'),'Updated follow-up');assert.deepEqual(ui.data('reports[0].programConfig'),original.programConfig);assert.equal(backend.requests.find(r=>r.path==='/api/data/programs/CUSTOM-01-SERVER').method,'PATCH');assert.equal(ui.storageWrites.length,0);
});

test('AI errors retain the server report and support a retry while review and rewards remain independent',async()=>{
 const backend=service();let fail=true;backend.hooks.request=(call,state)=>{if(call.path.endsWith('/analyze')&&fail){const report=state.reports[0];report.aiError='AI quota reached.';return Response.json({message:report.aiError,report:copy(report)},{status:429});}};
 const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
 assert.equal(ui.data('reports.length'),1);assert.match(ui.html(),/AI quota reached/);assert.equal(ui.data('reports[0].payment'),'Pending');assert.equal(ui.data('reports[0].clinical'),'Awaiting review');
 const id=ui.data('reports[0].id');fail=false;await ui.run(`runAI(${JSON.stringify(id)})`);assert.match(ui.html(),/Analysis ready/);assert.equal(ui.data('reports[0].aiError'),'');
 ui.run(`openReport(${JSON.stringify(id)})`);ui.element('#eligible').checked=true;await ui.run("clinicAction('approve')");assert.equal(backend.requests.filter(r=>r.path.endsWith('/review')).length,0,'Participant UI must not send clinic mutations');
 await ui.run("switchRole('clinic')");ui.run(`openReport(${JSON.stringify(id)})`);ui.element('#eligible').checked=false;await ui.run("clinicAction('approve')");assert.equal(backend.requests.filter(r=>r.path.endsWith('/review')).length,0);
 ui.element('#decision').value='Fictional report reviewed.';await ui.run("clinicAction('review')");assert.equal(ui.data('reports[0].clinical'),'Reviewed');assert.equal(ui.data('reports[0].payment'),'Pending');
 ui.element('#eligible').checked=true;await ui.run("clinicAction('approve')");assert.equal(ui.data('reports[0].payment'),'Approved');assert.equal(ui.data('rewardState(reports[0]).state'),'approved');
 await ui.run(`openRewards(${JSON.stringify(id)})`);assert.equal(ui.data('page'),'rewards');assert.equal(ui.cloudRewards.length,0);assert.doesNotMatch(ui.html(),/Real wallet workspace|manual wallet tools|Private enrollment recovery/);
});

test('examples stay read-only, blockchain navigation receives safe state, and wallet metadata is never treated as paid',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('clinic')");ui.run("nav('reports')");assert.match(ui.html(),/preloaded example/);const example=ui.data('examples()[0].id');ui.run(`openReport(${JSON.stringify(example)})`);await ui.run("clinicAction('approve')");assert.equal(backend.state.reports.length,0);
 ui.run("nav('blockchain')");assert.match(ui.html(),/Blockchain lab fixture/);assert.equal(ui.blockchainCalls.at(-1).live.network,'Preprod');assert.equal(ui.blockchainCalls.at(-1).live.secret,undefined);
 await ui.run("switchRole('patient')");fillReport(ui);await ui.run('submitReport()');const id=ui.data('reports[0].id');
 await ui.run(`window.careloopSaveChain(${JSON.stringify(id)},{kind:'claim',txHash:'${'a'.repeat(64)}'})`);assert.equal(ui.data('reports[0].chain.claim.verified'),false);assert.equal(ui.data('reports[0].payment'),'Pending');assert.notEqual(ui.data('rewardState(reports[0]).state'),'confirmed');
 assert.equal(ui.storageWrites.length,0);
});

test('missing responses or fictional-data consent cannot create a server record',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");ui.run('draft.confirmed=true');await ui.run('submitReport()');assert.match(ui.element('#formError').textContent,/required questionnaire/);
 fillReport(ui);ui.run('draft.confirmed=false');await ui.run('submitReport()');assert.match(ui.element('#formError').textContent,/fictional/);assert.equal(backend.requests.filter(r=>r.path==='/api/data/reports').length,0);
});

function livePolicy(backend,state='awaiting_proof'){
 backend.hooks.request=(call,data)=>{
  if(!call.path.endsWith('/analyze'))return;
  const report=data.reports[0];report.ai=copy(goodAnalysis);report.rewardDecision={state:state==='on_hold'?'on_hold':'approved',reasons:state==='on_hold'?['A reported contradiction needs clarification.']:[],clinicalReview:'routine'};
  report.payment=state==='on_hold'?'On hold':'Approved';report.recipientAddress='addr_test1fixture';
  report.rewardApproval=state==='on_hold'?null:{reportId:report.id,commitment:'1234'};
  report.payout={state:state==='on_hold'?'not_requested':state,recipientAddress:report.recipientAddress,fundTxHash:state==='awaiting_proof'?'b'.repeat(64):null,claimTxHash:null,receipt:null};
  return Response.json({report});
 };
}

test('approved live submission automatically sends a public proof, then shows paid only for the matching verified receipt',async()=>{
 const backend=service();livePolicy(backend);const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');await tick();await tick();
 assert.equal(backend.requests.find(r=>r.path==='/api/data/reports').body.recipientAddress,undefined);
 assert.equal(ui.proofCalls.length,1);const proof=backend.requests.find(r=>r.path.endsWith('/proof'));assert.deepEqual(proof.body,{proof:{pi_a:['test']},publicSignals:['public']});assert.equal(proof.body.secret,undefined);
 assert.match(ui.html(),/Claim queued/);assert.doesNotMatch(ui.html(),/Paid · 2 test ADA/);
 const report=backend.state.reports[0];report.payout.state='submitted';report.payout.claimTxHash='a'.repeat(64);await ui.run('pollPayout(payoutWatch)');assert.match(ui.html(),/claim has been broadcast/);assert.equal(ui.data('rewardState(reports[0]).state'),'submitted');
 report.payout.state='confirmed';report.payout.receipt={verified:false,recipientAddress:'addr_test1fixture',txHash:'a'.repeat(64),amount:'2000000',network:'Preprod'};await ui.run('pollPayout(payoutWatch)');assert.notEqual(ui.data('rewardState(reports[0]).state'),'confirmed');
 report.payout.receipt={verified:true,recipientAddress:'addr_test1other',txHash:'a'.repeat(64),amount:'2000000',network:'Preprod'};await ui.run('pollPayout(payoutWatch)');assert.notEqual(ui.data('rewardState(reports[0]).state'),'confirmed');
 report.payout.receipt.recipientAddress='addr_test1fixture';await ui.run('pollPayout(payoutWatch)');assert.equal(ui.data('rewardState(reports[0]).state'),'confirmed');assert.match(ui.html(),/Paid · 2 test ADA/);assert.match(ui.html(),new RegExp('/transaction/'+'a'.repeat(64)));
 assert.equal(ui.proofCalls.length,1,'A queued or confirmed claim must not regenerate a proof');assert.equal(ui.storageWrites.length,0);
});

test('a held report shows its real reason and cannot initiate a sponsored claim',async()=>{
 const backend=service();livePolicy(backend,'on_hold');const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');await tick();
 assert.match(ui.html(),/On hold/);assert.match(ui.html(),/reported contradiction/);assert.equal(ui.proofCalls.length,0);assert.equal(backend.requests.filter(r=>r.path.endsWith('/proof')).length,0);assert.equal(ui.data('rewardState(reports[0]).state'),'on_hold');
});

test('a delayed payment-status response cannot enter another account or trigger its proof',async()=>{
 const backend=service();livePolicy(backend,'queued');const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');await tick();
 const gate=pending();backend.hooks.request=async call=>{if(call.path.endsWith('/status')&&call.path!=='/api/sponsor/status')await gate.promise;};
 const polling=ui.run('pollPayout(payoutWatch)');await tick();await ui.run('signOut()');backend.state.reports[0].payout.state='awaiting_proof';gate.resolve();await polling;
 assert.equal(ui.data('reports.length'),0);assert.equal(ui.proofCalls.length,0);assert.equal(ui.data('entered'),false);
});

test('the live blockchain route keeps report polling active and its snapshot contains no answers or enrollment secret',async()=>{
 const backend=service();livePolicy(backend,'queued');const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');await tick();
 const id=ui.data('reports[0].id');ui.run(`showLiveBlockchain(${JSON.stringify(id)})`);await tick();
 assert.equal(ui.data('page'),'blockchain');assert.equal(ui.data('payoutWatch.id'),id);const snapshot=ui.data('window.careloopLiveReport()');assert.equal(snapshot.id,id);assert.equal(snapshot.rewardDecision.state,'approved');assert.equal(snapshot.answers,undefined);assert.equal(snapshot.secret,undefined);assert.equal(snapshot.rewardApproval,undefined);
 ui.run("nav('program')");assert.equal(ui.data('payoutWatch'),null);
});

test('missing recipient stops submission before spending sponsor funds',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);ui.run("profile.recipientAddress=''");await ui.run('submitReport()');
 assert.match(ui.element('#formError').textContent,/receiving address/);assert.equal(backend.requests.filter(r=>r.path==='/api/data/reports').length,0);
});

test('demo readiness distinguishes an unreachable service and previous receipts from a fresh payment',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");ui.run("nav('demoReady')");await tick();
 assert.match(ui.html(),/Sponsor payment worker: Online/);assert.match(ui.html(),/does not create another Masumi purchase/);assert.match(ui.html(),/Previous website payout/);
 backend.hooks.request=call=>{if(call.path==='/api/sponsor/status')throw Error('network unavailable');};
 await ui.run('loadSponsorStatus()');assert.match(ui.html(),/Connection not verified/);assert.doesNotMatch(ui.html(),/Sponsor payment worker: Online/);
 assert.equal(backend.requests.filter(r=>r.method==='POST'&&r.path!=='/api/demo/start').length,0);
});

test('check-in exposes enrollment creation and recovery without submitting or spending',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");ui.run("nav('checkin')");
 assert.match(ui.html(),/Your private enrollment is ready/);assert.match(ui.html(),/Download private recovery file/);
 ui.run('prepareEnrollment()');assert.match(ui.html(),/Download private recovery file/);
 assert.equal(backend.requests.filter(r=>r.path==='/api/data/reports').length,0);
});

test('an already-online sponsor status is refreshed when the report is pending',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');await tick();
 const r=backend.state.reports[0];r.payout={state:'queued',recipientAddress:'addr_test1fixture'};
 backend.hooks.request=call=>call.path==='/api/sponsor/status'?Response.json({configured:true,online:false,lastSeen:'2026-10-30T19:24:00Z',remainingBudget:3}):undefined;
 await ui.run('pollPayout(payoutWatch)');
 assert.equal(ui.data('sponsorStatus.online'),false);assert.match(ui.html(),/sponsor service is offline/);assert.equal(ui.proofCalls.length,0);
});


test('normal rewards expose recovery and proof explanation without the manual funding workflow',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");ui.run("nav('rewards')");
 assert.match(ui.html(),/Private enrollment recovery/);assert.match(ui.html(),/Restore recovery file/);assert.match(ui.html(),/When is the ZK proof used/);
 assert.match(ui.html(),/same transaction/);assert.doesNotMatch(ui.html(),/Real wallet workspace|Prepare 20 ADA|manual wallet tools/);
 await ui.run("switchRole('clinic')");ui.run("nav('rewards')");assert.doesNotMatch(ui.html(),/Real wallet workspace|Restore recovery file/);
});

test('symptom priority is explained separately from answer validity and reward authorization',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
 ui.run(`reports[0].clinical='Priority review';reports[0].ai.review_priority='priority_review';reports[0].ai.submission_validity={status:'needs_clarification',issues:[{source_question:'details',quote:'I died',reason:'Clarify the meaning.'}]};openReport(reports[0].id)`);
 assert.match(ui.html(),/Symptoms flagged · clinical review suggested/);assert.match(ui.html(),/does not validate the answers or approve payment/);assert.match(ui.html(),/Answer validity/);assert.match(ui.html(),/Clarification needed/);
 ui.run("nav('reports')");assert.match(ui.html(),/pill warn[^>]*>Symptoms flagged · review suggested/);
});

test('check-ins show the profile wallet without requesting or submitting another destination',async()=>{
 const backend=service(),ui=await workspace({backend});await ui.run("enterWorkspace('patient');");ui.run("step=0;nav('checkin')");
 assert.match(ui.html(),/Alex Morgan · Wallet saved at registration/);assert.match(ui.html(),/addr_test1fixture/);
 assert.doesNotMatch(ui.html(),/id="rewardRecipient"|id="profileWallet"|connectReceivingWallet/);
 fillReport(ui);ui.run("draft.recipientAddress='untrusted-form-destination'");await ui.run('submitReport()');
 const request=backend.requests.find(r=>r.path==='/api/data/reports');assert.ok(request);assert.equal(request.body.recipientAddress,undefined);
});

test('four-client UI supports enrolling Sam and restarting against the real workspace API',async t=>{
 const DB=createLocalDatabase({filename:':memory:'});t.after(()=>DB.close());let cookie='';const requests=[];
 const backend={requests,async fetch(url,options={}){
  const path=new URL(url,'https://careloop.test').pathname;requests.push({path,method:options.method||'GET'});
  if(path==='/api/session')return Response.json({signedIn:false,user:null});
  if(path==='/api/sponsor/status')return Response.json({configured:false,online:false,remainingBudget:0});
  const response=await dataAPI(new Request('https://careloop.test'+url,{method:options.method||'GET',headers:{Cookie:cookie,Origin:'https://careloop.test','Content-Type':'application/json','cf-connecting-ip':'ui-demo-cohort'},...(options.body?{body:options.body}:{})}),{DB},{analyze:async()=>({status:200,body:goodAnalysis})});
  assert.ok(response,'Known API route');const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return response;
 }};
 const ui=await workspace({backend});await ui.run("enterWorkspace('clinic')");assert.match(ui.html(),/Demo participants/);assert.match(ui.html(),/Sam Rivera/);
 ui.run("nav('demoClients')");assert.match(ui.html(),/3 enrolled · 1 awaiting enrollment/);assert.match(ui.html(),/Restart demo/);
 await ui.run("selectDemoClient('sam')");assert.match(ui.html(),/Join your first program/);assert.match(ui.html(),/Sam Rivera · Wallet saved at registration/);
 assert.match(ui.ownerChanges.at(-1),/:sam$/);assert.equal(ui.data('reports.length'),0);
 const id=ui.data('availablePrograms[0].id');ui.run(`useDemoInvitation(${JSON.stringify(id)})`);await ui.run('joinProgram()');assert.equal(ui.data('programs.length'),1);assert.match(ui.html(),/You’re enrolled/);
 fillReport(ui);await ui.run('submitReport()');assert.equal(ui.data('reports.length'),1);
 assert.equal(ui.data('reports[0].recipientAddress'),ui.data('profile.recipientAddress'));
 await ui.run("selectDemoClient('maya')");assert.equal(ui.data('reports.length'),0);assert.match(ui.ownerChanges.at(-1),/:maya$/);
 await ui.run("selectDemoClient('sam')");assert.equal(ui.data('reports.length'),1);
 const oldWorkspace=ui.data('cloudWorkspace.id');await ui.run('restartDemo()');assert.notEqual(ui.data('cloudWorkspace.id'),oldWorkspace);assert.equal(ui.data('demoClientId'),'alex');assert.equal(ui.data('reports.length'),0);
 assert.equal(ui.data('demoClients.filter(c=>c.enrolledProgramIds.length).length'),3);
 assert.equal(await DB.prepare('SELECT count(*) AS n FROM care_reports').first('n'),1);
 assert.equal(requests.filter(r=>r.path==='/api/demo/restart').length,1);
 const fresh=await workspace({backend,storage:ui.storage});await fresh.run("enterWorkspace('patient')");assert.equal(fresh.data('cloudWorkspace.id'),ui.data('cloudWorkspace.id'));assert.equal(fresh.data('demoClientId'),'alex');
 await fresh.run("switchRole('sponsor')");assert.match(fresh.html(),/Your AI and client budgets/);assert.match(fresh.html(),/data-budget="ai"/);assert.match(fresh.html(),/data-budget="rewards"/);assert.match(fresh.html(),/fundingAmount-ai/);assert.match(fresh.html(),/fundingAmount-rewards/);assert.equal(fresh.data('funding.available'),750);
 fresh.run("fundingAmounts.rewards=25");await fresh.run("allocateCredits('reserve','rewards')");assert.equal(fresh.data('funding.available'),725);assert.equal(fresh.data('funding.clinic.rewards'),225);assert.equal(fresh.data('funding.clinic.ai'),50);
 await fresh.run("switchRole('clinic')");assert.match(fresh.html(),/Ready to fund care/);assert.equal(fresh.data('funding.clinic.rewards'),225);
 const sponsorTab=await workspace({backend});await sponsorTab.run("enterWorkspace('sponsor')");sponsorTab.run("fundingAmounts.ai=20");await sponsorTab.run("allocateCredits('reserve','ai')");
 await fresh.run('loadFunding()');assert.equal(fresh.data('funding.clinic.ai'),70);assert.equal(fresh.data('funding.available'),705);assert.equal(fresh.data('funding.clinic.rewards'),225);
 const beforeRefresh=fresh.data('cloudWorkspace.id');await fresh.run('refreshDemoOrWorkspace()');assert.notEqual(fresh.data('cloudWorkspace.id'),beforeRefresh);assert.equal(fresh.data('funding.available'),750);assert.equal(fresh.data('funding.clinic.rewards'),200);
 const reloaded=await workspace({backend,storage:fresh.storage,browserReload:true});await reloaded.run("enterWorkspace('clinic')");assert.notEqual(reloaded.data('cloudWorkspace.id'),fresh.data('cloudWorkspace.id'));assert.equal(reloaded.data('funding.available'),750);assert.equal(reloaded.data('reports.length'),0);
 assert.equal(requests.filter(r=>r.path==='/api/demo/restart').length,3);
});

test('an automatically approved report hides clinic approval controls and explains the sponsor limit',async()=>{
 const backend=service();livePolicy(backend,'not_requested');const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
 const report=backend.state.reports[0];report.rewardDecision.source='policy';report.payout.error='The sponsor’s demonstration budget is fully allocated. The report remains approved; no payment has been sent.';report.payout.blockedReason='sponsor_limit';
 await ui.run("switchRole('clinic')");ui.run(`openReport(${JSON.stringify(report.id)})`);
 assert.match(ui.html(),/Automatic checks approved this report. No clinic approval is needed/);assert.match(ui.html(),/Approved · payment blocked by sponsor limit/);
 assert.match(ui.html(),/no funding transaction or claim has started/);assert.doesNotMatch(ui.html(),/id="eligible"|Approve demo reward|Approve after clarification|A saved receiving address is required/);
 const count=backend.requests.filter(r=>r.path.endsWith('/review')).length;ui.element('#eligible').checked=true;await ui.run("clinicAction('approve')");assert.equal(backend.requests.filter(r=>r.path.endsWith('/review')).length,count);
 ui.element('#decision').value='Routine clinic review recorded.';await ui.run("clinicAction('review')");assert.equal(ui.data('reports[0].clinical'),'Reviewed');
 ui.run("nav('rewards')");assert.match(ui.html(),/Approved · payment blocked by sponsor limit/);
});

test('clinic approval controls remain available to resolve an actual answer hold',async()=>{
 const backend=service();livePolicy(backend,'on_hold');const ui=await workspace({backend});await ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
 const id=backend.state.reports[0].id;await ui.run("switchRole('clinic')");ui.run(`openReport(${JSON.stringify(id)})`);
 assert.match(ui.html(),/Automatic approval is on hold/);assert.match(ui.html(),/Approve after clarification/);assert.match(ui.html(),/id="eligible"/);
});
