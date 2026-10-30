import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {build} from 'esbuild';
import {programFieldId,periodFieldId,rewardStatusForReport} from '../src/reward-status.js';
import {FIELD,signals} from '../src/zk-core.js';
import {STORAGE_KEY} from '../src/network.js';

function evidence(){
  const approval={reportId:'R-current',programId:'GLP-01',nullifier:'12345',root:'23456',c:{program:programFieldId('GLP-01'),period:'5',amount:'2000000',domain:'34567'}};
  const submitted={kind:'claim',reportId:approval.reportId,programId:approval.programId,nullifier:approval.nullifier,hash:'b'.repeat(64),confirmed:true};
  const chainState={...approval.c,root:approval.root,used:[approval.nullifier]};
  return {approval,submitted,chainState};
}

test('program IDs map to distinct canonical fields without changing the fixed reward',()=>{
  assert.equal(programFieldId('GLP-01'),programFieldId('GLP-01'));
  assert.notEqual(programFieldId('GLP-01'),programFieldId('ASTHMA-01'));
  assert.notEqual(programFieldId('AB'),programFieldId('AB0'));
  assert.ok(BigInt(programFieldId('Z'.repeat(32)))<FIELD);
  for(const id of [undefined,'','a','glp-01','A'.repeat(33),'ASTHMA 01','ÄB'])assert.throws(()=>programFieldId(id),/valid program ID/);
});

test('daily, weekly, fortnightly and monthly periods retain their full date identity',()=>{
  const ids=['2026-10-30','2026-10-31','2026-W44','2027-W44','2026-F22','2026-10','2026-11'];
  assert.equal(new Set(ids.map(periodFieldId)).size,ids.length);
  for(const value of ids)assert.ok(BigInt(periodFieldId(value))<FIELD);
  for(const invalid of [undefined,'','Week 44','2026','2026-W4'])assert.throws(()=>periodFieldId(invalid),/reporting period ID/);
});

test('only the linked report can show approval or a confirmed 2 ADA claim',()=>{
  const e=evidence();
  assert.equal(rewardStatusForReport('R-other',e),null);
  assert.equal(rewardStatusForReport('R-current',{approval:e.approval}).state,'approved');
  assert.deepEqual(rewardStatusForReport('R-current',e),{state:'confirmed',label:'Paid · 2 test ADA (Preprod)',txHash:e.submitted.hash});
});

test('funding or another report/program/nullifier transaction never pays this report',async t=>{
  for(const [name,change] of Object.entries({
    funding:{kind:'fund'},otherReport:{reportId:'R-other'},otherProgram:{programId:'ASTHMA-01'},otherNullifier:{nullifier:'54321'},missingReport:{reportId:undefined},missingHash:{hash:undefined},malformedHash:{hash:'not-a-transaction'},
  }))await t.test(name,()=>{
    const e=evidence();Object.assign(e.submitted,change);
    const status=rewardStatusForReport('R-current',e);assert.equal(status.state,'approved');assert.equal(status.txHash,undefined);
  });
});

test('a submitted claim needs confirmation and its exact nullifier in the matching live pool',async t=>{
  const cases={
    pending:e=>{e.submitted.confirmed=false;},
    'nonboolean confirmation':e=>{e.submitted.confirmed='true';},
    'restored without fresh pool':e=>{e.chainState=null;},
    'missing nullifier':e=>{e.chainState.used=[];},
    'another patient nullifier':e=>{e.chainState.used=['54321'];},
    'malformed used list':e=>{e.chainState.used='12345';},
    'different root':e=>{e.chainState.root='999';},
    'different program':e=>{e.chainState.program=programFieldId('ASTHMA-01');},
    'different period':e=>{e.chainState.period='6';},
    'different reward':e=>{e.chainState.amount='3000000';},
    'different domain':e=>{e.chainState.domain='999';},
    'program ID disagrees with proof field':e=>{e.approval.c.program='1';e.chainState.program='1';},
    'period ID disagrees with proof field':e=>{e.approval.periodId='2026-W05';},
    'unsupported reward in both records':e=>{e.approval.c.amount='3000000';e.chainState.amount='3000000';},
  };
  for(const [name,change] of Object.entries(cases))await t.test(name,()=>{const e=evidence();change(e);assert.equal(rewardStatusForReport('R-current',e).state,'submitted');});
});

test('legacy unlinked backups, malformed state and backend smoke receipts cannot credit a browser report',()=>{
  assert.equal(rewardStatusForReport('R-current'),null);
  assert.equal(rewardStatusForReport(undefined,evidence()),null);
  const e=evidence();delete e.approval.reportId;assert.equal(rewardStatusForReport('R-current',e),null);
  assert.equal(rewardStatusForReport('R-current',{receipt:{verified:true,patientNetLovelace:'2000000',transactions:{claim:{status:'confirmed'}}}}),null);
  const malformed=evidence();malformed.approval.nullifier='not-a-field';assert.equal(rewardStatusForReport('R-current',malformed).state,'approved');
});

let browserCode;
async function browser(saved=null){
  browserCode??=(await build({entryPoints:['src/privacy-ui.js'],bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',plugins:[{
    name:'wallet-fixture',setup(builder){
      builder.onResolve({filter:/^\/chain\/wallet\.js$/},()=>({path:'wallet-fixture',namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
        export const NETWORK='Preprod';
        export class Koios {}
        export const Lucid=async()=>window.fixture.lucid;
        export const assertWalletOnTargetNetwork=async()=>[];
        export const paymentKey=()=> 'a'.repeat(56);
        export const preparePool=async()=>({dep:{network:'Preprod',address:'pool',unit:'nft'},tx:window.fixture.tx('fund')});
        export const prepareClaim=async()=>window.fixture.tx('claim');
        export const transactionSummary=tx=>({fee:0.2,hash:tx.hash});
        export const readPool=async()=>window.fixture.pool;
      `}));
    },
  }]})).outputFiles[0].text;
  const storage=new Map(saved?[[STORAGE_KEY,saved]]:[]);
  const fixture={pool:null,status:'confirmed',tx:kind=>({hash:(kind==='fund'?'a':'b').repeat(64),sign:{withWallet:()=>({complete:async()=>({submit:async()=>(kind==='fund'?'a':'b').repeat(64)})})}})};
  fixture.lucid={selectWallet:{fromAPI(){}},wallet:()=>({address:async()=>'recipient'}),transactionStatus:async()=>({status:fixture.status})};
  const window={fixture,render(){},careloopEscape:String,cardano:{fixture:{name:'Fixture wallet',enable:async()=>{if(fixture.connectGate)await fixture.connectGate;return {getNetworkId:async()=>0};}}},snarkjs:{groth16:{fullProve:async w=>({publicSignals:signals(w),proof:{}}),verify:async()=>true}}};
  const context=vm.createContext({window,sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},crypto:webcrypto,TextEncoder,Uint8Array,location:{origin:'https://careloop.test'},fetch:async()=>({json:async()=>({})})});
  vm.runInContext(browserCode,context);
  return {window,fixture,storage,saved:(key=STORAGE_KEY)=>storage.get(key)??null,json:(key=STORAGE_KEY)=>JSON.parse(storage.get(key)??'null')};
}

test('browser approval and signed claim retain report binding; funding never becomes a paid report',async()=>{
  const b=await browser();const w=b.window;
  w.zkEnroll();w.zkApprove({id:'R-unique',programId:'ASTHMA-01',period:'Week 07 · 2026',periodId:'2026-W07'});
  let saved=b.json();const approval=saved.approval;
  assert.equal(approval.reportId,'R-unique');assert.equal(approval.programId,'ASTHMA-01');assert.equal(approval.c.program,programFieldId('ASTHMA-01'));assert.equal(approval.c.amount,'2000000');assert.equal(approval.c.period,periodFieldId('2026-W07'));
  await w.chainConnect(0);await w.chainFund();await w.chainSign();
  assert.ok(b.json().submitted,w.privacyPanel().match(/Action stopped:[^<]+/g)?.join('; '));
  b.fixture.pool={state:{...approval.c,root:approval.root,used:[approval.nullifier]},utxo:{assets:{lovelace:20000000n}}};
  await w.chainRefresh();assert.equal(b.json().submitted.confirmed,true);assert.equal(w.careloopRewardStatus('R-unique').state,'approved');
  await w.zkProve();await w.chainClaim();await w.chainSign();saved=b.json();
  assert.equal(saved.submitted.reportId,'R-unique');assert.equal(saved.submitted.programId,'ASTHMA-01');assert.equal(saved.submitted.nullifier,approval.nullifier);
  assert.equal(w.careloopRewardStatus('R-unique').state,'submitted');
  b.fixture.pool.state.used=[];await w.chainRefresh();assert.equal(w.careloopRewardStatus('R-unique').state,'submitted');
  b.fixture.pool.state.used=[approval.nullifier];await w.chainRefresh();assert.equal(w.careloopRewardStatus('R-unique').state,'confirmed');assert.equal(w.careloopRewardStatus('R-new-questionnaire'),null);
  const restored=await browser(b.saved());assert.equal(restored.json().submitted.confirmed,true);assert.equal(restored.window.careloopRewardStatus('R-unique').state,'submitted');
  const guestRecovery=b.saved();w.careloopSetRewardOwner('account-a');
  assert.equal(w.careloopRewardStatus('R-unique'),null);assert.equal(w.careloopCommitment,undefined);assert.doesNotMatch(w.privacyPanel(),/Connected: recipient/);assert.deepEqual(b.json().submitted,JSON.parse(guestRecovery).submitted);
  w.zkEnroll();w.zkApprove({id:'R-unique',programId:'GLP-01',period:'Week 07',periodId:'2026-W07'});
  assert.equal(w.careloopRewardStatus('R-unique').state,'approved');assert.equal(b.json(STORAGE_KEY+':account:account-a').ownerId,'account-a');
  const accountRecovery=b.saved(STORAGE_KEY+':account:account-a');w.careloopSetRewardOwner('account-b');assert.equal(w.careloopRewardStatus('R-unique'),null);assert.equal(b.saved(STORAGE_KEY+':account:account-a'),accountRecovery);
  w.careloopSetRewardOwner(null);assert.equal(w.careloopRewardStatus('R-unique').state,'submitted');assert.equal(b.json().dep.address,'pool');
  w.careloopSetRewardOwner('account-a');assert.equal(w.careloopRewardStatus('R-unique').state,'approved');assert.equal(b.json(STORAGE_KEY+':account:account-a').approval.programId,'GLP-01');
});

test('reward owner cannot change while a wallet action is in progress',async()=>{
  const b=await browser();const w=b.window;w.zkEnroll();const guest=b.saved();
  let release;b.fixture.connectGate=new Promise(resolve=>{release=resolve;});
  const connection=w.chainConnect(0);assert.equal(w.careloopRewardBusy(),true);
  assert.throws(()=>w.careloopSetRewardOwner('account-a'),/current reward action/);assert.equal(b.saved(),guest);assert.equal(b.saved(STORAGE_KEY+':account:account-a'),null);
  release();await connection;assert.equal(w.careloopRewardBusy(),false);w.careloopSetRewardOwner('account-a');assert.equal(w.careloopCommitment,undefined);
});

test('account restoration rejects mismatched owners and Preview while preserving saved files',async()=>{
  const b=await browser();const key=STORAGE_KEY+':account:account-a';
  const wrongOwner=JSON.stringify({network:'Preprod',networkMagic:1,ownerId:'account-b',secret:'123'});b.storage.set(key,wrongOwner);b.window.careloopSetRewardOwner('account-a');assert.equal(b.window.careloopCommitment,undefined);assert.equal(b.saved(key),wrongOwner);
  assert.throws(()=>b.window.zkEnroll(),/recovery data needs inspection/);
  b.window.careloopSetRewardOwner(null);assert.equal(b.saved(key),wrongOwner);const preview=JSON.stringify({network:'Preview',networkMagic:2,ownerId:'account-a',secret:'123'});b.storage.set(key,preview);b.window.careloopSetRewardOwner('account-a');assert.equal(b.window.careloopCommitment,undefined);assert.equal(b.saved(key),preview);b.window.careloopSetRewardOwner(null);assert.equal(b.saved(key),preview);
});
