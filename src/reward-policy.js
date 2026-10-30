// Payment eligibility is a deterministic application policy. The model supplies
// evidence for review; it never supplies the approval signature or payment state.
export function rewardDecision(answers,program,ai,{error=false}={}){
 const clinicalReview=answers.urgent?.length||ai?.review_priority==='priority_review'?'priority_review':answers.contact==='Yes'||Object.values(answers.symptoms||{}).includes('Severe')||ai?.review_priority==='review_requested'?'review_requested':'routine';
 const base={source:'policy',version:1,clinicalReview};
 if(error)return {...base,state:'on_hold',reasons:['AI analysis is unavailable. Retry analysis or ask the clinic to review completion.']};
 if(!ai)return {...base,state:'checking',reasons:['Waiting for the saved report analysis.']};
 if(!['routine','review_requested','priority_review'].includes(ai.review_priority)||!Array.isArray(ai.missing_information)||!Array.isArray(ai.possible_contradictions))return {...base,state:'on_hold',reasons:['The AI result is incomplete. Clinic review or a valid analysis is required.']};
 const reasons=[];
 const required=['status','impact','hydration','contact',...(program.medicationOptions?.length?['medication','missed']:[])];
 const missing=required.filter(key=>typeof answers[key]!=='string'||!answers[key].trim());
 if(missing.length)reasons.push('Required answers need completion: '+missing.join(', ')+'.');
 const incompleteTopics=(program.symptoms||[]).filter(topic=>!['None','Mild','Moderate','Severe','Not sure'].includes(answers.symptoms?.[topic]));
 if(incompleteTopics.length)reasons.push('Some experience topics have no valid answer.');
 const modelMissing=(ai.missing_information||[]).filter(key=>required.includes(key)||key==='symptoms');
 if(modelMissing.length)reasons.push('The AI requested clarification of required answers: '+[...new Set(modelMissing)].join(', ')+'.');
 if(ai.possible_contradictions?.length)reasons.push('Possible inconsistencies require clinic clarification: '+ai.possible_contradictions.slice(0,5).join(' '));
 // Severity, urgent checkboxes, optional omissions and requests for medical
 // contact never remove a completion reward by themselves.
 return {...base,state:reasons.length?'on_hold':'approved',reasons:reasons.length?reasons:['Enrollment and completion checks passed; no unresolved answer inconsistencies were identified.']};
}
