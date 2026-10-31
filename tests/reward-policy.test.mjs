import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardDecision} from '../src/reward-policy.js';
const program={medicationOptions:['Demo treatment'],symptoms:['Fatigue']};
const answers={status:'Taking as prescribed',medication:'Demo treatment',missed:'No',impact:'Not at all',hydration:'Yes',contact:'No',symptoms:{Fatigue:'None'},urgent:[]};
const ai={review_priority:'routine',missing_information:[],possible_contradictions:[],submission_validity:{status:'clear',issues:[]}};
test('complete enrolled submissions pass the application policy, not an AI approval flag',()=>{
 const decision=rewardDecision(answers,program,{...ai,approval:false});assert.equal(decision.state,'approved');assert.equal(decision.source,'policy');
 assert.equal(rewardDecision(answers,program,null).state,'checking');
});
test('medical concerns and optional omissions do not withhold completion rewards',()=>{
 const decision=rewardDecision({...answers,symptoms:{Fatigue:'Severe'},urgent:['Concern'],contact:'Yes'},program,{...ai,review_priority:'priority_review',missing_information:['dose','lastDose','notes','details']});
 assert.equal(decision.state,'approved');assert.equal(decision.clinicalReview,'priority_review');
 assert.equal(rewardDecision({...answers,symptoms:{Fatigue:'Not sure'}},program,ai).state,'approved');
});
test('missing required answers, contradictions and failed analysis hold payment for clarification',()=>{
 assert.equal(rewardDecision({...answers,missed:''},program,ai).state,'on_hold');
 assert.equal(rewardDecision(answers,program,{...ai,missing_information:['status']}).state,'on_hold');
 assert.equal(rewardDecision(answers,program,{...ai,possible_contradictions:['Reports both no dose and taking a dose.']}).state,'on_hold');
 assert.equal(rewardDecision(answers,program,null,{error:true}).state,'on_hold');
 assert.equal(rewardDecision(answers,program,{approval:true}).state,'on_hold');
});

test('the reported bare death answer holds payment even when the model misses it',()=>{
 for(const details of ['I died','I died.','I am dead',"I'm dead",'I’m dead!']){
  const result=rewardDecision({...answers,details,notes:'Fuck you',symptoms:{Fatigue:'Severe'},urgent:['Concern']},program,ai);
  assert.equal(result.state,'on_hold');assert.equal(result.clinicalReview,'priority_review');
  assert.match(result.reasons.join(' '),/details:.*cannot be interpreted/);
 }
});

test('profanity, severe symptoms and contextual descriptions alone do not invalidate a report',()=>{
 for(const details of ['', 'I nearly died.', 'I died during cardiac arrest and was resuscitated.', 'I did not die.', 'I died laughing at the film.']){
  const result=rewardDecision({...answers,details,notes:'Fuck you',symptoms:{Fatigue:'Severe'},urgent:['Concern']},program,ai);
  assert.equal(result.state,'approved');assert.equal(result.clinicalReview,'priority_review');
 }
});

test('validity evidence holds other uninterpretable answers; missing or malformed checks cannot approve',()=>{
 const details='purple spaceship banana';
 const issue={kind:'incoherent',source_question:'details',quote:details,reason:'The answer does not describe the reported experience.'};
 const result=rewardDecision({...answers,details},program,{...ai,submission_validity:{status:'needs_clarification',issues:[issue]}});
 assert.equal(result.state,'on_hold');assert.match(result.reasons.join(' '),/purple spaceship banana/);
 for(const submission_validity of [undefined,{status:'clear',issues:[issue]},{status:'needs_clarification',issues:[]},{status:'clear',issues:'none'}]){
  assert.equal(rewardDecision(answers,program,{...ai,submission_validity}).state,'on_hold');
 }
});
