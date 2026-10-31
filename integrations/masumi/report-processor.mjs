import {inputHash,resultHash} from './standard-hash.mjs';
import {USDM} from './paid-task.mjs';
const minute=60000;
export const inspection=message=>Object.assign(new Error(message),{code:'INSPECTION_REQUIRED'});
export function confirmedTransaction(payment,state){return [payment.CurrentTransaction,...(payment.TransactionHistory||[])].find(t=>t?.status==='Confirmed'&&t.newOnChainState===state&&/^[a-f0-9]{64}$/.test(t.txHash));}
export function checkQuote(payment,job,seller,registration){
 if(payment.inputHash!==job.inputHash||payment.agentIdentifier!==registration.agentIdentifier||payment.SmartContractWallet?.id!==seller.walletId||payment.PaymentSource?.network!=='Preprod'||payment.PaymentSource?.paymentSourceType!=='Web3CardanoV2'||payment.RequestedFunds?.length!==1||payment.RequestedFunds[0].unit!==USDM||payment.RequestedFunds[0].amount!=='1000000')throw inspection('The Masumi quote does not match this report, seller and fixed price.');
}
export function createReportProcessor({mps,analyze,verifyTransaction,verifySeller,load,save,post,registration,seller,clock=Date.now}){
 return async function advance(job){
  if(inputHash(job.inputData,job.nonce)!==job.inputHash)throw inspection('The queued report does not match its input hash.');
  let record=await load(job.id);
  if(record&&(record.inputHash!==job.inputHash||record.nonce!==job.nonce||record.reportId!==job.reportId))throw inspection('The immutable paid job changed.');
  if(!record){
   if(job.blockchainIdentifier||job.state!=='queued')throw inspection('Restore this paid job’s journal before continuing. No replacement purchase was made.');
   record={id:job.id,reportId:job.reportId,inputHash:job.inputHash,nonce:job.nonce,phase:'new'};await save(record);
  }
  const publish=async(state,extra={})=>post(job.id,{state,inputHash:job.inputHash,jobId:job.id,...record.public,...extra});
  if(record.phase==='create-pending')throw inspection('Payment creation had an uncertain outcome. Inspect the existing MPS payment before retrying.');
  if(record.phase==='new'){
   if(registration.registrationState!=='RegistrationConfirmed'&&registration.registration?.state!=='RegistrationConfirmed')throw inspection('The AI service registration is not confirmed.');
   const time=clock();record.phase='create-pending';await save(record);
   const payment=await mps('/payment',{network:'Preprod',paymentSourceType:'Web3CardanoV2',supportedPaymentSourceIndex:registration.supportedPaymentSourceIndex,inputHash:job.inputHash,agentIdentifier:registration.agentIdentifier,identifierFromPurchaser:job.nonce,RequestedFunds:[{unit:USDM,amount:'1000000'}],payByTime:new Date(time+10*minute).toISOString(),submitResultTime:new Date(time+20*minute).toISOString(),unlockTime:new Date(time+36*minute).toISOString(),externalDisputeUnlockTime:new Date(time+52*minute).toISOString()});
   record.public={blockchainIdentifier:payment.blockchainIdentifier,agentIdentifier:registration.agentIdentifier,sellerAddress:seller.sellerAddress};record.phase='quoted';await save(record);
  }
  const payment=await mps('/payment/resolve-blockchain-identifier',{network:'Preprod',blockchainIdentifier:record.public.blockchainIdentifier,includeHistory:'true'});
  checkQuote(payment,job,seller,registration);
  if(record.phase==='purchase-pending')throw inspection('Purchase outcome is uncertain. Preserve this payment and inspect MPS; another purchase is forbidden.');
  if(record.phase==='quoted'){
   if(Number(payment.payByTime)<=clock()+60000)throw inspection('The saved payment quote expired. No replacement job was purchased.');
   const payload={network:'Preprod',paymentSourceType:'Web3CardanoV2',smartContractAddress:payment.PaymentSource.smartContractAddress,blockchainIdentifier:payment.blockchainIdentifier,agentIdentifier:payment.agentIdentifier,inputHash:payment.inputHash,sellerVkey:seller.sellerVkey,supportedPaymentSourceIndex:registration.supportedPaymentSourceIndex,identifierFromPurchaser:job.nonce,Amounts:payment.RequestedFunds.map(({unit,amount})=>({unit,amount})),payByTime:payment.payByTime,submitResultTime:payment.submitResultTime,unlockTime:payment.unlockTime,externalDisputeUnlockTime:payment.externalDisputeUnlockTime,paymentForceLayer:payment.forceLayer};
   if(payment.sellerReturnAddress!==null)payload.sellerReturnAddress=payment.sellerReturnAddress;
   record.phase='purchase-pending';await save(record);
   const purchase=await mps('/purchase',payload,true);record.purchaseId=purchase.id;record.phase='purchased';await save(record);
   return publish('escrow_pending');
  }
  const funding=confirmedTransaction(payment,'FundsLocked');
  if(!record.public.fundingTxHash){
   if(!funding)return publish('escrow_pending');
   await verifyTransaction(funding.txHash);record.public.fundingTxHash=funding.txHash;record.phase='funded';await save(record);
   return publish('funded');
  }
  if(record.phase==='model-pending')throw inspection('The AI call stopped before a saved result. Inspect the paid job; no new purchase was made.');
  if(record.phase==='funded'){
   if(Number(payment.submitResultTime)<=clock()+120000)throw inspection('The paid job has insufficient time left to produce a result.');
   record.phase='model-pending';await save(record);await publish('running',{keepLease:true});
   record.resultText=await analyze(job.inputData.prompt,job.id,Number(payment.submitResultTime));record.public.resultHash=resultHash(record.resultText,job.nonce);record.phase='model-done';await save(record);
  }
  if(record.phase==='submit-pending'){
   if(payment.resultHash===record.public.resultHash){record.phase='awaiting-result';await save(record);}
   else throw inspection('Result submission outcome is uncertain. Inspect MPS before retrying the same hash.');
  }
  if(record.phase==='model-done'){
   if(Number(payment.submitResultTime)<=clock())throw inspection('The result deadline expired. The saved payment is preserved.');
   record.phase='submit-pending';await save(record);
   await mps('/payment/submit-result',{network:'Preprod',blockchainIdentifier:payment.blockchainIdentifier,submitResultHash:record.public.resultHash});
   record.phase='awaiting-result';await save(record);return publish('result_submitted');
  }
  const result=confirmedTransaction(payment,'ResultSubmitted');
  if(!record.public.resultTxHash){
   if(!result||payment.resultHash!==record.public.resultHash)return publish('result_submitted');
   await verifyTransaction(result.txHash);record.public.resultTxHash=result.txHash;record.phase='result-ready';await save(record);
  }
  const withdrawal=confirmedTransaction(payment,'Withdrawn')||confirmedTransaction(payment,'DisputedWithdrawn');
  if(!withdrawal)return publish('result_ready',{resultText:record.resultText});
  const receipt=await verifySeller(withdrawal.txHash,seller.sellerAddress,USDM);
  record.public.settlementTxHash=withdrawal.txHash;record.receipt=receipt;record.phase='settled';await save(record);
  return publish('settled',{resultText:record.resultText,receipt});
 };
}
