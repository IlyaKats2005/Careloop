import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sellerTokenNet,verifySettlement} from './settlement.mjs';
test('seller change does not inflate token receipt',()=>{
 const amount=quantity=>[{unit:'token',quantity}];
 assert.equal(sellerTokenNet({inputs:[{address:'seller',amount:amount('100')}],outputs:[{address:'seller',amount:amount('101')},{address:'buyer',amount:amount('99')}]},'seller','token'),1n);
});
for(const [name,received,verified] of [
 ['partial payment of 500000 atomic units is not settled',500000n,false],
 ['full payment of 1000000 atomic units is settled',1000000n,true],
 ['zero token payment is not settled',0n,false],
]){
 test(name,async t=>{
  const txHash='a'.repeat(64);
  const blockchainIdentifier='fixed-demo-payment';
  const amount=quantity=>[{unit:'test-usdm',quantity:quantity.toString()}];
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({
   inputs:[{address:'seller',amount:amount(2000000n)}],
   outputs:[{address:'seller',amount:amount(2000000n+received)}],
  })}));
  const evidence=await verifySettlement({
   core:{get:async()=>({data:{settled:true,txHash,blockchainIdentifier}})},
   taskId:'demo-task',
   payment:{blockchainIdentifier,CurrentTransaction:{txHash,status:'Confirmed',newOnChainState:'Withdrawn'}},
   sellerAddress:'seller',unit:'test-usdm',
  });
  assert.equal(evidence.verified,verified);
  assert.equal(evidence.netAtomicUnits,received.toString());
  assert.equal(evidence.expectedAtomicUnits,'1000000');
  assert.equal(Boolean(evidence.reason),!verified);
 });
}
