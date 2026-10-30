import test from 'node:test';
import assert from 'node:assert/strict';
import {bech32} from '@scure/base';
import {createLocalDatabase} from '../scripts/local-db.mjs';
import {sponsorAPI,enqueuePayment,normalizeRecipient,payoutJSON,submitPaymentProof} from '../src/payment-jobs.js';
import {hash} from '../src/zk-core.js';

const TOKEN='test-sponsor-token-with-at-least-thirty-two-characters';
const address=(network=0,type=6)=>bech32.encode(network===0?'addr_test':'addr',bech32.toWords(Uint8Array.from([type*16+network,...Array(type===0?56:28).fill(7)])),120);
const recipient=address();
const approval={root:'11',c:{program:'1',period:'2',amount:'2000000',domain:'3'}};
const dep={network:'Preprod',seed:{txHash:'a'.repeat(64),outputIndex:0},clinic:'b'.repeat(56),address:'addr_test1'+'x'.repeat(55),unit:'c'.repeat(56)};
const dbRun=(DB,sql,...args)=>DB.prepare(sql).bind(...args).run();
const dbFirst=(DB,sql,...args)=>DB.prepare(sql).bind(...args).first();
async function setup(max=4){
 const DB=createLocalDatabase({filename:':memory:'}),env={DB,SPONSOR_RELAY_TOKEN:TOKEN,SPONSOR_MAX_JOBS:String(max)};
 await dbRun(DB,"INSERT INTO care_workspaces (id,mode,created_at) VALUES ('workspace','demo',1)");
 await dbRun(DB,"INSERT INTO care_programs VALUES ('P1','workspace','{}','invite',1,1)");
 await dbRun(DB,"INSERT INTO care_enrollments VALUES ('enrollment','P1','workspace','participant','P-1','123',1)");
 return{DB,env};
}
async function report(DB,index=1){
 const id='R-'+index;
 await dbRun(DB,"INSERT INTO care_reports (id,workspace_id,program_id,enrollment_id,period_id,period_label,program_json,answers_json,quality,clinical,payment,approval_json,recipient_address,created_at,updated_at) VALUES (?,'workspace','P1','enrollment',?,'Period','{}','{}','Complete','Routine','Approved',?,?,1,1)",id,String(index),JSON.stringify(approval),recipient);
 return dbFirst(DB,'SELECT * FROM care_reports WHERE id=?',id);
}
async function call(env,path,body={},token=TOKEN,method='POST'){
 const response=await sponsorAPI(new Request('https://careloop.test/api/sponsor/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}),env);
 return{status:response.status,body:await response.json()};
}
const proof=()=>{
 const key=BigInt('0x'+normalizeRecipient(recipient).paymentKey).toString(),nullifier='77';
 return{publicSignals:['11',nullifier,'1','2','2000000',key,'3',hash(nullifier,key).toString()],proof:{protocol:'groth16',curve:'bls12381',pi_a:['1','2','1'],pi_b:[['1','2'],['3','4'],['1','0']],pi_c:['1','2','1']}};
};
const receipt=(hash,kind='fund')=>({verified:true,network:'Preprod',txHash:hash,blockHeight:123,...(kind==='claim'?{recipientAddress:recipient,amount:'2000000',nullifier:'77'}:{})});

test('recipient validation rejects mainnet, malformed and script addresses',()=>{
 assert.equal(normalizeRecipient(''),null);
 assert.equal(normalizeRecipient(recipient).paymentKey,'07'.repeat(28));
 assert.equal(normalizeRecipient(address(0,0)).address,address(0,0));
 for(const bad of [address(1),address(0,7),recipient.slice(0,-1)+'q',' '+recipient,recipient.toUpperCase()])assert.throws(()=>normalizeRecipient(bad));
});

test('queue is report-idempotent and bounds concurrent allocation to sponsor budget',async()=>{
 const {DB,env}=await setup(1);try{
  const [a,b]=await Promise.all([report(DB,1),report(DB,2)]);
  const results=await Promise.allSettled([enqueuePayment(DB,env,a),enqueuePayment(DB,env,b)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const saved=results.find(r=>r.status==='fulfilled').value;
  assert.equal((await enqueuePayment(DB,env,saved.report_id===a.id?a:b)).id,saved.id);
  assert.equal((await dbFirst(DB,'SELECT count(*) AS n FROM care_payment_jobs')).n,1);
  const status=await call(env,'status',{},'', 'GET');assert.equal(status.body.remainingBudget,0);assert.equal(status.body.online,false);
  assert.ok(!JSON.stringify(status.body).includes(TOKEN));
 }finally{DB.close();}
});

test('only authenticated relay may lease and update, and heartbeat expires',async()=>{
 const {DB,env}=await setup();try{
  await enqueuePayment(DB,env,await report(DB));
  assert.equal((await call(env,'lease',{workerId:'one'},'incorrect')).status,401);
  assert.equal((await call(env,'heartbeat')).status,200);
  assert.equal((await call(env,'status',{},'', 'GET')).body.online,true);
  await dbRun(DB,"UPDATE care_sponsor_relay SET last_seen=1 WHERE id='relay'");
  assert.equal((await call(env,'status',{},'', 'GET')).body.online,false);
  const [one,two]=await Promise.all([call(env,'lease',{workerId:'one'}),call(env,'lease',{workerId:'two'})]);
  assert.equal([one,two].filter(r=>r.body.job).length,1);
  const leased=one.body.job?one:two,worker=one.body.job?'one':'two';
  const next=await call(env,'lease',{workerId:worker});assert.equal(next.body.leaseToken,leased.body.leaseToken);
  const invalid=await call(env,'jobs/'+leased.body.job.id+'/update',{leaseToken:'wrong',state:'funding',txHash:'d'.repeat(64),dep});assert.equal(invalid.status,409);
  assert.ok(!JSON.stringify(leased.body.job).includes('answers'));
 }finally{DB.close();}
});

test('funding hash is durable before broadcast and expired lease never creates another job',async()=>{
 const {DB,env}=await setup();try{
  const r=await report(DB),job=await enqueuePayment(DB,env,r),leased=(await call(env,'lease',{workerId:'one'})).body;
  const funding=await call(env,'jobs/'+job.id+'/update',{leaseToken:leased.leaseToken,state:'funding',txHash:'d'.repeat(64),dep});assert.equal(funding.status,200);
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:leased.leaseToken,state:'funding',txHash:'e'.repeat(64),dep})).status,409);
  await dbRun(DB,'UPDATE care_payment_jobs SET lease_expires_at=1 WHERE id=?',job.id);
  const recovered=(await call(env,'lease',{workerId:'two'})).body;
  assert.equal(recovered.job.id,job.id);assert.equal(recovered.job.fundTxHash,'d'.repeat(64));assert.notEqual(recovered.leaseToken,leased.leaseToken);
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:leased.leaseToken,state:'awaiting_proof',receipt:receipt('d'.repeat(64))})).status,409);
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:recovered.leaseToken,state:'awaiting_proof'})).status,400);
  const update={leaseToken:recovered.leaseToken,state:'awaiting_proof',receipt:receipt('d'.repeat(64))};
  assert.equal((await call(env,'jobs/'+job.id+'/update',update)).status,200);
  assert.equal((await call(env,'jobs/'+job.id+'/update',update)).status,200);
  assert.equal((await enqueuePayment(DB,env,r)).id,job.id);
 }finally{DB.close();}
});

test('proof is bound to report and recipient; only verified relay receipt records payment',async()=>{
 const {DB,env}=await setup();try{
  const r=await report(DB),job=await enqueuePayment(DB,env,r),leased=(await call(env,'lease',{workerId:'one'})).body;
  await assert.rejects(submitPaymentProof(DB,r,proof()),/confirmation/);
  await call(env,'jobs/'+job.id+'/update',{leaseToken:leased.leaseToken,state:'funding',txHash:'d'.repeat(64),dep});
  await call(env,'jobs/'+job.id+'/update',{leaseToken:leased.leaseToken,state:'awaiting_proof',receipt:receipt('d'.repeat(64))});
  const wrong=proof();wrong.publicSignals[4]='4000000';await assert.rejects(submitPaymentProof(DB,r,wrong),/does not match/);
  const valid=proof();const queued=await submitPaymentProof(DB,r,valid);assert.equal(queued.state,'claim_queued');assert.equal((await submitPaymentProof(DB,r,valid)).id,job.id);
  const different=proof();different.proof.pi_a[0]='5';await assert.rejects(submitPaymentProof(DB,r,different),/different proof/);
  const claimLease=(await call(env,'lease',{workerId:'one'})).body;assert.equal(claimLease.job.stage,'claim');
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:claimLease.leaseToken,state:'confirmed',receipt:receipt('e'.repeat(64),'claim')})).status,409);
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:claimLease.leaseToken,state:'submitted',txHash:'e'.repeat(64)})).status,200);
  assert.equal((await call(env,'jobs/'+job.id+'/update',{leaseToken:claimLease.leaseToken,state:'confirmed',receipt:{...receipt('e'.repeat(64),'claim'),recipientAddress:address(0,0)}})).status,400);
  const done=await call(env,'jobs/'+job.id+'/update',{leaseToken:claimLease.leaseToken,state:'confirmed',receipt:receipt('e'.repeat(64),'claim')});assert.equal(done.status,200);
  const saved=await dbFirst(DB,'SELECT * FROM care_payment_jobs WHERE id=?',job.id),out=payoutJSON(saved);
  assert.equal(out.state,'confirmed');assert.equal(out.receipt.nullifier,'77');assert.equal(out.receipt.verification,'sponsor-relay');assert.equal(out.lease_token,undefined);
  const reportAfter=await dbFirst(DB,'SELECT chain_json FROM care_reports WHERE id=?',r.id);assert.equal(JSON.parse(reportAfter.chain_json).claim.verified,true);
 }finally{DB.close();}
});
