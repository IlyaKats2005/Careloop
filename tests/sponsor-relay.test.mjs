import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Emulator,generateEmulatorAccount} from '@lucid-evolution/lucid';
import {groth16} from 'snarkjs';
import {Lucid,preparePool,prepareClaim,readPool,paymentKey,stateData} from '../src/cardano.js';
import {config,commitment,leaf,tree,witness,signals} from '../src/zk-core.js';
import {programFieldId,periodFieldId} from '../src/reward-status.js';
import {validateJob,validateSponsoredProof,jobFingerprint,checkedReceipt,assertRelayBudget,journalSignedTransaction,submitJournaledTransaction} from '../src/sponsor-relay-core.js';

test.after(async()=>{await globalThis.curve_bls12381?.terminate();});

const receiver=generateEmulatorAccount({lovelace:0n});
function fixture(){
 const secret='45678',c={...config,program:programFieldId('GLP-01'),period:periodFieldId('2026-W44'),domain:'556677'};
 const leaves=Array.from({length:8},(_,i)=>leaf(commitment(String(i+10)),c));leaves[2]=leaf(commitment(secret),c);const path=tree(leaves,2);
 const approval={reportId:'R-12345678',programId:'GLP-01',periodId:'2026-W44',periodLabel:'Week44',commitment:commitment(secret),...path,c};
 const job={id:'job-12345678',reportId:approval.reportId,stage:'fund',approval,recipientAddress:receiver.address};
 return {secret,job,w:witness(secret,path,BigInt('0x'+paymentKey(receiver.address)).toString(),c)};
}
function mockTx(){return {toTransaction:()=>({body:()=>({fee:()=>200000n})}),toHash:()=>'a'.repeat(64),toCBOR:()=>'deadbeef',sign:{withWallet:()=>({complete:async()=>({toHash:()=>'a'.repeat(64),toCBOR:()=>'deadbeef'})})}};}

test('relay validates immutable report approval and recipient before spending',()=>{
 const {job}=fixture();assert.ok(validateJob(job));assert.equal(jobFingerprint(job),jobFingerprint({...job,state:'funding'}));
 const changed={...job,recipientAddress:generateEmulatorAccount({lovelace:0n}).address};assert.notEqual(jobFingerprint(job),jobFingerprint(changed));
 assert.throws(()=>validateJob({...job,approval:{...job.approval,reportId:'R-999'}}),/does not match/);
 assert.throws(()=>validateJob({...job,recipientAddress:'addr1notpreprod'}));
});

test('the sponsor never signs beyond its job or test-ADA budget',()=>{
 const journal={jobs:{a:{fund:{feeLovelace:'200000'}}}};
 assert.throws(()=>assertRelayBudget(journal,{kind:'fund',maxJobs:1}),/job budget/);
 assert.throws(()=>assertRelayBudget(journal,{kind:'fund',maxSpendLovelace:40000000n,feeLovelace:200000n}),/spending budget/);
 assert.equal(assertRelayBudget(journal,{kind:'claim',feeLovelace:200000n}).funded,1);
});

test('signed bytes are persisted before any submission and reused for an ambiguous retry',async()=>{
 const journal={jobs:{job:{}}},order=[];
 const entry=await journalSignedTransaction({journal,jobId:'job',kind:'fund',tx:mockTx(),persist:async()=>order.push('persist')});
 assert.equal(entry.cbor,'deadbeef');assert.deepEqual(order,['persist']);
 const seen=[];
 await assert.rejects(()=>submitJournaledTransaction(entry,{persist:async()=>order.push('persist'),beforeBroadcast:async()=>order.push('server'),submit:async cbor=>{seen.push(cbor);order.push('broadcast');throw Error('timeout after broadcast');}}),/timeout/);
 assert.equal(entry.status,'prepared');
 await submitJournaledTransaction(entry,{persist:async()=>order.push('persist'),beforeBroadcast:async()=>order.push('server'),submit:async cbor=>{seen.push(cbor);order.push('broadcast');return entry.hash;}});
 assert.deepEqual(seen,['deadbeef','deadbeef']);assert.deepEqual(order,['persist','server','broadcast','server','broadcast','persist']);
 assert.equal(await journalSignedTransaction({journal,jobId:'job',kind:'fund',tx:{},persist:async()=>{throw Error('must not reconstruct');}}),entry);
});

test('failed local journal or server metadata write prevents broadcast',async()=>{
 const journal={jobs:{job:{}}};
 await assert.rejects(()=>journalSignedTransaction({journal,jobId:'job',kind:'fund',tx:mockTx(),persist:async()=>{throw Error('disk unavailable');}}),/disk/);
 assert.equal(journal.jobs.job.fund,undefined);
 const entry={hash:'a'.repeat(64),cbor:'deadbeef',status:'prepared'};let submitted=false;
 await assert.rejects(()=>submitJournaledTransaction(entry,{persist:async()=>{},beforeBroadcast:async()=>{throw Error('server unavailable');},submit:async()=>{submitted=true;}}),/server/);
 assert.equal(submitted,false);
});

test('proof authorization rejects another recipient or report without trusting the queue',async()=>{
 const {job,w}=fixture();job.stage='claim';job.claim={proof:{fixture:true},publicSignals:signals(w)};
 assert.ok(await validateSponsoredProof(job,{},async()=>true));
 await assert.rejects(()=>validateSponsoredProof({...job,recipientAddress:generateEmulatorAccount({lovelace:0n}).address},{},async()=>true),/recipient/);
 await assert.rejects(()=>validateSponsoredProof(job,{},async()=>false),/verification failed/);
});

test('confirmation receipt requires the exact contract transition and recipient',()=>{
 const {job,w}=fixture();job.stage='claim';job.claim={proof:{},publicSignals:signals(w)};
 const dep={address:'addr_test1pool',unit:'b'.repeat(56)+'1234',seed:{txHash:'c'.repeat(64),outputIndex:0}},txHash='d'.repeat(64),nullifier=job.claim.publicSignals[1];
 const asset_list=[{policy_id:'b'.repeat(56),asset_name:'1234',quantity:'1'}];
 const before={...job.approval.c,root:job.approval.root,used:[]},after={...before,used:[nullifier]};
 const info={tx_hash:txHash,block_height:123,inputs:[{tx_hash:'e'.repeat(64),tx_index:0,payment_addr:{bech32:dep.address},value:'20000000',asset_list,inline_datum:{bytes:stateData(before)}}],outputs:[{payment_addr:{bech32:dep.address},value:'18000000',asset_list,inline_datum:{bytes:stateData(after)}},{payment_addr:{bech32:job.recipientAddress,cred:paymentKey(job.recipientAddress)},value:'2000000',asset_list:[]}],plutus_contracts:[{address:dep.address,valid_contract:true,spends_input:{tx_hash:'e'.repeat(64),tx_index:0},input:{redeemer:{purpose:'spend',datum:{value:{constructor:1,fields:[{}, {}, {bytes:paymentKey(job.recipientAddress)}]}}}}}]};
 const receipt=checkedReceipt('claim',txHash,info,dep,job);assert.equal(receipt.verified,true);assert.equal(receipt.poolRemainingLovelace,'18000000');assert.equal(receipt.nullifier,nullifier);
 const wrong=structuredClone(info);wrong.outputs[1].value='1000000';assert.throws(()=>checkedReceipt('claim',txHash,wrong,dep,job),/does not match/);
});

test('real Plutus claim: sponsor pays fees, unfunded participant receives exactly 2 test ADA',async()=>{
 const sponsor=generateEmulatorAccount({lovelace:100000000n}),em=new Emulator([sponsor]),l=await Lucid(em,'Preprod');l.selectWallet.fromSeed(sponsor.seedPhrase);
 const blueprint=JSON.parse(await readFile('contracts/plutus.json')),vk=JSON.parse(await readFile('public/zk/verification_key.json'));
 const {job,w}=fixture();assert.equal((await l.utxosAt(job.recipientAddress)).length,0);
 const {tx,dep}=await preparePool(l,blueprint,vk,{...job.approval.c,root:job.approval.root});await (await tx.sign.withWallet().complete()).submit();em.awaitBlock();
 job.stage='claim';job.claim=await groth16.fullProve(w,'public/zk/reward.wasm','public/zk/reward.zkey',null,{}, {singleThread:true});
 await validateSponsoredProof(job,vk,(...args)=>groth16.verify(...args));
 const claim=await prepareClaim(l,dep,job.claim,job.recipientAddress);await (await claim.sign.withWallet().complete()).submit();em.awaitBlock();
 assert.equal((await l.utxosAt(job.recipientAddress)).reduce((sum,u)=>sum+u.assets.lovelace,0n),2000000n);
 const pool=await readPool(l,dep);assert.equal(pool.utxo.assets.lovelace,18000000n);assert.deepEqual(pool.state.used,[job.claim.publicSignals[1]]);
 await assert.rejects(()=>prepareClaim(l,dep,job.claim,job.recipientAddress),/Already claimed/);
});
