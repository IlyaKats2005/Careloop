import test from 'node:test';
import assert from 'node:assert/strict';
import {assertWalletOnTargetNetwork} from '../src/cardano.js';
import {assertRecoveryNetwork,NETWORK,NETWORK_ID,NETWORK_MAGIC} from '../src/network.js';
import {api} from '../src/api.js';

const walletOutputs=[
  {txHash:'a'.repeat(64),outputIndex:0,address:'addr_test1_fixture_wallet',assets:{lovelace:30000000n}},
  {txHash:'b'.repeat(64),outputIndex:1,address:'addr_test1_fixture_wallet',assets:{lovelace:5000000n}},
];
function lucidFixture({network='Preprod',wallet=walletOutputs,provider=walletOutputs}={}){
  return {
    config:()=>({network}),
    wallet:()=>({getUtxos:async()=>wallet}),
    utxosByOutRef:async refs=>{
      assert.deepEqual(refs,wallet.map(({txHash,outputIndex})=>({txHash,outputIndex})));
      return provider;
    },
  };
}

test('shared CIP-30 testnet ID is accepted only when every wallet output exists on Preprod',async()=>{
  assert.equal(NETWORK_ID,0);
  const result=await assertWalletOnTargetNetwork(lucidFixture());
  assert.deepEqual(result,walletOutputs);
});

test('Preview transaction builder is rejected despite sharing testnet network ID 0',async()=>{
  await assert.rejects(assertWalletOnTargetNetwork(lucidFixture({network:'Preview'})),/must use Cardano Preprod/);
});

test('wallet outputs absent from Preprod are rejected instead of trusting network ID 0',async()=>{
  await assert.rejects(assertWalletOnTargetNetwork(lucidFixture({provider:[]})),/unavailable on Cardano Preprod.*Preview balances/);
});

test('partial matches and mismatched output references or addresses cannot establish the target network',async t=>{
  const cases={
    'one output missing':[walletOutputs[0]],
    'wrong transaction':[{...walletOutputs[0],txHash:'c'.repeat(64)},walletOutputs[1]],
    'wrong output index':[{...walletOutputs[0],outputIndex:2},walletOutputs[1]],
    'wrong address':[{...walletOutputs[0],address:'addr_test1_another_wallet'},walletOutputs[1]],
  };
  for(const [name,provider] of Object.entries(cases)){
    await t.test(name,async()=>{
      await assert.rejects(assertWalletOnTargetNetwork(lucidFixture({provider})),/unavailable on Cardano Preprod/);
    });
  }
});

test('empty wallet gives Preprod funding instructions before querying output references',async()=>{
  const lucid=lucidFixture({wallet:[]});
  lucid.utxosByOutRef=async()=>assert.fail('An empty wallet cannot establish its network');
  await assert.rejects(assertWalletOnTargetNetwork(lucid),/No wallet UTxOs found.*Fund this wallet with Preprod test ADA/);
});

test('Preprod recovery accepts only an explicit matching network and magic',()=>{
  const saved={network:'Preprod',networkMagic:1,enrollment:'fixture'};
  assert.equal(assertRecoveryNetwork(saved),saved);
  for(const invalid of [
    {network:'Preview',networkMagic:2},
    {network:'Preprod',networkMagic:2},
    {network:'Preprod'},
    {enrollment:'legacy'},
    null,
  ]){
    assert.throws(()=>assertRecoveryNetwork(invalid),/not a Cardano Preprod enrollment.*create a new Preprod enrollment/);
  }
});

test('status API reports the same Preprod target for patient rewards and Masumi without claiming a connection',async()=>{
  const response=await api(new Request('https://careloop.test/api/status'));
  assert.equal(response.status,200);
  const {chain}=await response.json();
  assert.equal(NETWORK,'Preprod');
  assert.equal(NETWORK_MAGIC,1);
  assert.equal(chain.network,NETWORK.toLowerCase());
  assert.equal(chain.masumiNetwork,chain.network);
  assert.equal(chain.networkMagic,NETWORK_MAGIC);
  assert.equal(chain.connected,false);
});
