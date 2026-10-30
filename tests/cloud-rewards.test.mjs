import test from 'node:test';
import assert from 'node:assert/strict';
import {commitment,leaf,tree,FIELD} from '../src/zk-core.js';
import {
  cloudRewardApproval,publicRewardDeployment,poolMatchesApproval,
  programFieldId,periodFieldId,verifyRewardTransaction,rewardStatusForReport,
} from '../src/reward-status.js';

const clone=value=>structuredClone(value);
const txHash='e'.repeat(64);
const poolInputHash='f'.repeat(64);
const recipient='d'.repeat(56);
const patientAddress='addr_test1'+'p'.repeat(60);
const nullifier='12345';

function cloudReport(){
  const c={program:programFieldId('GLP-01'),period:periodFieldId('2026-W44'),amount:'2000000',domain:'987654321'};
  const enrollmentCommitment=commitment('123456789');
  const leaves=Array.from({length:8},(_,i)=>leaf(commitment(String(i+100)),c));
  leaves[3]=leaf(enrollmentCommitment,c);
  return {
    id:'report-cloud-1',programId:'GLP-01',periodId:'2026-W44',period:'Week 44',
    rewardApproval:{
      ...tree(leaves,3),c,reportId:'report-cloud-1',programId:'GLP-01',
      periodId:'2026-W44',periodLabel:'Week 44',commitment:enrollmentCommitment,
    },
  };
}

function deployment(){
  return {
    network:'Preprod',seed:{txHash:'b'.repeat(64),outputIndex:1},
    clinic:'c'.repeat(56),address:'addr_test1'+'q'.repeat(60),
    unit:'a'.repeat(56)+'436172656c6f6f70',
  };
}

function transactionFixture(kind='claim'){
  const approval=cloudRewardApproval(cloudReport());
  const dep=deployment();
  const before={...approval.c,root:approval.root,used:['67890']};
  const after={...before,used:kind==='claim'?[nullifier,...before.used]:[]};
  const asset={policy_id:dep.unit.slice(0,56),asset_name:dep.unit.slice(56),quantity:'1'};
  const poolEntry=(bytes,value)=>({
    payment_addr:{bech32:dep.address},asset_list:[{...asset}],
    inline_datum:{bytes},value:String(value),
  });
  const info={
    tx_hash:txHash,block_height:5354081,
    inputs:kind==='claim'
      ?[{...poolEntry('before',20000000),tx_hash:poolInputHash,tx_index:2}]
      :[{tx_hash:dep.seed.txHash,tx_index:dep.seed.outputIndex,value:'30000000',asset_list:[]}],
    outputs:[poolEntry('after',kind==='claim'?18000000:20000000)],
    plutus_contracts:kind==='claim'?[{
      address:dep.address,valid_contract:true,
      spends_input:{tx_hash:poolInputHash,tx_index:2},
      input:{redeemer:{purpose:'spend',datum:{value:{constructor:1,fields:[{}, {}, {bytes:recipient}, {}]}}}},
    }]:[{valid_contract:true,script_hash:dep.unit.slice(0,56)}],
  };
  if(kind==='claim')info.outputs.push({payment_addr:{bech32:patientAddress,cred:recipient},value:'2000000',asset_list:[]});
  const decodeState=bytes=>{
    if(bytes==='before')return before;
    if(bytes==='after')return after;
    throw Error('Missing or unknown inline datum CBOR');
  };
  return {approval,dep,before,after,info,decodeState};
}

test('cloud approval validates the commitment path and strips private or caller-injected fields',()=>{
  const report=cloudReport();
  report.rewardApproval.secret='must-not-leave-client';
  report.rewardApproval.nullifier='111';
  report.rewardApproval.c.secret='also-private';
  report.rewardApproval.verified=true;
  const normalized=cloudRewardApproval(report);
  assert.deepEqual(Object.keys(normalized).sort(),['reportId','programId','periodId','periodLabel','root','siblings','directions','commitment','c'].sort());
  assert.deepEqual(Object.keys(normalized.c).sort(),['program','period','amount','domain'].sort());
  assert.equal(Object.hasOwn(normalized,'secret'),false);
  assert.equal(Object.hasOwn(normalized,'nullifier'),false);
  assert.equal(Object.hasOwn(normalized,'verified'),false);
  assert.equal(normalized.commitment,report.rewardApproval.commitment);
  assert.notEqual(normalized.siblings,report.rewardApproval.siblings);
  assert.notEqual(normalized.c,report.rewardApproval.c);
});

test('clinic normalizes a public approval without obtaining or manufacturing a patient nullifier',()=>{
  const report=cloudReport();
  assert.equal(Object.hasOwn(report.rewardApproval,'secret'),false);
  const approval=cloudRewardApproval(report);
  assert.equal(Object.hasOwn(approval,'nullifier'),false);
  assert.equal(rewardStatusForReport(report.id,{approval}).state,'approved');
  assert.equal(cloudRewardApproval({id:'unapproved'}),null);
});

test('cloud approval rejects another report, wrong terms, malformed paths, or altered commitments',async t=>{
  const cases={
    'another report':r=>{r.rewardApproval.reportId='other';},
    'another program':r=>{r.rewardApproval.programId='ASTHMA-01';},
    'another period':r=>{r.rewardApproval.periodId='2026-W43';},
    'wrong encoded program':r=>{r.rewardApproval.c.program='1';},
    'wrong reward amount':r=>{r.rewardApproval.c.amount='3000000';},
    'noncanonical field':r=>{r.rewardApproval.c.domain=FIELD.toString();},
    'short path':r=>{r.rewardApproval.siblings.pop();},
    'nonbinary direction':r=>{r.rewardApproval.directions[0]='2';},
    'numeric direction':r=>{r.rewardApproval.directions[0]=1;},
    'changed sibling':r=>{r.rewardApproval.siblings[0]='1';},
    'changed commitment':r=>{r.rewardApproval.commitment=commitment('999999');},
    'changed root':r=>{r.rewardApproval.root='123';},
  };
  for(const [name,change] of Object.entries(cases))await t.test(name,()=>{
    const report=cloudReport();change(report);assert.throws(()=>cloudRewardApproval(report));
  });
});

test('public deployment strips scripts and private fields while retaining the precise public seed reference',()=>{
  const dep=deployment();
  const untrusted={...dep,secret:'private',seedPhrase:'private',policy:{script:'untrusted'},validator:{script:'untrusted'},seed:{...dep.seed,seedPhrase:'private'}};
  assert.deepEqual(publicRewardDeployment(untrusted),dep);
});

test('public deployment rejects wrong network and malformed deployment identities',async t=>{
  const cases={
    mainnet:d=>{d.network='Mainnet';},
    preview:d=>{d.network='Preview';},
    'invalid address':d=>{d.address='addr1not-testnet';},
    'invalid asset':d=>{d.unit='not-hex';},
    'invalid clinic':d=>{d.clinic='a'.repeat(55);},
    'invalid seed hash':d=>{d.seed.txHash='a'.repeat(63);},
    'negative output index':d=>{d.seed.outputIndex=-1;},
    'fractional output index':d=>{d.seed.outputIndex=0.5;},
    'unsafe output index':d=>{d.seed.outputIndex=Number.MAX_SAFE_INTEGER+1;},
  };
  for(const [name,change] of Object.entries(cases))await t.test(name,()=>{
    const dep=deployment();change(dep);assert.throws(()=>publicRewardDeployment(dep));
  });
});

test('funding verification requires the exact seed, state NFT, 20 ADA, empty nullifiers, and valid mint',()=>{
  const f=transactionFixture('fund');
  assert.equal(poolMatchesApproval(f.after,f.approval),true);
  assert.deepEqual(verifyRewardTransaction('fund',txHash,f.info,f.dep,f.approval,f.decodeState),{verified:true});
  assert.equal(verifyRewardTransaction('claim',txHash,f.info,f.dep,f.approval,f.decodeState),null);
  for(const change of [
    x=>{x.inputs[0].tx_index++;},
    x=>{x.outputs[0].value='19000000';},
    x=>{x.outputs[0].asset_list[0].quantity='2';},
    x=>{x.plutus_contracts[0].valid_contract=false;},
    x=>{x.plutus_contracts[0].script_hash='0'.repeat(56);},
  ]){
    const info=clone(f.info);change(info);
    assert.equal(verifyRewardTransaction('fund',txHash,info,f.dep,f.approval,f.decodeState),null);
  }
  f.after.used=[nullifier];
  assert.equal(verifyRewardTransaction('fund',txHash,f.info,f.dep,f.approval,f.decodeState),null);
});

test('claim verification proves the exact 2 ADA payout and append-only nullifier transition without the patient secret',()=>{
  const f=transactionFixture();
  assert.equal(Object.hasOwn(f.approval,'nullifier'),false);
  assert.deepEqual(verifyRewardTransaction('claim',txHash,f.info,f.dep,f.approval,f.decodeState),{verified:true,nullifier,recipientAddress:patientAddress});
  assert.equal(verifyRewardTransaction('fund',txHash,f.info,f.dep,f.approval,f.decodeState),null);
  assert.deepEqual(verifyRewardTransaction('claim',txHash,f.info,f.dep,{...f.approval,nullifier},f.decodeState),{verified:true,nullifier,recipientAddress:patientAddress});
  assert.equal(verifyRewardTransaction('claim',txHash,f.info,f.dep,{...f.approval,nullifier:'555'},f.decodeState),null);
});

test('claim verification rejects unrelated transactions, failed validators, wrong input links and diverted or partial payments',async t=>{
  const cases={
    'unrelated transaction hash':f=>{f.info.tx_hash='0'.repeat(64);},
    'unconfirmed transaction':f=>{f.info.block_height=null;},
    'failed validator':f=>{f.info.plutus_contracts[0].valid_contract=false;},
    'wrong consumed transaction':f=>{f.info.plutus_contracts[0].spends_input.tx_hash='0'.repeat(64);},
    'wrong consumed index':f=>{f.info.plutus_contracts[0].spends_input.tx_index++;},
    'wrong script address':f=>{f.info.plutus_contracts[0].address='other-pool';},
    'mint redeemer instead of spending':f=>{f.info.plutus_contracts[0].input.redeemer.purpose='mint';},
    'publish-root action instead of claim':f=>{f.info.plutus_contracts[0].input.redeemer.datum.value.constructor=0;},
    'partial reward':f=>{f.info.outputs[1].value='1000000';},
    'wrong recipient':f=>{f.info.outputs[1].payment_addr.cred='0'.repeat(56);},
    'missing payout':f=>{f.info.outputs.pop();},
    'extra pool withdrawal':f=>{f.info.outputs[0].value='17000000';},
    'missing pool input':f=>{f.info.inputs=[];},
    'multiple pool inputs':f=>{f.info.inputs.push(clone(f.info.inputs[0]));},
    'multiple state NFT outputs':f=>{f.info.outputs.push(clone(f.info.outputs[0]));},
    'missing datum bytes':f=>{delete f.info.outputs[0].inline_datum.bytes;},
    'changed approval root':f=>{f.after.root='234';},
    'reset older nullifiers':f=>{f.after.used=[nullifier];},
    'reordered older nullifiers':f=>{f.before.used=['67890','111'];f.after.used=[nullifier,'111','67890'];},
    'reused nullifier':f=>{f.before.used=[nullifier];f.after.used=[nullifier,nullifier];},
    'noncanonical nullifier':f=>{f.after.used=['01',...f.before.used];},
  };
  for(const [name,change] of Object.entries(cases))await t.test(name,()=>{
    const f=transactionFixture();change(f);
    assert.equal(verifyRewardTransaction('claim',txHash,f.info,f.dep,f.approval,f.decodeState),null);
  });
});

test('unverified cloud metadata cannot turn an approved report into paid even when its claimed hash and nullifier look valid',()=>{
  const f=transactionFixture();
  const submitted={source:'cloud',kind:'claim',reportId:f.approval.reportId,programId:f.approval.programId,hash:txHash,nullifier,confirmed:true,verified:true};
  for(const approval of [f.approval,{...f.approval,nullifier}]){
    const status=rewardStatusForReport(approval.reportId,{approval,submitted,chainState:f.after});
    assert.equal(status.state,'submitted');
  }
  const verified=verifyRewardTransaction('claim',txHash,f.info,f.dep,f.approval,f.decodeState);
  const checked={...submitted,chainVerified:verified.verified,nullifier:verified.nullifier};
  assert.equal(rewardStatusForReport(f.approval.reportId,{approval:f.approval,submitted:checked,chainState:f.after}).state,'confirmed');
  assert.notEqual(rewardStatusForReport(f.approval.reportId,{approval:f.approval,submitted:{...checked,kind:'fund'},chainState:f.after}).state,'confirmed');
});
