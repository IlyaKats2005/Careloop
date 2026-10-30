import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {inputHash} from './standard-hash.mjs';
import {USDM} from './paid-task.mjs';
import {sellerTokenNet} from './settlement.mjs';
const path='.local/paid-demo-state.json';
let state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});
async function request(base,path,body,token){
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 const data=await response.json();if(!response.ok)throw Error('HTTP '+response.status+': '+JSON.stringify(data));return data;
}
const mps=async(path,body)=>(await request(process.env.MPS_URL+'/api/v1',path,body,process.env.ADMIN_KEY)).data;
const agent='http://127.0.0.1:'+process.env.AGENT_API_PORT;
if(process.argv[2]==='start'){
 if(state.job){console.log('Existing job',state.job.id);process.exit(0);}
 if(state.phase)throw Error('Inspect previous uncertain start before retry');
 const registration=JSON.parse(readFileSync('docs/registration-state.json'));
 if(registration.registrationState!=='RegistrationConfirmed')throw Error('Registration not confirmed');
 const nonce=randomBytes(10).toString('hex');
 const report={fictional:true,answers:{medication:'semaglutide',status:'Taking as prescribed',dose:'Unchanged; exact dose not supplied',symptoms:{nausea:'None'},hydration:'Yes',notes:'Fictional paid Masumi demo. No new concerns.'}};
 const input_data={prompt:'CARELOOP_REPORT_JSON\n'+JSON.stringify(report)};
 state={phase:'start-pending',nonce,input_data,inputHash:inputHash(input_data,nonce)};save();
 state.job=await request(agent,'/start_job',{identifier_from_purchaser:nonce,input_data});state.phase='quote-saved';save();console.log(JSON.stringify({jobId:state.job.id,inputHash:state.job.input_hash}));
}else if(process.argv[2]==='purchase'){
 if(state.purchase){console.log('Existing purchase',state.purchase.id);process.exit(0);}
 if(state.phase!=='quote-saved')throw Error('Inspect previous operation before retry');
 const p=await mps('/payment/resolve-blockchain-identifier',{network:'Preprod',blockchainIdentifier:state.job.blockchainIdentifier,includeHistory:'true'});
 const seller=JSON.parse(readFileSync('docs/payment-state.json'));
 if(p.inputHash!==state.inputHash||p.SmartContractWallet?.id!==seller.walletId||p.RequestedFunds.length!==1||p.RequestedFunds[0].unit!==USDM||p.RequestedFunds[0].amount!=='1000000')throw Error('Quote mismatch');
 const payload={network:'Preprod',paymentSourceType:'Web3CardanoV2',smartContractAddress:p.PaymentSource.smartContractAddress,blockchainIdentifier:p.blockchainIdentifier,agentIdentifier:p.agentIdentifier,inputHash:p.inputHash,sellerVkey:seller.sellerVkey,supportedPaymentSourceIndex:state.job.supportedPaymentSourceIndex,identifierFromPurchaser:state.nonce,Amounts:p.RequestedFunds.map(({unit,amount})=>({unit,amount})),payByTime:p.payByTime,submitResultTime:p.submitResultTime,unlockTime:p.unlockTime,externalDisputeUnlockTime:p.externalDisputeUnlockTime,paymentForceLayer:p.forceLayer};
 if(p.sellerReturnAddress!==null)payload.sellerReturnAddress=p.sellerReturnAddress;
 state.payment=p;state.purchasePayload=payload;state.phase='purchase-pending';save();
 state.purchase=await mps('/purchase',payload);state.phase='purchased';save();console.log(JSON.stringify({purchaseId:state.purchase.id,state:state.purchase.onChainState,nextAction:state.purchase.NextAction}));
}else{
 if(!state.job)throw Error('No saved job');
 const watch=process.argv.includes('--watch');
 const watchUntil=Date.now()+2*60*60*1000;
 let lastSummary;
 do{
 try{state.jobStatus=await request(agent,'/status?job_id='+state.job.id);state.jobStatusSource='agent-api';}
 catch(error){
  if(error.cause?.code!=='ECONNREFUSED')throw error;
  const savedJob=JSON.parse(readFileSync('.local/standard-jobs/'+state.job.id+'.json','utf8'));
  if(savedJob.id!==state.job.id||savedJob.inputHash!==state.inputHash)throw Error('Saved job identity mismatch');
  state.jobStatus={id:savedJob.id,status:savedJob.status};state.jobStatusSource='saved-job';
 }
 state.payment=await mps('/payment/resolve-blockchain-identifier',{network:'Preprod',blockchainIdentifier:state.job.blockchainIdentifier,includeHistory:'true'});save();
 state.purchaseObserved=await mps('/purchase/resolve-blockchain-identifier',{network:'Preprod',blockchainIdentifier:state.job.blockchainIdentifier,includeHistory:'true'});save();
 const tx=[state.payment.CurrentTransaction,...(state.payment.TransactionHistory||[])].find(t=>t?.status==='Confirmed'&&['Withdrawn','DisputedWithdrawn'].includes(t.newOnChainState));
 if(tx?.txHash&&['Withdrawn','DisputedWithdrawn'].includes(state.payment.onChainState)){
  const seller=JSON.parse(readFileSync('docs/payment-state.json'));
  if(state.payment.inputHash!==state.inputHash||state.payment.SmartContractWallet?.id!==seller.walletId||state.payment.RequestedFunds.length!==1||state.payment.RequestedFunds[0].unit!==USDM||state.payment.RequestedFunds[0].amount!=='1000000')throw Error('Settlement differs from saved payment terms');
  const response=await fetch('https://cardano-preprod.blockfrost.io/api/v0/txs/'+tx.txHash+'/utxos',{headers:{project_id:process.env.BLOCKFROST_API_KEY_PREPROD},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Cannot independently verify settlement HTTP '+response.status);
  const utxos=await response.json();
  if(utxos.hash!==tx.txHash)throw Error('Settlement transaction hash mismatch');
  const net=sellerTokenNet(utxos,seller.sellerAddress,USDM);
  state.receipt={settled:net===1000000n,network:'Preprod',txHash:tx.txHash,expectedTestUsdmAtomic:'1000000',netTestUsdmAtomic:net.toString(),sellerAddress:seller.sellerAddress,blockchainIdentifier:state.payment.blockchainIdentifier,jobId:state.job.id,verifiedAt:new Date().toISOString()};save();
  writeFileSync('.local/paid-demo-receipt.json',JSON.stringify(state.receipt,null,2),{mode:0o600});
  if(!state.receipt.settled)throw Error('Confirmed withdrawal did not pay exactly 1 test USDM to the dedicated seller');
 }
 const summary=JSON.stringify({jobId:state.job.id,jobStatus:state.jobStatus.status,jobStatusSource:state.jobStatusSource,paymentState:state.payment.onChainState,transaction:state.payment.CurrentTransaction,nextAction:state.payment.NextAction,purchaseAction:state.purchaseObserved.NextAction,purchaseTx:state.purchaseObserved.CurrentTransaction,unlockTime:state.payment.unlockTime,receipt:state.receipt});
 if(summary!==lastSummary){console.log(summary);lastSummary=summary;}
 if(!watch||state.receipt?.settled)break;
 if(Date.now()>=watchUntil)throw Error('Receipt check timed out after two hours; inspect payment status before any new purchase');
 await new Promise(resolve=>setTimeout(resolve,30000));
 }while(true);
}
