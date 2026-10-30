import {Lucid,Koios,Data,Constr,applyParamsToScript,mintingPolicyToId,validatorToAddress,getAddressDetails} from '@lucid-evolution/lucid';
import {bls12_381 as bls} from '@noble/curves/bls12-381';
import {field} from './zk-core.js';
import {NETWORK,NETWORK_ID} from './network.js';
export {Lucid,Koios,Data,Constr};
export {NETWORK,NETWORK_ID,NETWORK_MAGIC,KOIOS,EXPLORER} from './network.js';
export const NAME='436172656c6f6f70';
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const g1=p=>hex(bls.G1.ProjectivePoint.fromAffine({x:BigInt(p[0]),y:BigInt(p[1])}).toRawBytes(true));
const g2=p=>hex(bls.G2.ProjectivePoint.fromAffine({x:{c0:BigInt(p[0][0]),c1:BigInt(p[0][1])},y:{c0:BigInt(p[1][0]),c1:BigInt(p[1][1])}}).toRawBytes(true));
export function keyData(vk){return new Constr(0,[g1(vk.vk_alpha_1),g2(vk.vk_beta_2),g2(vk.vk_gamma_2),g2(vk.vk_delta_2),vk.IC.map(g1)]);}
export function stateData(s){return Data.to(new Constr(0,[...['root','program','period','amount','domain'].map(k=>field(s[k])),s.used.map(field)]));}
export function decodeState(datum){const d=Data.from(datum);if(!(d instanceof Constr)||d.index!==0||d.fields.length!==6)throw Error('Invalid pool datum');const [root,program,period,amount,domain,used]=d.fields;return {root:String(field(root)),program:String(field(program)),period:String(field(period)),amount:String(field(amount)),domain:String(field(domain)),used:used.map(n=>String(field(n)))};}
export function paymentKey(address){const d=getAddressDetails(address);if(d.networkId!==NETWORK_ID||d.paymentCredential?.type!=='Key')throw Error('Connect a Preprod testnet wallet with a payment key.');return d.paymentCredential.hash;}
// CIP-30 networkId=0 is shared by Preview and Preprod. Check the actual outputs
// against the fixed target provider before building or signing a transaction.
export async function assertWalletOnTargetNetwork(lucid){
 if(lucid.config().network!==NETWORK)throw Error('Transaction builder must use Cardano Preprod.');
 const utxos=await lucid.wallet().getUtxos();
 if(!utxos.length)throw Error('No wallet UTxOs found. Fund this wallet with Preprod test ADA and wait for synchronization.');
 const found=await lucid.utxosByOutRef(utxos.map(({txHash,outputIndex})=>({txHash,outputIndex})));
 const refs=new Set(found.map(u=>u.txHash+':'+u.outputIndex+':'+u.address));
 if(utxos.some(u=>!refs.has(u.txHash+':'+u.outputIndex+':'+u.address)))throw Error('Wallet UTxOs are unavailable on Cardano Preprod. Switch the wallet to Preprod and wait for synchronization. Preview balances cannot be used here.');
 return utxos;
}
export function deployment(blueprint,vk,seed,clinic){
 if(!/^[0-9a-f]{64}$/.test(seed.txHash)||!Number.isSafeInteger(seed.outputIndex)||seed.outputIndex<0||!/^[0-9a-f]{56}$/.test(clinic))throw Error('Invalid deployment identity');
 const code=title=>{const v=blueprint.validators.find(v=>v.title===title);if(!v)throw Error('Missing validator');return v.compiledCode;};
 const policy={type:'PlutusV3',script:applyParamsToScript(code('identity.identity.mint'),[new Constr(0,[seed.txHash,BigInt(seed.outputIndex)]),clinic])};
 const policyId=mintingPolicyToId(policy),unit=policyId+NAME;
 const validator={type:'PlutusV3',script:applyParamsToScript(code('rewards.rewards.spend'),[clinic,policyId,NAME,keyData(vk)])};
 return {network:NETWORK,seed:{txHash:seed.txHash,outputIndex:seed.outputIndex},clinic,policy,validator,unit,address:validatorToAddress(NETWORK,validator)};
}
export async function preparePool(lucid,blueprint,vk,state){
 const address=await lucid.wallet().address(),clinic=paymentKey(address);
 const candidates=await assertWalletOnTargetNetwork(lucid);const seed=candidates.find(u=>Object.keys(u.assets).length===1&&u.assets.lovelace>=25000000n);
 if(!seed)throw Error('Funding requires a pure-ADA wallet UTxO of at least 25 test ADA, plus separate collateral. Get test ADA from the faucet and split it in your wallet.');
 const dep=deployment(blueprint,vk,seed,clinic);
 const tx=await lucid.newTx().collectFrom([seed]).mintAssets({[dep.unit]:1n},Data.void()).attach.MintingPolicy(dep.policy).addSignerKey(clinic)
 .pay.ToContract(dep.address,{kind:'inline',value:stateData({...state,used:[]})},{lovelace:20000000n,[dep.unit]:1n}).complete();
 return {tx,dep};
}
export async function readPool(lucid,dep){if(dep.network!==NETWORK)throw Error('This pool is not configured for Cardano Preprod.');const us=await lucid.utxosAtWithUnit(dep.address,dep.unit);if(us.length!==1||!us[0].datum)throw Error('Pool not found or not yet confirmed on Preprod. Wait, then refresh.');return {utxo:us[0],state:decodeState(us[0].datum)};}
export async function prepareClaim(lucid,dep,claim,recipientAddress){
 await assertWalletOnTargetNetwork(lucid);
 const recipient=paymentKey(recipientAddress),p=claim.publicSignals;p.forEach(field);
 if(p.length!==8||BigInt('0x'+recipient)!==BigInt(p[5]))throw Error('Proof does not belong to this wallet. Regenerate the proof after connecting.');
 const {utxo,state:s}=await readPool(lucid,dep);
 for(const [i,k] of [[0,'root'],[2,'program'],[3,'period'],[4,'amount'],[6,'domain']])if(p[i]!==s[k])throw Error('Proof does not match this on-chain approval.');
 if(s.used.includes(p[1]))throw Error('Already claimed for this period (on-chain nullifier).');
 if(s.used.length>=8||utxo.assets.lovelace-BigInt(s.amount)<4000000n)throw Error('Pool has no remaining reward budget.');
 const proof=new Constr(0,[g1(claim.proof.pi_a),g2(claim.proof.pi_b),g1(claim.proof.pi_c)]);
 const redeemer=Data.to(new Constr(1,[proof,field(p[1]),recipient,field(p[7])]));
 return lucid.newTx().collectFrom([utxo],redeemer).attach.SpendingValidator(dep.validator)
 .pay.ToContract(dep.address,{kind:'inline',value:stateData({...s,used:[p[1],...s.used]})},{...utxo.assets,lovelace:utxo.assets.lovelace-BigInt(s.amount)})
 .pay.ToAddress(recipientAddress,{lovelace:BigInt(s.amount)}).complete();
}
export function transactionSummary(tx){const body=tx.toTransaction().body();return {hash:tx.toHash(),fee:Number(body.fee())/1e6,bytes:tx.toCBOR().length/2};}
