import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDatabase} from '../scripts/local-db.mjs';
import {demoFunding,allocateDemoFunding,reserveDemoCharge,settleDemoCharge} from '../src/demo-funding.js';
const write=(DB,sql,...args)=>DB.prepare(sql).bind(...args).run();
const allocation=(amount,bucket='rewards',action='reserve')=>({clinicId:'careloop-clinic',amount,bucket,action});
async function setup(t){const DB=createLocalDatabase({filename:':memory:'});t.after(()=>DB.close());await write(DB,"INSERT INTO care_workspaces(id,mode,created_at) VALUES('demo','demo',1),('other','demo',1),('account','account',1)");return DB;}
const total=f=>f.available+f.clinic.rewards+f.clinic.ai+f.clinic.rewardPending+f.clinic.aiPending+f.clinic.rewardSpent+f.clinic.aiSpent;
test('initial allocations are isolated per demo and account funds are not fabricated',async t=>{
 const DB=await setup(t),start=await demoFunding(DB,'demo');assert.equal(start.available,750);assert.equal(start.clinic.rewards,200);assert.equal(start.clinic.ai,50);assert.equal(total(start),1000);
 await allocateDemoFunding(DB,'demo',allocation(100));assert.equal((await demoFunding(DB,'other')).available,750);assert.equal(await demoFunding(DB,'account'),null);
});
test('concurrent sponsor allocations cannot overcommit the starting balance',async t=>{
 const DB=await setup(t);await demoFunding(DB,'demo');
 const results=await Promise.allSettled([allocateDemoFunding(DB,'demo',allocation(500)),allocateDemoFunding(DB,'demo',allocation(500,'ai'))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const f=await demoFunding(DB,'demo');assert.equal(f.available,250);assert.equal(total(f),1000);
 for(const amount of [0,-1,1.5,NaN,1001,'20'])await assert.rejects(allocateDemoFunding(DB,'demo',allocation(amount)),/whole amount/);
});
test('only unused credits can be released and successful charges settle exactly once',async t=>{
 const DB=await setup(t),report={id:'R-demo',workspace_id:'demo'};
 await Promise.all([reserveDemoCharge(DB,report,'rewards'),reserveDemoCharge(DB,report,'rewards')]);
 let f=await demoFunding(DB,'demo');assert.equal(f.clinic.rewards,198);assert.equal(f.clinic.rewardPending,2);
 await assert.rejects(allocateDemoFunding(DB,'demo',allocation(200,'rewards','release')),/Only unused/);
 await allocateDemoFunding(DB,'demo',allocation(198,'rewards','release'));
 await Promise.all([settleDemoCharge(DB,report,'rewards'),settleDemoCharge(DB,report,'rewards')]);
 f=await demoFunding(DB,'demo');assert.equal(f.clinic.rewardSpent,2);assert.equal(f.clinic.rewardPending,0);assert.equal(f.clinic.rewards,0);assert.equal(total(f),1000);
 await assert.rejects(reserveDemoCharge(DB,{...report,id:'R-next'},'rewards'),/reward budget is empty/);
});
test('failed AI calls return their credit; retries never double-charge',async t=>{
 const DB=await setup(t),report={id:'R-ai',workspace_id:'demo'};
 await reserveDemoCharge(DB,report,'ai');assert.equal((await demoFunding(DB,'demo')).clinic.ai,49);
 await settleDemoCharge(DB,report,'ai',false);await settleDemoCharge(DB,report,'ai',false);assert.equal((await demoFunding(DB,'demo')).clinic.ai,50);
 await reserveDemoCharge(DB,report,'ai');await settleDemoCharge(DB,report,'ai');await reserveDemoCharge(DB,report,'ai');await settleDemoCharge(DB,report,'ai');
 const f=await demoFunding(DB,'demo');assert.equal(f.clinic.ai,49);assert.equal(f.clinic.aiSpent,1);assert.equal(total(f),1000);
});
