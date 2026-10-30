import {field,leaf,hash} from './zk-core.js';

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

export function cloudRewardApproval(report){
  const source=report?.rewardApproval;
  if(!source)return null;
  if(!identifier(report.id)||source.reportId!==report.id||source.programId!==report.programId||source.periodId!==report.periodId)throw Error('Cloud approval does not match this report.');
  const c=Object.fromEntries(['program','period','amount','domain'].map(key=>[key,source.c?.[key]]));
  if(Object.values(c).some(value=>!canonical(value))||c.program!==programFieldId(report.programId)||c.period!==periodFieldId(report.periodId)||c.amount!=='2000000'||!canonical(source.root)||!canonical(source.commitment))throw Error('Cloud approval has invalid program or reward terms.');
  if(!Array.isArray(source.siblings)||source.siblings.length!==3||source.siblings.some(value=>!canonical(value))||!Array.isArray(source.directions)||source.directions.length!==3||source.directions.some(value=>value!=='0'&&value!=='1'))throw Error('Invalid cloud approval path.');
  let node=BigInt(leaf(source.commitment,c));
  for(let i=0;i<3;i++)node=source.directions[i]==='0'?hash(node,source.siblings[i]):hash(source.siblings[i],node);
  if(node.toString()!==source.root)throw Error('Cloud approval path does not match its commitment and root.');
  return {reportId:report.id,programId:report.programId,periodId:report.periodId,periodLabel:String(source.periodLabel||report.period||report.periodId).slice(0,160),root:source.root,siblings:[...source.siblings],directions:[...source.directions],commitment:source.commitment,c};
}

export function publicRewardDeployment(dep){
  if(!dep||dep.network!=='Preprod'||!/^addr_test1[0-9a-z]{40,180}$/.test(dep.address||'')||!/^[0-9a-f]{56,120}$/i.test(dep.unit||'')||!/^[0-9a-f]{56}$/i.test(dep.clinic||'')||!/^[0-9a-f]{64}$/i.test(dep.seed?.txHash||'')||!Number.isSafeInteger(dep.seed?.outputIndex)||dep.seed.outputIndex<0)throw Error('Invalid public Preprod pool configuration.');
  return {network:'Preprod',seed:{txHash:dep.seed.txHash,outputIndex:dep.seed.outputIndex},clinic:dep.clinic,address:dep.address,unit:dep.unit};
}

export function poolMatchesApproval(state,approval){
  return !!approval&&['root','program','period','amount','domain'].every(key=>state?.[key]===(key==='root'?approval.root:approval.c?.[key]));
}

// Koios normal inputs/outputs exclude collateral and reference inputs. Decode
// inline datum CBOR: JSON datum numbers cannot represent field elements exactly.
export function verifyRewardTransaction(kind,txHash,info,dep,approval,decodeState){
  try{
    if(info?.tx_hash!==txHash||!Number.isInteger(info.block_height)||info.block_height<=0||!Array.isArray(info.inputs)||!Array.isArray(info.outputs))return null;
    const quantity=entry=>(entry.asset_list||[]).filter(a=>a.policy_id+(a.asset_name||'')===dep.unit).reduce((n,a)=>n+BigInt(a.quantity),0n);
    const poolOutputs=info.outputs.filter(o=>o.payment_addr?.bech32===dep.address&&quantity(o)===1n);
    if(poolOutputs.length!==1)return null;
    const after=decodeState(poolOutputs[0].inline_datum?.bytes);
    if(!poolMatchesApproval(after,approval)||!Array.isArray(after.used))return null;
    if(kind==='fund'){
      if(BigInt(poolOutputs[0].value)!==20000000n||after.used.length!==0||!info.inputs.some(i=>i.tx_hash===dep.seed.txHash&&i.tx_index===dep.seed.outputIndex))return null;
      if(!info.plutus_contracts?.some(c=>c.valid_contract===true&&c.script_hash===dep.unit.slice(0,56)))return null;
      return {verified:true};
    }
    if(kind!=='claim')return null;
    const poolInputs=info.inputs.filter(i=>i.payment_addr?.bech32===dep.address&&quantity(i)===1n);
    if(poolInputs.length!==1)return null;
    const before=decodeState(poolInputs[0].inline_datum?.bytes);
    if(!poolMatchesApproval(before,approval)||!Array.isArray(before.used)||BigInt(poolInputs[0].value)-BigInt(poolOutputs[0].value)!==2000000n)return null;
    const nullifier=after.used[0];
    if(!canonical(nullifier)||before.used.includes(nullifier)||after.used.length!==before.used.length+1||before.used.some((n,i)=>after.used[i+1]!==n)||approval.nullifier&&approval.nullifier!==nullifier)return null;
    const contract=info.plutus_contracts?.find(c=>c.address===dep.address&&c.valid_contract===true&&c.spends_input?.tx_hash===poolInputs[0].tx_hash&&c.spends_input?.tx_index===poolInputs[0].tx_index&&c.input?.redeemer?.purpose==='spend'&&c.input.redeemer.datum?.value?.constructor===1);
    const recipient=contract?.input.redeemer.datum.value.fields?.[2]?.bytes;
    if(!/^[0-9a-f]{56}$/i.test(recipient||''))return null;
    const payment=info.outputs.find(o=>o.payment_addr?.cred===recipient&&BigInt(o.value)===2000000n);
    if(!payment)return null;
    return {verified:true,nullifier,recipientAddress:payment.payment_addr.bech32};
  }catch{return null;}
}

export function rewardStatusForReport(reportId,{approval,submitted,chainState}={}){
  if(!identifier(reportId)||!approval||approval.reportId!==reportId||!programIdentifier(approval.programId))return null;
  const approved={state:'approved',label:'Approved · not paid'};
  const expectedNullifier=canonical(approval.nullifier)?approval.nullifier:submitted?.chainVerified===true&&submitted.source==='cloud'?submitted.nullifier:null;
  const matchingClaim=submitted?.kind==='claim'&&submitted.reportId===reportId&&
    submitted.programId===approval.programId&&canonical(expectedNullifier)&&
    submitted.nullifier===expectedNullifier&&typeof submitted.hash==='string'&&/^[0-9a-f]{64}$/i.test(submitted.hash);
  if(!matchingClaim&&submitted?.source==='cloud'&&submitted.kind==='claim'&&submitted.reportId===reportId&&submitted.programId===approval.programId&&/^[0-9a-f]{64}$/i.test(submitted.hash||''))return {state:'submitted',label:'Claim reported · awaiting Preprod verification',txHash:submitted.hash};
  if(!matchingClaim)return approved;
  const pending={state:'submitted',label:'Claim submitted · confirmation pending',txHash:submitted.hash};
  if(submitted.source==='cloud'&&submitted.chainVerified!==true)return pending;
  if(submitted.confirmed!==true||!Array.isArray(chainState?.used)||!chainState.used.includes(submitted.nullifier))return pending;
  const expected={root:approval.root,program:approval.c?.program,period:approval.c?.period,amount:approval.c?.amount,domain:approval.c?.domain};
  if(approval.periodId!=null){try{if(expected.period!==periodFieldId(approval.periodId))return pending;}catch{return pending;}}
  if(expected.program!==programFieldId(approval.programId)||expected.amount!=='2000000'||
    Object.entries(expected).some(([key,value])=>!canonical(value)||chainState[key]!==value))return pending;
  return {state:'confirmed',label:'Paid · 2 test ADA (Preprod)',txHash:submitted.hash};
}
