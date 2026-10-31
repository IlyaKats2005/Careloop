// Checks whether an answer is interpretable, not whether the author is honest.
export const answerFields=new Set(['medication','status','dose','lastDose','missed','changes','symptoms','urgent','impact','hydration','details','contact','notes']);
const kinds=new Set(['implausible','incoherent','contradictory','non_answer']);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function validateSubmissionValidity(value,answers){
 if(!value||!['clear','needs_clarification'].includes(value.status)||!Array.isArray(value.issues)||value.issues.length>8)throw Error('Invalid submission validity');
 const issues=value.issues.map(issue=>{
  if(!issue||!kinds.has(issue.kind)||!answerFields.has(issue.source_question)||!text(issue.quote,500)||!text(issue.reason,500))throw Error('Invalid validity evidence');
  const source=answers[issue.source_question];
  if(source===undefined||!(typeof source==='string'?source:JSON.stringify(source)).includes(issue.quote))throw Error('Unsupported validity evidence');
  return {kind:issue.kind,source_question:issue.source_question,quote:issue.quote,reason:issue.reason};
 });
 if((value.status==='clear')!==(issues.length===0))throw Error('Inconsistent submission validity');
 return {status:value.status,issues};
}
export function directClarificationIssues(answers){
 // Deliberately only a whole bare answer. Context such as resuscitation,
 // negation, reported speech or figurative explanations is left to the model.
 const bareDeath=/^\s*(?:i\s+(?:died|am\s+dead)|i['’]m\s+dead)[.!?\s]*$/iu;
 const issues=[];
 for(const key of ['status','dose','lastDose','missed','changes','impact','hydration','details','notes']){
  const value=answers[key];
  if(typeof value==='string'&&bareDeath.test(value))issues.push({kind:'implausible',source_question:key,quote:value,reason:'A bare statement of the respondent’s own death cannot be interpreted as a current self-report. Clarify what happened or what was meant.'});
 }
 return issues;
}
