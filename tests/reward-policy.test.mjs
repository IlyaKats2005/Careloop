import test from 'node:test';
import assert from 'node:assert/strict';
import {rewardDecision} from '../src/reward-policy.js';
const program={medicationOptions:['Demo treatment'],symptoms:['Fatigue']};
const answers={status:'Taking as prescribed',medication:'Demo treatment',missed:'No',impact:'Not at all',hydration:'Yes',contact:'No',symptoms:{Fatigue:'None'},urgent:[]};
const ai={review_priority:'routine',missing_information:[],possible_contradictions:[]};
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
