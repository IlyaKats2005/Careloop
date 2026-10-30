import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import * as programsModule from '../src/programs.js';

const goodAnalysis={summary:'No new concern reported in this fictional check-in.',review_priority:'routine',findings:[],missing_information:[],possible_contradictions:[],model:'gemini-2.5-flash',clinical_validation:false,approval:false};

async function workspace({storage=new Map(),analyze=async()=>Response.json(goodAnalysis),session={signedIn:false,user:null}}={}){
  const elements=new Map(),requests=[],approvals=[];
  const document={querySelector(selector){
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',style:{},value:'',checked:false,focus(){}});
    return elements.get(selector);
  }};
  const window={scrollTo(){},CareloopPrograms:programsModule,privacyPanel:()=>'<div>Proof workspace</div>',zkEnroll(){},zkApprove(report){approvals.push(JSON.parse(JSON.stringify(report)));}};
  const sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  const context=vm.createContext({document,window,sessionStorage,crypto:{randomUUID},URLSearchParams,location:{search:''},setTimeout:()=>0,fetch:async(url,options)=>{
    if(url==='/api/session')return Response.json(session);
    if(url==='/api/analyze'){
      const body=JSON.parse(options.body);requests.push(body);return analyze(body);
    }
    throw Error(`Unexpected request: ${url}`);
  }});
  // Retain the app's single initialization promise so assertions wait for restore.
  const source=readFileSync('public/app.js','utf8');
  assert.match(source,/render\(\);initialize\(\);\s*$/);
  vm.runInContext(source.replace(/render\(\);initialize\(\);\s*$/,'render();globalThis.__ready=initialize();'),context);
  await context.__ready;
  const run=code=>vm.runInContext(code,context);
  const data=code=>JSON.parse(run(`JSON.stringify(${code})`));
  const element=selector=>document.querySelector(selector);
  return {context,run,data,element,storage,requests,approvals,html:()=>element('#app').innerHTML};
}

function fillReport(ui){
  ui.run(`draft={...blankDraft(),status:currentProgram().medicationOptions.length?'Taking as prescribed':'About the same',missed:currentProgram().medicationOptions.length?'No':'Not applicable',symptoms:Object.fromEntries(currentProgram().symptoms.map(topic=>[topic,'None'])),impact:'Not at all',hydration:'Yes',contact:'No',confirmed:true};`);
}

function fillEditor(ui,program){
  const fields={cfgId:program.id,cfgName:program.name,cfgCondition:program.condition,cfgDescription:program.description,cfgCadence:program.cadence,cfgSymptoms:program.symptoms.join('\n'),cfgMedications:program.medicationOptions.join('\n'),cfgUrgent:program.urgentOptions.join('\n'),cfgAiLabel:program.ai.label,cfgAiFocus:program.ai.instructions};
  for(const [name,value] of Object.entries(fields))ui.element('#'+name).value=value;
  for(const [name,value] of Object.entries(program.labels))ui.element('#cfgLabel-'+name).value=value;
}

test('submission automatically analyzes a program snapshot while clinical review and payment remain pending',async()=>{
  let release;
  const ui=await workspace({analyze:()=>new Promise(resolve=>{release=resolve;})});
  ui.run("enterWorkspace('patient');nav('checkin')");fillReport(ui);
  const pending=ui.run('submitReport()');
  assert.equal(ui.requests.length,1);
  const payload=ui.requests[0],report=ui.data('reports[0]');
  assert.equal(payload.fictional,true);
  assert.equal(payload.program.id,'GLP-01');
  assert.deepEqual(payload.program,report.programConfig);
  assert.deepEqual(payload.answers,report.answers);
  assert.equal(report.clinical,'Awaiting clinic review');
  assert.equal(report.payment,'Pending');
  assert.match(ui.html(),/Analyzing/);
  assert.equal(ui.approvals.length,0);
  release(Response.json(goodAnalysis));await pending;
  assert.equal(ui.data('reports[0].ai.approval'),false);
  assert.equal(ui.data('reports[0].clinical'),'Awaiting clinic review');
  assert.equal(ui.data('reports[0].payment'),'Pending');
  assert.equal(ui.data('rewardState(reports[0]).state'),'waiting');
  assert.match(ui.html(),/Analysis ready/);
  await ui.run('submitReport()');
  assert.equal(ui.requests.length,1,'Duplicate program-period submission must not trigger another AI request');
  assert.equal(ui.data('reports.length'),1);
});

test('reports survive reload without persisting account credentials or counting synthetic examples',async()=>{
  const storage=new Map(),ui=await workspace({storage});
  ui.run("enterWorkspace('patient');nav('reports')");
  assert.equal(ui.data('reports.length'),0);
  assert.match(ui.html(),/No submitted reports yet/);
  assert.match(ui.html(),/preloaded example/);
  const exampleId=ui.data('examples()[0].id');
  ui.run(`switchRole('clinic');openReport(${JSON.stringify(exampleId)});clinicAction('approve')`);
  assert.equal(ui.approvals.length,0);
  assert.equal(ui.data('reports.length'),0);
  ui.run("switchRole('patient')");fillReport(ui);await ui.run('submitReport()');
  const saved=JSON.parse(storage.get('careloop-workspace-preprod-v2:guest'));
  assert.equal(saved.reports.length,1);
  assert.equal(saved.reports[0].answers.confirmed,true);
  assert.ok(saved.reports[0].audit[0].includes('Fictional report submitted'));
  assert.ok(!saved.reports.some(r=>r.isExample));
  assert.equal(saved.auth,undefined);
  assert.equal(saved.password,undefined);
  assert.equal(saved.user,undefined);
  const restored=await workspace({storage});
  assert.deepEqual(restored.data('reports'),ui.data('reports'));
  assert.equal(restored.requests.length,0,'Reload must not replay an AI call');
  restored.run("nav('overview')");
  assert.match(restored.html(),/YOUR REPORTS/);
  assert.equal(restored.data("activeReports().filter(r=>rewardState(r).state==='confirmed').length"),0);
});

test('non-medication programs remove dose questions and create reports with distinct IDs and configurations',async()=>{
  const ui=await workspace();ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
  const first=ui.data('reports[0]');
  ui.run("changeProgram('WELL-01');nav('checkin')");
  assert.match(ui.html(),/no medication questions/);
  assert.doesNotMatch(ui.html(),/Most recent dose|scheduled doses missed/);
  fillReport(ui);await ui.run('submitReport()');
  const second=ui.data('reports[0]');
  assert.notEqual(second.id,first.id);
  assert.equal(second.programId,'WELL-01');
  assert.equal(second.programConfig.medicationOptions.length,0);
  assert.equal(ui.requests[1].program.id,'WELL-01');
  assert.deepEqual(ui.data('reports[1]'),first);
  assert.equal(ui.data('activeReports().length'),1);
});

test('workspace restore does not mix guest reports or another account with the signed-in owner',async()=>{
  const storage=new Map();
  const guest=await workspace({storage});guest.run("enterWorkspace('patient')");fillReport(guest);await guest.run('submitReport()');
  const session={signedIn:true,user:{id:'account-a',displayName:'Demo A',email:'a@example.test',role:'patient'}};
  const own=await workspace({storage,session});
  assert.equal(own.data('reports.length'),0);
  own.run("enterWorkspace('patient','signed-in')");fillReport(own);await own.run('submitReport()');
  const ownId=own.data('reports[0].id');
  assert.notEqual(ownId,guest.data('reports[0].id'));
  const other=await workspace({storage,session:{signedIn:true,user:{...session.user,id:'account-b'}}});
  assert.equal(other.data('reports.length'),0);
  const restored=await workspace({storage,session});
  assert.equal(restored.data('reports[0].id'),ownId);
  assert.equal(restored.data('entryMode'),'signed-in');
  const saved=JSON.parse(storage.get('careloop-workspace-preprod-v2:account-a'));
  assert.equal(saved.owner,'account-a');
  assert.ok(!JSON.stringify(saved).includes('a@example.test'));
});

test('creating and editing a program changes future check-ins while submitted reports retain their snapshot',async()=>{
  const ui=await workspace();ui.run("enterWorkspace('clinic');editProgram(null)");
  const custom=programsModule.normalizeProgram({id:'CUSTOM-01',name:'Custom follow-up',symptoms:['Sleep disruption','Fatigue'],ai:{instructions:'Review the timing of reported changes.'}});
  fillEditor(ui,custom);ui.run('saveProgram()');
  assert.equal(ui.data('programId'),'CUSTOM-01');
  ui.run("switchRole('patient');nav('checkin')");fillReport(ui);await ui.run('submitReport()');
  const original=ui.data('reports[0]');
  ui.run("switchRole('clinic');editProgram('CUSTOM-01')");
  const edited=programsModule.normalizeProgram({...custom,name:'Edited follow-up',symptoms:['Physical discomfort'],ai:{...custom.ai,instructions:'Review daily impact and follow-up requests.'}});
  fillEditor(ui,edited);ui.run('saveProgram()');
  assert.equal(ui.data('currentProgram().name'),'Edited follow-up');
  assert.deepEqual(ui.data('Object.keys(draft.symptoms)'),['Physical discomfort']);
  assert.deepEqual(ui.data('reports[0]'),original);
  assert.equal(ui.data('reports[0].programConfig.ai.instructions'),custom.ai.instructions);
});

test('AI failure is visible and preserves the report for manual clinic review and retry',async()=>{
  let fail=true;
  const ui=await workspace({analyze:async()=>fail?Response.json({message:'AI quota reached; try later.'},{status:429}):Response.json(goodAnalysis)});
  ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
  assert.equal(ui.data('reports.length'),1);
  const id=ui.data('reports[0].id');
  assert.match(ui.html(),/AI quota reached; try later/);
  assert.match(ui.html(),/The report is saved/);
  assert.equal(ui.data('reports[0].clinical'),'Awaiting clinic review');
  assert.equal(ui.data('reports[0].payment'),'Pending');
  fail=false;await ui.run(`runAI(${JSON.stringify(id)})`);
  assert.equal(ui.data('reports.length'),1);
  assert.equal(ui.data('reports[0].aiError'),'');
  assert.equal(ui.requests.length,2);
  assert.match(ui.html(),/Analysis ready/);
});

test('AI cannot approve rewards; manual clinic approval checks eligibility and still does not mark payment confirmed',async()=>{
  const ui=await workspace();ui.run("enterWorkspace('patient')");fillReport(ui);await ui.run('submitReport()');
  const id=ui.data('reports[0].id');
  ui.element('#eligible').checked=true;
  ui.run(`openReport(${JSON.stringify(id)});clinicAction('approve')`);
  assert.equal(ui.approvals.length,0,'Participant role cannot approve');
  ui.run(`switchRole('clinic');openReport(${JSON.stringify(id)})`);
  ui.element('#eligible').checked=false;ui.run("clinicAction('approve')");
  assert.equal(ui.approvals.length,0);
  assert.match(ui.element('#clinicError').textContent,/Confirm eligibility/);
  ui.element('#decision').value='Reviewed the original fictional answers.';
  ui.run("clinicAction('review')");
  assert.equal(ui.data('reports[0].clinical'),'Reviewed');
  assert.equal(ui.data('reports[0].payment'),'Pending');
  ui.element('#eligible').checked=true;ui.run("clinicAction('approve')");
  assert.equal(ui.approvals.length,1);
  assert.equal(ui.approvals[0].id,id);
  assert.equal(ui.data('reports[0].payment'),'Approved');
  assert.equal(ui.data('rewardState(reports[0]).state'),'approved');
  assert.match(ui.html(),/Approved · claim not sent/);
  ui.run("clinicAction('approve')");
  assert.equal(ui.approvals.length,1);
});

test('required responses and fictional-data consent are checked before report creation or an AI call',async()=>{
  const ui=await workspace();ui.run("enterWorkspace('patient');draft.confirmed=true");
  await ui.run('submitReport()');
  assert.equal(ui.data('reports.length'),0);
  assert.match(ui.element('#formError').textContent,/required questionnaire/);
  fillReport(ui);ui.run('draft.confirmed=false');await ui.run('submitReport()');
  assert.equal(ui.data('reports.length'),0);
  assert.equal(ui.requests.length,0);
  assert.match(ui.element('#formError').textContent,/fictional/);
});
