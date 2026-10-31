import test from 'node:test';
import assert from 'node:assert/strict';
import {createReportProcessor} from './report-processor.mjs';
import {inputHash,resultHash} from './standard-hash.mjs';
import {USDM} from './paid-task.mjs';
function fixture(){
 const nonce='12345678901234567890',inputData={prompt:'fixture'},job={id:'job-1',reportId:'report-1',state:'queued',nonce,inputData,inputHash:inputHash(inputData,nonce)};
 const registration={agentIdentifier:'agent',registrationState:'RegistrationConfirmed',supportedPaymentSourceIndex:0},seller={walletId:'wallet',sellerAddress:'seller',sellerVkey:'vkey'};
 let record,analyses=0,purchases=0,creates=0;const events=[],time=1000000;
 const payment={blockchainIdentifier:'payment',inputHash:job.inputHash,agentIdentifier:'agent',SmartContractWallet:{id:'wallet'},PaymentSource:{network:'Preprod',paymentSourceType:'Web3CardanoV2',smartContractAddress:'contract'},RequestedFunds:[{unit:USDM,amount:'1000000'}],payByTime:String(time+600000),submitResultTime:String(time+1200000),unlockTime:String(time+2160000),externalDisputeUnlockTime:String(time+3120000),sellerReturnAddress:null,TransactionHistory:[]};
 const deps={registration,seller,clock:()=>time,load:async()=>record&&structuredClone(record),save:async r=>{record=structuredClone(r)},verifyTransaction:async()=>{},verifySeller:async hash=>({verified:true,txHash:hash,netAtomicUnits:'1000000'}),analyze:async()=>{analyses++;return '{"summary":"result"}'},post:async(id,body)=>{events.push(body);job.state=body.state;Object.assign(job,record.public);return body},mps:async(route,body)=>{if(route==='/payment'){creates++;return payment}if(route==='/purchase'){purchases++;return {id:'purchase'}}if(route==='/payment/submit-result'){payment.resultHash=body.submitResultHash;return {}}return payment}};
 return {job,payment,events,deps,advance:createReportProcessor(deps),get record(){return record},get counts(){return {analyses,purchases,creates}}};
}
test('one website report buys once, waits for chain funding, publishes its paid result, then verifies settlement',async()=>{
 const f=fixture();await f.advance(f.job);assert.equal(f.events.at(-1).state,'escrow_pending');assert.deepEqual(f.counts,{analyses:0,purchases:1,creates:1});
 await f.advance(f.job);assert.deepEqual(f.counts,{analyses:0,purchases:1,creates:1});
 f.payment.TransactionHistory.push({status:'Confirmed',newOnChainState:'FundsLocked',txHash:'a'.repeat(64)});
 await f.advance(f.job);assert.equal(f.events.at(-1).state,'funded');assert.equal(f.counts.analyses,0);
 await f.advance(f.job);assert.equal(f.events.at(-1).state,'result_submitted');assert.equal(f.counts.analyses,1);assert.equal(f.events.find(e=>e.state==='running').keepLease,true);
 await f.advance(f.job);assert.equal(f.events.at(-1).resultText,undefined);
 f.payment.TransactionHistory.push({status:'Confirmed',newOnChainState:'ResultSubmitted',txHash:'b'.repeat(64)});
 await f.advance(f.job);assert.equal(f.events.at(-1).state,'result_ready');assert.equal(resultHash(f.events.at(-1).resultText,f.job.nonce),f.payment.resultHash);
 f.payment.TransactionHistory.push({status:'Confirmed',newOnChainState:'Withdrawn',txHash:'c'.repeat(64)});
 await f.advance(f.job);assert.equal(f.events.at(-1).state,'settled');assert.equal(f.events.at(-1).receipt.txHash,'c'.repeat(64));
 await f.advance(f.job);assert.deepEqual(f.counts,{analyses:1,purchases:1,creates:1});
});
test('uncertain purchase is persisted and cannot trigger a second buy on restart',async()=>{
 const f=fixture();let buys=0;const original=f.deps.mps;
 const advance=createReportProcessor({...f.deps,mps:async(route,...args)=>{if(route==='/purchase'){buys++;throw Error('connection lost')}return original(route,...args)}});
 await assert.rejects(advance(f.job),/connection lost/);assert.equal(f.record.phase,'purchase-pending');
 await assert.rejects(advance(f.job),{code:'INSPECTION_REQUIRED'});assert.equal(buys,1);
});
test('missing payment journal and changed inputs block without replacement transactions',async()=>{
 const f=fixture();await assert.rejects(f.advance({...f.job,state:'escrow_pending',blockchainIdentifier:'existing'}),{code:'INSPECTION_REQUIRED'});
 await assert.rejects(f.advance({...f.job,inputData:{prompt:'changed'}}),{code:'INSPECTION_REQUIRED'});assert.equal(f.counts.purchases,0);
});
test('wrong token, amount, network or seller is rejected before buying',async()=>{
 for(const mutate of [p=>p.RequestedFunds[0].amount='2000000',p=>p.RequestedFunds[0].unit='lovelace',p=>p.PaymentSource.network='Mainnet',p=>p.SmartContractWallet.id='another']){
  const f=fixture();mutate(f.payment);await assert.rejects(f.advance(f.job),{code:'INSPECTION_REQUIRED'});assert.equal(f.counts.purchases,0);
 }
});
test('unconfirmed escrow and mismatching result commitment cannot unlock the report result',async()=>{
 const f=fixture();await f.advance(f.job);f.payment.TransactionHistory.push({status:'Pending',newOnChainState:'FundsLocked',txHash:'a'.repeat(64)});await f.advance(f.job);assert.equal(f.counts.analyses,0);
 f.payment.TransactionHistory[0].status='Confirmed';await f.advance(f.job);await f.advance(f.job);
 f.payment.TransactionHistory.push({status:'Confirmed',newOnChainState:'ResultSubmitted',txHash:'b'.repeat(64)});f.payment.resultHash='wrong';await f.advance(f.job);assert.equal(f.events.at(-1).state,'result_submitted');assert.equal(f.events.at(-1).resultText,undefined);
});
