import {writeFileSync} from 'node:fs';
import {validateInput,validateProgramInput,analyze} from '../../src/api.js';
export function parseJob(input){
 if(typeof input!=='string'||input.length>16000)throw Error('Bounded fictional report required');
 const marker='CARELOOP_REPORT_JSON\n';
 const start=input.indexOf(marker);
 const raw=start===-1?input.trim():input.slice(start+marker.length).trim();
 let body;try{body=JSON.parse(raw);}catch{throw Error('Supply CARELOOP_REPORT_JSON followed by the fictional questionnaire JSON');}
 return {answers:validateInput(body),program:validateProgramInput(body)};
}
export const parseReport=input=>parseJob(input).answers;
export const client={async health(){if(!process.env.GEMINI_API_KEY)throw Error('Private Gemini API key is missing');}};
export async function answer(input,journal,deadline){
 const {answers,program}=parseJob(input);
 if(deadline!==undefined&&Date.now()+45000>=deadline)throw Error('Insufficient time before result deadline');
 writeFileSync(journal,JSON.stringify({phase:'sending',provider:'gemini'}),{mode:0o600});
 let response;
 for(let attempt=0;attempt<2;attempt++){
  try{response=await analyze(answers,{...process.env,AI_PROVIDER:'gemini'},(url,options)=>{
   const body=JSON.parse(options.body);
   body.system_instruction.parts[0].text+=' Every finding.source_question MUST be exactly one of these TOP-LEVEL keys: '+JSON.stringify(Object.keys(answers))+'. Never use dotted paths such as symptoms.nausea; cite symptoms instead. Put absent information only in missing_information, never in findings. Quotes must be nonempty verbatim text from the cited value.';
   return fetch(url,{...options,body:JSON.stringify(body)});
  },program);break;}
  catch(error){
   if(attempt||!['Invalid evidence','AI cited unsupported evidence','Invalid AI response'].includes(error.message))throw error;
   if(deadline!==undefined&&Date.now()+45000>=deadline)throw Error('Insufficient time before retry deadline');
   writeFileSync(journal,JSON.stringify({phase:'retrying-invalid-output',provider:'gemini',attempt:2}),{mode:0o600});
  }
 }
 if(response.status!==200)throw Error(response.body.error||'Model request failed');
 if(deadline!==undefined&&Date.now()>=deadline)throw Error('Result deadline expired');
 const result=JSON.stringify(response.body,null,2);
 writeFileSync(journal,JSON.stringify({phase:'answered',result:response.body}),{mode:0o600});
 return result;
}
