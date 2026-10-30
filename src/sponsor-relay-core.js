import {createHash} from 'node:crypto';
import {cloudRewardApproval,publicRewardDeployment,verifyRewardTransaction} from './reward-status.js';
import {deployment,paymentKey,decodeState,transactionSummary} from './cardano.js';
import {field} from './zk-core.js';

export const POOL_LOVELACE=20000000n;
export const REWARD_LOVELACE=2000000n;

export function validateJob(job){
 if(!job||!/^[-a-zA-Z0-9]{1,100}$/.test(job.id||'')||!/^R-[a-f0-9-]+$/.test(job.reportId||'')||!['fund','claim'].includes(job.stage))throw Error('Invalid sponsored payment job.');
 const a=job.approval;
 const approval=cloudRewardApproval({id:job.reportId,programId:a?.programId,periodId:a?.periodId,period:a?.periodLabel,rewardApproval:a});
 if(!approval)throw Error('Sponsored payment requires an approval.');
 const recipient=paymentKey(job.recipientAddress);
 return {approval,recipient};
}

export function jobFingerprint(job){
 const {approval}=validateJob(job);
 return createHash('sha256').update(JSON.stringify({id:job.id,reportId:job.reportId,approval,recipientAddress:job.recipientAddress})).digest('hex');
}

export function checkedDeployment(raw,blueprint,vk){
 const input=publicRewardDeployment(raw),dep=deployment(blueprint,vk,input.seed,input.clinic);
 if(input.address!==dep.address||input.unit!==dep.unit)throw Error('Sponsor pool metadata does not match the compiled validator.');
 return dep;
}

export async function validateSponsoredProof(job,vk,verify){
 const {approval,recipient}=validateJob(job),claim=job.claim;
 if(!claim||!Array.isArray(claim.publicSignals)||claim.publicSignals.length!==8||!claim.proof||JSON.stringify(claim).length>20000)throw Error('A bounded Groth16 claim is required.');
 const p=claim.publicSignals;
 if(p.some(s=>typeof s!=='string'||!/^(0|[1-9]\d{0,76})$/.test(s)||field(s).toString()!==s))throw Error('Noncanonical public claim.');
 for(const [i,value] of [[0,approval.root],[2,approval.c.program],[3,approval.c.period],[4,'2000000'],[5,BigInt('0x'+recipient).toString()],[6,approval.c.domain]])if(p[i]!==value)throw Error('The proof does not match this report and recipient.');
 if(!await verify(vk,p,claim.proof))throw Error('Groth16 proof verification failed.');
 return claim;
}

export function checkedReceipt(kind,txHash,info,dep,job){
 const {approval}=validateJob(job);
 const bound=kind==='claim'?{...approval,nullifier:job.claim?.publicSignals?.[1]}:approval;
 const evidence=verifyRewardTransaction(kind,txHash,info,dep,bound,decodeState);
 if(!evidence)throw Error('The confirmed transaction does not match this reward contract.');
 if(kind==='claim'&&evidence.recipientAddress!==job.recipientAddress)throw Error('The confirmed payout went to a different recipient address.');
 const poolOutput=info.outputs.find(o=>o.payment_addr?.bech32===dep.address&&(o.asset_list||[]).some(a=>a.policy_id+(a.asset_name||'')===dep.unit&&a.quantity==='1'));
 return {kind,network:'Preprod',txHash,recipientAddress:job.recipientAddress,amount:'2000000',amountLovelace:'2000000',poolRemainingLovelace:String(poolOutput.value),...(evidence.nullifier?{nullifier:evidence.nullifier}:{}),verified:true,blockHeight:info.block_height,verifiedAt:new Date().toISOString()};
}

export function assertRelayBudget(journal,{maxJobs=4,maxSpendLovelace=100000000n,kind,feeLovelace=0n}={}){
 const entries=Object.values(journal.jobs||{});
 const funded=entries.filter(j=>j.fund).length;
 if(kind==='fund'&&funded>=maxJobs)throw Error('Sponsor demo job budget exhausted.');
 let committed=0n;
 for(const j of entries)for(const k of ['split','fund','claim'])if(j[k])committed+=(k==='fund'?POOL_LOVELACE:0n)+BigInt(j[k].feeLovelace);
 const proposed=(kind==='fund'?POOL_LOVELACE:0n)+BigInt(feeLovelace);
 if(committed+proposed>BigInt(maxSpendLovelace))throw Error('Sponsor demo spending budget exhausted.');
 return {funded,committed:committed.toString()};
}

// Persist the exact signed transaction before making any network call. A retry
// may submit these bytes again, but never construct another payment for a stage.
export async function journalSignedTransaction({journal,jobId,kind,tx,persist,extra={},maxJobs=4,maxSpendLovelace=100000000n}){
 const record=journal.jobs[jobId];if(!record)throw Error('Job journal is missing.');
 if(record[kind])return record[kind];
 if(!['split','fund','claim'].includes(kind))throw Error('Unknown sponsor stage.');
 const summary=transactionSummary(tx),feeLovelace=BigInt(Math.round(summary.fee*1000000));
 if(feeLovelace>5000000n)throw Error('Sponsor transaction fee exceeds the 5 test ADA cap.');
 assertRelayBudget(journal,{kind,feeLovelace,maxJobs,maxSpendLovelace});
 const signed=await tx.sign.withWallet().complete();
 if(signed.toHash()!==summary.hash)throw Error('Signed transaction hash changed.');
 const entry={...extra,hash:summary.hash,cbor:signed.toCBOR(),feeLovelace:feeLovelace.toString(),status:'prepared',createdAt:new Date().toISOString()};
 record[kind]=entry;
 try{await persist();}catch(error){delete record[kind];throw error;}
 return entry;
}

export async function submitJournaledTransaction(record,{submit,persist,beforeBroadcast=async()=>{}}){
 if(!record||!/^[a-f0-9]{64}$/.test(record.hash||'')||!/^[a-f0-9]+$/i.test(record.cbor||''))throw Error('No durable signed transaction is available.');
 if(record.status==='confirmed')return record.hash;
 await beforeBroadcast();
 const hash=await submit(record.cbor);
 if(hash!==record.hash)throw Error('The provider returned an unexpected transaction ID.');
 record.status='submitted';record.submittedAt=new Date().toISOString();await persist();return hash;
}
