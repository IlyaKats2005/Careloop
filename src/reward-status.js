import {field} from './zk-core.js';

const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=200&&value.trim()===value;
const programIdentifier=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_-]{1,31}$/.test(value);
const canonical=value=>{
  if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value))return false;
  try{return field(value).toString()===value;}catch{return false;}
};

// Valid program IDs contain at most 32 ASCII bytes and start with A-Z. Their
// unsigned byte encoding therefore fits the BLS12-381 field without truncation.
function asciiFieldId(value){
  let encoded=0n;
  for(const byte of new TextEncoder().encode(value))encoded=(encoded<<8n)|BigInt(byte);
  return field(encoded).toString();
}
export function programFieldId(programId){
  if(!programIdentifier(programId))throw Error('A valid program ID is required for reward approval.');
  return asciiFieldId(programId);
}

export function periodFieldId(periodId){
  if(typeof periodId!=='string'||!/^\d{4}-(?:W\d{2}|F\d{2}|\d{2}(?:-\d{2})?)$/.test(periodId))throw Error('A valid reporting period ID is required for reward approval.');
  return asciiFieldId(periodId);
}

export function rewardStatusForReport(reportId,{approval,submitted,chainState}={}){
  if(!identifier(reportId)||!approval||approval.reportId!==reportId||!programIdentifier(approval.programId))return null;
  const approved={state:'approved',label:'Approved · not paid'};
  const matchingClaim=submitted?.kind==='claim'&&submitted.reportId===reportId&&
    submitted.programId===approval.programId&&canonical(approval.nullifier)&&
    submitted.nullifier===approval.nullifier&&typeof submitted.hash==='string'&&/^[0-9a-f]{64}$/i.test(submitted.hash);
  if(!matchingClaim)return approved;
  const pending={state:'submitted',label:'Claim submitted · confirmation pending',txHash:submitted.hash};
  if(submitted.confirmed!==true||!Array.isArray(chainState?.used)||!chainState.used.includes(submitted.nullifier))return pending;
  const expected={root:approval.root,program:approval.c?.program,period:approval.c?.period,amount:approval.c?.amount,domain:approval.c?.domain};
  if(approval.periodId!=null){try{if(expected.period!==periodFieldId(approval.periodId))return pending;}catch{return pending;}}
  if(expected.program!==programFieldId(approval.programId)||expected.amount!=='2000000'||
    Object.entries(expected).some(([key,value])=>!canonical(value)||chainState[key]!==value))return pending;
  return {state:'confirmed',label:'Paid · 2 test ADA (Preprod)',txHash:submitted.hash};
}
