import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PROGRAMS,DEFAULT_PROGRAM_ID,DEMO_AI_MODEL,normalizeProgram,normalizePrograms,getProgram,programAIContext} from '../src/programs.js';

test('registry offers medication and non-medication programs with explicitly untrained AI',()=>{
  assert.equal(DEFAULT_PROGRAMS.length,3);
  assert.equal(getProgram().id,DEFAULT_PROGRAM_ID);
  assert.ok(getProgram('GLP-01').medicationOptions.length);
  assert.equal(getProgram('WELL-01').medicationOptions.length,0);
  assert.ok(getProgram('MED-01').medicationOptions.length);
  for(const program of DEFAULT_PROGRAMS){
    assert.equal(program.ai.model,DEMO_AI_MODEL);
    assert.equal(program.ai.status,'demo-untrained');
    assert.deepEqual(program.reward,{amount:2,unit:'test ADA'});
  }
});

test('new programs get generic defaults without inheriting an Ozempic questionnaire',()=>{
  const program=normalizeProgram({id:' custom-01 ',name:' My program '});
  assert.equal(program.id,'CUSTOM-01');
  assert.equal(program.name,'My program');
  assert.equal(program.cadence,'Weekly');
  assert.deepEqual(program.medicationOptions,[]);
  assert.ok(program.symptoms.length);
  assert.equal(program.labels.status,'How have you been overall?');
  assert.equal(program.active,true);
  assert.ok(!JSON.stringify(program).includes('Ozempic'));
});

test('editable configurations do not mutate builtin programs',()=>{
  const program=getProgram('GLP-01');
  program.symptoms.push('Another topic');
  program.ai.instructions='A different review focus';
  assert.equal(DEFAULT_PROGRAMS[0].symptoms.length,8);
  assert.notEqual(getProgram('GLP-01').ai.instructions,program.ai.instructions);
});

test('program IDs cannot collide after normalization or inject script syntax',()=>{
  const config={id:'EXAMPLE',name:'Example'};
  assert.throws(()=>normalizePrograms([config,{...config,id:'example'}]),/unique program ID/);
  assert.throws(()=>normalizeProgram({...config,id:"x');alert(1)//"}),/Program ID/);
  assert.throws(()=>getProgram('MISSING'),/not available/);
});

test('bounded questionnaire lists reject duplicate or oversized fields',()=>{
  const config={id:'EXAMPLE',name:'Example'};
  assert.throws(()=>normalizeProgram({...config,symptoms:[]}),/Questionnaire topics/);
  assert.throws(()=>normalizeProgram({...config,symptoms:[' Fatigue ','fatigue']}),/duplicate/);
  assert.throws(()=>normalizeProgram({...config,symptoms:['x'.repeat(101)]}),/100 characters/);
  assert.throws(()=>normalizeProgram({...config,urgentOptions:Array.from({length:11},(_,i)=>`Concern ${i}`)}),/Concern indicators/);
  assert.throws(()=>normalizeProgram({...config,labels:{contact:'x'.repeat(161)}}),/Question label contact/);
  assert.throws(()=>normalizeProgram({...config,cadence:'Every minute'}),/Choose Daily/);
  assert.throws(()=>normalizeProgram({...config,active:'false'}),/true or false/);
});

test('custom model endpoints, trained claims and incompatible reward amounts are rejected',()=>{
  const config={id:'EXAMPLE',name:'Example'};
  assert.throws(()=>normalizeProgram({...config,ai:{model:'https://example.test/model'}}),/supports only/);
  assert.throws(()=>normalizeProgram({...config,ai:{status:'clinically-validated'}}),/demo-untrained/);
  assert.throws(()=>normalizeProgram({...config,reward:{amount:20,unit:'test ADA'}}),/fixed 2 test ADA/);
  assert.throws(()=>normalizeProgram({...config,reward:{amount:2,unit:'USDM'}}),/fixed 2 test ADA/);
});

test('AI context is bounded program data without secrets or authority fields',()=>{
  const config={...getProgram('WELL-01'),apiKey:'do-not-forward',system:'do-not-forward',ai:{...getProgram('WELL-01').ai,instructions:'Review sleep descriptions.',apiKey:'do-not-forward'}};
  const context=programAIContext(config);
  assert.equal(context.reviewFocus,'Review sleep descriptions.');
  assert.equal(context.modelStatus,'demo-untrained');
  assert.deepEqual(context.medicationOptions,[]);
  assert.equal(context.reward,undefined);
  assert.ok(!JSON.stringify(context).includes('do-not-forward'));
});
