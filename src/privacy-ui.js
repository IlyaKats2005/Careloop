import {NETWORK,NETWORK_ID,NETWORK_MAGIC,STORAGE_KEY,EXPLORER,assertRecoveryNetwork} from './network.js';
import {commitment,leaf,tree,randomSecret,witness,config,hash,scope} from './zk-core.js';
import {programFieldId,periodFieldId,rewardStatusForReport,cloudRewardApproval,publicRewardDeployment,poolMatchesApproval,verifyRewardTransaction} from './reward-status.js';
let secret=null,approval=null,claim=null,busy=false,log=[],publicClaim=null;
let sdk=null,lucid=null,wallet=null,walletAddress=null,dep=null,pending=null,submitted=null,chainState=null;
let cloudContext=null,transactions={fund:null,claim:null},poolBalance=null,archives=[],lastError=false;
let savedKey=STORAGE_KEY,rewardOwnerId=null,rewardStorageValid=true;
function clearReportState(){approval=null;claim=null;publicClaim=null;dep=null;pending=null;submitted=null;chainState=null;cloudContext=null;transactions={fund:null,claim:null};poolBalance=null;lastError=false;}
function resetRewardState(){clearReportState();secret=null;log=[];sdk=null;lucid=null;wallet=null;walletAddress=null;archives=[];rewardStorageValid=true;delete window.careloopCommitment;}
function restoredTransactions(saved){const records={fund:null,claim:null};for(const kind of ['fund','claim']){const r=saved.transactions?.[kind]||(saved.submitted?.kind===kind?saved.submitted:null);if(r&&/^[0-9a-f]{64}$/i.test(r.hash||''))records[kind]={...r,kind,confirmed:false,chainVerified:false};}return records;}
function selectSubmitted(){submitted=transactions.claim||transactions.fund;}
function restoreSavedReward(){try{const saved=JSON.parse(sessionStorage.getItem(savedKey)||'null');if(!saved)return;assertRecoveryNetwork(saved);if((saved.ownerId??null)!==rewardOwnerId)throw Error('Reward owner mismatch');const restoredCommitment=saved.secret?commitment(saved.secret):null;({secret,approval,dep}=saved);transactions=restoredTransactions(saved);selectSubmitted();cloudContext=saved.cloudContext?{reportId:saved.cloudContext.reportId,programId:saved.cloudContext.programId,canFund:false}:null;archives=Array.isArray(saved.archives)?saved.archives.filter(a=>typeof a.key==='string'&&a.key.startsWith(savedKey+':archive:')):[];if(restoredCommitment)window.careloopCommitment=restoredCommitment;}catch{resetRewardState();rewardStorageValid=false;log.push('Saved reward data could not be restored and has been preserved. Download it before restoring a valid Preprod recovery file.');}}
restoreSavedReward();
const esc=s=>window.careloopEscape(String(s));
const recovery=()=>({network:NETWORK,networkMagic:NETWORK_MAGIC,ownerId:rewardOwnerId,secret,approval,dep,submitted,transactions,cloudContext,archives});
const persist=()=>{if(rewardStorageValid)sessionStorage.setItem(savedKey,JSON.stringify(recovery()));};
window.careloopRewardBusy=()=>busy;
window.careloopSetRewardOwner=(ownerId=null)=>{if(ownerId!==null&&(typeof ownerId!=='string'||!ownerId.trim()||ownerId.length>200||ownerId.trim()!==ownerId))throw Error('Invalid reward account.');if(ownerId===rewardOwnerId)return;if(busy)throw Error('Wait for the current reward action to finish before switching accounts.');persist();resetRewardState();rewardOwnerId=ownerId;savedKey=ownerId===null?STORAGE_KEY:STORAGE_KEY+':account:'+ownerId;restoreSavedReward();window.render?.();};
const say=s=>{log.push(s);window.render();};
async function run(fn){if(busy)return;busy=true;lastError=false;window.render();try{await fn();}catch(e){lastError=true;log.push('Action stopped: '+(e?.message||e?.info||String(e)));}finally{busy=false;persist();window.render();}}
function wallets(){return Object.entries(window.cardano||{}).filter(([,v])=>v&&typeof v.enable==='function').map(([id,w])=>({id,name:w.name||id}));}
function button(label,fn,disabled=false){return `<button class="btn secondary" onclick="${fn}" ${disabled||busy?'disabled':''}>${label}</button>`;}
const canProve=()=>!!secret&&!!approval&&!cloudContext?.canFund&&(!approval.commitment||commitment(secret)===approval.commitment);
const canFund=()=>!!approval&&(!cloudContext||cloudContext.canFund===true);
const signature=(a,c)=>JSON.stringify([a?.reportId??c?.reportId,a?.programId??c?.programId,a?.root,a?.c?.program,a?.c?.period,a?.c?.amount,a?.c?.domain]);
function archiveCurrent(){
 if(!dep&&!submitted)return;
 const key=savedKey+':archive:'+Date.now()+':'+crypto.randomUUID();
 sessionStorage.setItem(key,JSON.stringify(recovery()));
 archives=[...archives,{key,reportId:approval?.reportId??cloudContext?.reportId??null,programId:approval?.programId??cloudContext?.programId??null,poolAddress:dep?.address??null,signature:signature(approval,cloudContext),createdAt:new Date().toISOString()}];
 persist();
 log.push('Previous pool recovery archived in this tab. Its download remains available below.');
}
async function loadDeployment(value){
 if(!value)return null;
 const publicDep=publicRewardDeployment(value);sdk??=await import('/chain/wallet.js');
 const [bp,vk]=await Promise.all(['/zk/plutus.json','/zk/verification_key.json'].map(async url=>{const r=await fetch(url);if(r.ok===false)throw Error('Unable to load trusted contract files.');return r.json();}));
 const rebuilt=sdk.deployment(bp,vk,publicDep.seed,publicDep.clinic);
 if(rebuilt.network!==NETWORK||rebuilt.address!==publicDep.address||rebuilt.unit!==publicDep.unit)throw Error('Cloud pool does not match the trusted Preprod contract.');
 return rebuilt;
}
function cloudRecord(kind,value,a){
 if(!value)return null;if(!/^[0-9a-f]{64}$/i.test(value.txHash||''))throw Error('Invalid cloud transaction ID.');
 return {kind,hash:value.txHash,reportId:a.reportId,programId:a.programId,source:'cloud',confirmed:false,chainVerified:false,...(kind==='claim'&&a.nullifier?{nullifier:a.nullifier}:{})};
}
window.careloopClearCloudReport=()=>{if(busy)throw Error('Wait for the current reward action before changing reports.');archiveCurrent();clearReportState();persist();window.render?.();};
window.careloopUseCloudReport=async(report,{canFund:funding=false}={})=>{
 if(busy)throw Error('Wait for the current reward action before changing reports.');
 if(!rewardStorageValid)throw Error('Preserved reward recovery data needs inspection first.');
 if(typeof report?.id!=='string'||!report.id.trim())throw Error('A saved cloud report is required.');
 programFieldId(report.programId);
 busy=true;window.render?.();
 try{
  const next=cloudRewardApproval(report),context={reportId:report.id,programId:report.programId,canFund:funding===true};
  if(next&&!context.canFund&&secret&&commitment(secret)!==next.commitment)throw Error('This report uses a different enrollment. Restore its private recovery file to claim.');
  if(next)next.nullifier=!context.canFund&&secret?hash(secret,scope(next.c)).toString():null;
  const same=signature(approval,cloudContext)===signature(next,context);
  let previous=null;
  if(!same){const old=[...archives].reverse().find(a=>a.signature===signature(next,context));if(old){previous=assertRecoveryNetwork(JSON.parse(sessionStorage.getItem(old.key)||'null'));if((previous.ownerId??null)!==rewardOwnerId)throw Error('Archived pool owner mismatch');}}
  const base=same?transactions:previous?restoredTransactions(previous):{fund:null,claim:null};
  const cloudDep=report.chain?.fund?.dep??report.chain?.claim?.dep;
  if(!next&&cloudDep)throw Error('A funded cloud report must include its public approval.');
  let nextDep=cloudDep?await loadDeployment(cloudDep):same?dep:previous?.dep?await loadDeployment(previous.dep):null;
  if(report.chain?.fund?.dep&&report.chain?.claim?.dep&&JSON.stringify(publicRewardDeployment(report.chain.fund.dep))!==JSON.stringify(publicRewardDeployment(report.chain.claim.dep)))throw Error('Cloud funding and claim refer to different pools.');
  const heldDep=same?dep:previous?.dep;
  if(heldDep&&nextDep&&(heldDep.address!==nextDep.address||heldDep.unit!==nextDep.unit))throw Error('Cloud pool differs from the preserved local pool. Keep its recovery file.');
  const nextRecords={fund:null,claim:null};
  for(const kind of ['fund','claim']){
   const incoming=next?cloudRecord(kind,report.chain?.[kind],next):null;
   nextRecords[kind]=base[kind]?.source==='local'||base[kind]&&base[kind].hash===incoming?.hash?base[kind]:incoming||base[kind];
  }
  if(!same)archiveCurrent();
  if(!same||cloudContext?.canFund!==context.canFund){claim=null;publicClaim=null;pending=null;chainState=null;poolBalance=null;}
  approval=next;cloudContext=context;dep=nextDep;transactions=nextRecords;selectSubmitted();lastError=false;
  persist();log.push(context.canFund?'Cloud approval loaded for clinic funding. The patient enrollment secret is not needed.':'Cloud report loaded. Claiming requires its matching private enrollment.');
  return window.careloopChainSnapshot();
 }finally{busy=false;window.render?.();}
};
// Sponsored claims use the participant's local enrollment witness, while a
// separate sponsor wallet pays transaction fees. Neither its private key nor
// this enrollment secret is sent with the public proof.
window.careloopReceiverWallets=()=>wallets().map(w=>({id:w.id,name:w.name}));
window.careloopReceivingAddress=()=>walletAddress;
window.careloopValidateRecipient=async value=>{const address=String(value||'').trim();sdk??=await import('/chain/wallet.js');sdk.paymentKey(address);return address;};
window.careloopConnectReceiver=async index=>{
 if(busy)throw Error('Wait for the current proof or wallet action.');const w=wallets()[index];if(!w)throw Error('Wallet extension unavailable. Paste a Preprod receiving address.');
 busy=true;window.render?.();
 try{const api=await window.cardano[w.id].enable();if(await api.getNetworkId()!==NETWORK_ID)throw Error('Switch your wallet to Cardano Preprod. Mainnet addresses are not accepted.');sdk??=await import('/chain/wallet.js');
  const reader=await sdk.Lucid(new sdk.Koios(location.origin+'/cardano'),NETWORK);reader.selectWallet.fromAPI(api);const address=await reader.wallet().address();sdk.paymentKey(address);wallet=api;lucid=reader;walletAddress=address;return address;
 }finally{busy=false;window.render?.();}
};
window.careloopBuildSponsoredProof=async(report,recipientAddress)=>{
 if(busy)throw Error('Wait for the current proof or wallet action.');
 if(!rewardStorageValid)throw Error('Restore a valid private enrollment recovery file first.');
 const next=cloudRewardApproval(report);if(!next)throw Error('The saved report does not have a reward authorization.');
 if(!secret||commitment(secret)!==next.commitment)throw Error('Restore this enrollment’s private recovery file in My rewards, then retry the live payment.');
 const expected=report.payout?.recipientAddress||report.recipientAddress;if(!expected||recipientAddress!==expected)throw Error('The receiving address differs from the submitted report.');
 const owner=rewardOwnerId;busy=true;window.render?.();
 try{
  sdk??=await import('/chain/wallet.js');const recipient=BigInt('0x'+sdk.paymentKey(recipientAddress)).toString();
  const w=witness(secret,{root:next.root,siblings:next.siblings,directions:next.directions},recipient,next.c);
  const result=await window.snarkjs.groth16.fullProve(w,'/zk/reward.wasm','/zk/reward.zkey',null,{}, {singleThread:true});
  const response=await fetch('/zk/verification_key.json');if(response.ok===false)throw Error('Could not load the proof verification key.');const vk=await response.json();
  if(!await window.snarkjs.groth16.verify(vk,result.publicSignals,result.proof))throw Error('Private proof verification failed. No claim was sent.');
  if(owner!==rewardOwnerId)throw Error('The account changed while creating the proof.');
  return {proof:result.proof,publicSignals:result.publicSignals};
 }finally{busy=false;window.render?.();}
};
window.careloopRewardStatus=reportId=>rewardStatusForReport(reportId,{approval,submitted:transactions.claim||submitted,chainState});
window.careloopChainSnapshot=()=>{
 const safe=r=>r?{txHash:r.hash,confirmed:r.confirmed===true,source:r.source||'local'}:null;
 return {network:NETWORK,networkMagic:NETWORK_MAGIC,busy,walletConnected:!!walletAddress,walletAddress:walletAddress||null,enrollmentCreated:!!secret,enrollmentMatchesApproval:canProve(),approvalReady:!!approval,proofVerified:!!claim,canFund:canFund(),poolConfirmed:!!chainState,poolAddress:dep?.address||null,stateNft:dep?.unit||null,poolBalanceLovelace:poolBalance?.toString()??null,poolBalance:poolBalance==null?null:Number(poolBalance)/1000000,usedNullifiers:chainState?[...chainState.used]:[],reportId:approval?.reportId??cloudContext?.reportId??null,programId:approval?.programId??cloudContext?.programId??null,approvalPeriodLabel:approval?.periodLabel??null,fund:safe(transactions.fund),claim:safe(transactions.claim),submitted:submitted?{kind:submitted.kind,...safe(submitted)}:null,rewardStatus:window.careloopRewardStatus(approval?.reportId),cloudSyncPending:Object.values(transactions).some(r=>r?.syncPending),error:lastError?'The last reward action did not complete. See My rewards for details.':null,archivedPoolCount:archives.length};
};
async function saveCloudRecord(record){
 if(!cloudContext)return;
 record.syncPending=true;persist();
 try{if(typeof window.careloopSaveChain!=='function')throw Error('Cloud save is unavailable');await window.careloopSaveChain(record.reportId,{kind:record.kind,txHash:record.hash,dep:publicRewardDeployment(dep)});record.syncPending=false;persist();log.push('Transaction reference saved to the shared report.');}
 catch{log.push('The transaction is retained locally. Its cloud record could not be saved; retry cloud sync without submitting another transaction.');}
}
window.chainSyncCloud=()=>run(async()=>{for(const record of Object.values(transactions))if(record?.syncPending)await saveCloudRecord(record);});
window.careloopRecoveryPanel=()=>`<details class="card" style="margin-top:22px"><summary>Private enrollment recovery</summary><p>Keep a private backup to use your enrollment on another device. This is separate from your wallet: you do not fund the reward or pay its transaction fee.</p><div class="actions">${button('Download private recovery file','zkBackup()',!secret&&!dep&&!approval&&rewardStorageValid)}<label class="btn secondary">Restore recovery file<input type="file" accept="application/json" onchange="zkRestore(this.files[0])" ${busy||secret||dep?'disabled':''}></label></div><p class="muted">${secret||dep?'Your enrollment is already loaded. To restore another file, open a fresh browser tab before creating an enrollment.':'Restore your existing enrollment here before claiming from a new browser.'} Keep recovery files private.</p>${archives.length?`<details><summary>Previous recovery files (${archives.length})</summary>${archives.map((a,i)=>button('Download '+esc(a.reportId||'previous pool'),`zkBackupArchive(${i})`)).join('')}</details>`:''}<div aria-live="polite">${busy?'<p>Restoring…</p>':''}${log.map(s=>'<div class="audit">'+esc(s)+'</div>').join('')}</div></details>`;
window.privacyPanel=()=>`<section class="card" style="margin-top:22px"><div class="eyebrow">CARDANO PREPROD · ON-CHAIN REWARDS</div><h2>Prove approval. Claim test ADA.</h2><p>Real Cardano transactions on <strong>Preprod testnet</strong>. Your wallet signs; this app never receives its seed phrase. Gemini reviews fictional reports; the completion policy authorizes eligible submissions. Clinics resolve holds.</p><div class="steps"><div class="${secret?'on':''}">1. Enrollment</div><div class="${approval?'on':''}">2. Approval & funding</div><div class="${claim?'on':''}">3. ZK proof</div><div class="${window.careloopRewardStatus(approval?.reportId)?.state==='confirmed'?'on':''}">4. On-chain claim</div></div>
<h3>Wallet</h3>${walletAddress?`<p class="proof-json">Connected: ${esc(walletAddress)}</p>`:`<p>Use a Cardano wallet extension in your browser, switched to Preprod. The ChatGPT browser may not have an extension.</p>`}
<div class="flex" style="flex-wrap:wrap;gap:10px">${wallets().map((w,i)=>button('Connect '+esc(w.name),`chainConnect(${i})`)).join('')||'<span class="muted">No wallet extension detected. Open this site in the browser where your Cardano wallet is installed.</span>'}${button('Refresh wallets','window.render()')}${button('Check Preprod network','chainCheckNetwork()')}</div>
<p><a href="https://docs.cardano.org/cardano-testnets/tools/faucet/" target="_blank" rel="noopener noreferrer">Get free Preprod test ADA ↗</a> · These manual developer tools require the operator’s wallet to pay fees. Normal sponsored payments do not. Manual funding needs a pure-ADA UTxO ≥25 test ADA and separate collateral. Claims need test ADA for fees/collateral. Network reads and submitted transactions go to Koios.</p>
<h3>Enrollment & approval</h3><p>${cloudContext?.canFund?'Clinic funding uses the patient’s public approval. The patient keeps their own enrollment secret.':secret?'Enrollment saved in this browser tab. The secret is not sent to Gemini, Koios or the blockchain.':'Create an enrollment before submitting a fictional report, or restore its private recovery file.'}</p>
<div class="flex" style="flex-wrap:wrap;gap:10px">${button('Create enrollment','zkEnroll()',!!secret||!rewardStorageValid||cloudContext?.canFund)}${button('Download recovery file','zkBackup()',!secret&&!dep&&!approval&&rewardStorageValid)}<label class="btn secondary">Restore recovery file<input type="file" accept="application/json" onchange="zkRestore(this.files[0])" style="max-width:200px" ${busy?'disabled':''}></label></div>
${archives.length?`<details><summary>Preserved pool recovery files (${archives.length})</summary>${archives.map((a,i)=>button('Download '+esc(a.reportId||'previous pool'),`zkBackupArchive(${i})`)).join('')}</details>`:''}
<p>${approval?'Approved for '+esc(approval.periodLabel)+(approval.reportId?' · Report '+esc(approval.reportId)+' · Program '+esc(approval.programId):' · Legacy approval, not linked to a report')+'. This report’s approval is one of eight Merkle leaves; the other seven are random padding, not seven other participants. Fixed demo reward: 2 test ADA for this reporting period.':'Awaiting clinic approval.'}</p><p class="muted">The connected funding wallet acts as the clinic for this fictional demo. Selecting the Clinic role does not verify clinic membership.</p>
<h3>Reward pool</h3><p>Fund <strong>20 test ADA</strong>: this report can claim 2 test ADA once. The remaining 18 test ADA stays in this demo contract. This experimental pool has no refund function. Only use disposable test ADA.</p>
<div class="flex" style="flex-wrap:wrap;gap:10px">${button('Prepare 20 ADA pool','chainFund()',!canFund()||!lucid||!!dep||!!transactions.fund)}${button('Refresh on-chain state','chainRefresh()',!dep)}${dep&&!submitted&&!chainState?button('Discard unsubmitted pool','chainDiscard()'):''}</div>
${dep?`<p class="proof-json">Pool address: ${esc(dep.address)}<br>State NFT: ${esc(dep.unit)}</p><p>${chainState?'Confirmed pool · '+chainState.used.length+' claims recorded.':'Pool configuration saved; refresh to check confirmation.'}</p>`:''}
<h3>Private claim</h3><div class="flex" style="flex-wrap:wrap;gap:10px">${button('Generate ZK proof','zkProve()',!canProve()||!walletAddress)}${button('Prepare 2 ADA claim','chainClaim()',!canProve()||!claim||!dep||!lucid||!!transactions.claim)}${button('Test changed recipient','zkTamper()',!claim)}</div><p>Proofs bind the reward to your connected wallet’s payment key. No questionnaire, patient ID, secret or Merkle path is included on-chain. Wallets, fees, timing and amounts remain public.</p>
${publicClaim?`<details><summary>Inspect public claim</summary><pre class="proof-json">${esc(JSON.stringify(publicClaim,null,2))}</pre></details>`:''}
${pending?`<div class="info"><h3>Review transaction before signing</h3><p>${esc(pending.kind==='fund'?'Lock 20 test ADA at the pool above; mint one state NFT.':'Pay 2 test ADA from the pool to your connected wallet; record the nullifier.')} Your wallet pays a network fee of approximately ${pending.summary.fee.toFixed(6)} test ADA.</p><p class="proof-json">Transaction ID: ${pending.summary.hash}</p><p>Check the outputs in your wallet. Signing submits this transaction to Preprod.</p>${button('Sign & submit in wallet','chainSign()')}${button('Cancel prepared transaction','chainCancel()')}</div>`:''}
${submitted?`<p><a target="_blank" rel="noopener noreferrer" href="${EXPLORER}/transaction/${esc(submitted.hash)}">View ${esc(submitted.kind)} transaction ↗</a> · ${submitted.confirmed?'Confirmed on Preprod':'Submitted; confirmation pending'}</p>`:''}
${Object.values(transactions).some(r=>r?.syncPending)?button('Retry cloud record','chainSyncCloud()'):''}
<div aria-live="polite">${busy?'<p class="info">Working… keep this tab open.</p>':''}${log.map(s=>'<div class="audit">'+esc(s)+'</div>').join('')}</div><small>Experimental development proving setup. Use fictional data only. Enrollment recovery files contain your private enrollment secret. Keep them private. Closing this tab can clear its local session.</small></section>`;
window.zkEnroll=()=>{if(!rewardStorageValid)throw Error('Existing reward recovery data needs inspection. Download it before restoring a valid Preprod recovery file.');if(secret)return;secret=randomSecret();window.careloopCommitment=commitment(secret);persist();say('Enrollment created. Download its recovery file before funding.');};
window.zkApprove=report=>{if(!secret)throw Error('Open My rewards and create enrollment first.');if(approval)throw Error('A report is already approved in this session.');if(typeof report?.id!=='string'||!report.id.trim()||typeof report.period!=='string')throw Error('A saved report and reporting period are required.');const programId=report.programId??report.program?.id;const c={...config,program:programFieldId(programId),domain:randomSecret(),period:report.periodId==null?String(Number(report.period.match(/\d+/)?.[0]||5)):periodFieldId(report.periodId)};const leaves=Array.from({length:8},()=>leaf(commitment(randomSecret()),c));const index=crypto.getRandomValues(new Uint8Array(1))[0]%8;leaves[index]=leaf(window.careloopCommitment,c);approval={...tree(leaves,index),c,commitment:window.careloopCommitment,reportId:report.id,programId,periodId:report.periodId??null,nullifier:hash(secret,scope(c)).toString(),periodLabel:report.period};persist();log.push('Fictional clinic approval created for report '+report.id+'. Funding transaction will commit this root on-chain.');};
window.chainCheckNetwork=()=>run(async()=>{sdk??=await import('/chain/wallet.js');const params=await new sdk.Koios(location.origin+'/cardano').getProtocolParameters();log.push('Preprod connected. Live protocol version '+params.protocolMajorVersion+'; transaction library loaded. Connect a wallet to continue.');});
window.chainConnect=i=>run(async()=>{const w=wallets()[i];if(!w)throw Error('Wallet unavailable. Refresh wallets.');const api=await window.cardano[w.id].enable();if(await api.getNetworkId()!==NETWORK_ID)throw Error('Mainnet is blocked. Switch your wallet to Preprod testnet.');sdk??=await import('/chain/wallet.js');lucid=await sdk.Lucid(new sdk.Koios(location.origin+'/cardano'),sdk.NETWORK);lucid.selectWallet.fromAPI(api);await sdk.assertWalletOnTargetNetwork(lucid);wallet=api;walletAddress=await lucid.wallet().address();sdk.paymentKey(walletAddress);claim=null;publicClaim=null;pending=null;log.push('Preprod wallet connected; wallet outputs verified on the target network.');});
window.chainFund=()=>run(async()=>{if(!canFund()||!lucid||dep||transactions.fund)throw Error('Load a clinic approval, connect its funding wallet and use a fresh pool.');const [blueprint,vk]=await Promise.all(['/zk/plutus.json','/zk/verification_key.json'].map(u=>fetch(u).then(r=>r.json())));const prepared=await sdk.preparePool(lucid,blueprint,vk,{...approval.c,root:approval.root});dep=prepared.dep;pending={tx:prepared.tx,kind:'fund',summary:sdk.transactionSummary(prepared.tx),address:walletAddress,reportId:approval.reportId,programId:approval.programId};log.push('Funding transaction prepared, not signed or submitted.');});
window.chainDiscard=()=>{if(busy)return;if(submitted||chainState){say('A submitted pool cannot be discarded. Download its recovery file.');return;}dep=null;pending=null;persist();window.render();};
window.chainCancel=()=>{if(busy)return;if(pending?.kind==='fund')dep=null;pending=null;persist();window.render();};
window.chainSign=()=>run(async()=>{if(!pending)throw Error('Prepare a transaction first.');if(await wallet.getNetworkId()!==NETWORK_ID)throw Error('Switch back to Preprod.');await sdk.assertWalletOnTargetNetwork(lucid);const now=await lucid.wallet().address();if(now!==pending.address)throw Error('Wallet account changed. Reconnect and prepare again.');const p=pending;const signed=await p.tx.sign.withWallet().complete();const record={hash:p.summary.hash,kind:p.kind,reportId:p.reportId,programId:p.programId,confirmed:false,source:'local',submissionStatus:'pending',...(p.kind==='claim'?{nullifier:p.nullifier}:{})};transactions[p.kind]=record;selectSubmitted();pending=null;persist();const txHash=await signed.submit();if(txHash!==record.hash)throw Error('Unexpected transaction ID. Saved state retained; inspect before retry.');record.submissionStatus='submitted';persist();log.push('Submitted to Preprod. No confirmation claimed yet; use Refresh on-chain state.');await saveCloudRecord(record);});
window.chainRefresh=()=>run(async()=>{
 if(!dep)throw Error('Load a funded report or prepare a pool first.');sdk??=await import('/chain/wallet.js');const reader=lucid??await sdk.Lucid(new sdk.Koios(location.origin+'/cardano'),NETWORK);
 chainState=null;poolBalance=null;for(const r of Object.values(transactions))if(r){r.confirmed=false;r.chainVerified=false;}
 const pool=await sdk.readPool(reader,dep);if(!poolMatchesApproval(pool.state,approval))throw Error('The Preprod pool does not match this report approval.');chainState=pool.state;poolBalance=pool.utxo.assets.lovelace;
 for(const record of Object.values(transactions))if(record){
  const status=await reader.transactionStatus(record.hash);if(status.status!=='confirmed')continue;
  if(record.source==='cloud'){
   const r=await fetch(location.origin+'/cardano/tx_info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_tx_hashes:[record.hash],_inputs:true,_assets:true,_scripts:true,_bytecode:true})});if(r.ok===false)throw Error('Unable to verify the cloud transaction on Preprod.');
   const rows=await r.json();const evidence=verifyRewardTransaction(record.kind,record.hash,Array.isArray(rows)?rows.find(t=>t.tx_hash===record.hash):null,dep,approval,sdk.decodeState);
   if(!evidence){log.push('Cloud '+record.kind+' reference is not verified as this pool transaction.');continue;}record.chainVerified=true;if(evidence.nullifier)record.nullifier=evidence.nullifier;
  }
  record.confirmed=true;
 }
 selectSubmitted();log.push('Read pool from Preprod: '+poolBalance/1000000n+' test ADA, '+chainState.used.length+' claims.');
});
window.zkProve=()=>run(async()=>{if(!canProve()||!walletAddress)throw Error('The matching patient enrollment and recipient wallet are required. Clinic funding cannot use a clinic enrollment secret.');const recipient=BigInt('0x'+sdk.paymentKey(walletAddress)).toString();const w=witness(secret,{root:approval.root,siblings:approval.siblings,directions:approval.directions},recipient,approval.c);const result=await window.snarkjs.groth16.fullProve(w,'/zk/reward.wasm','/zk/reward.zkey',null,{}, {singleThread:true});const vk=await fetch('/zk/verification_key.json').then(r=>r.json());if(!await window.snarkjs.groth16.verify(vk,result.publicSignals,result.proof))throw Error('Proof verification failed');claim=result;publicClaim={...result,recipient_address:walletAddress,network:NETWORK};pending=null;log.push('Real proof generated and verified; bound to connected wallet.');});
window.chainClaim=()=>run(async()=>{if(!canProve()||!claim||!dep||!lucid||transactions.claim)throw Error('Use the matching patient proof and funded pool. Refresh any already recorded claim before continuing.');const tx=await sdk.prepareClaim(lucid,dep,claim,walletAddress);pending={tx,kind:'claim',summary:sdk.transactionSummary(tx),address:walletAddress,reportId:approval?.reportId??null,programId:approval?.programId??null,nullifier:claim.publicSignals[1]};log.push('Claim passed script evaluation. Review and sign to submit it.');});
window.zkTamper=()=>run(async()=>{if(!claim)return;const changed=[...claim.publicSignals];changed[5]=(BigInt(changed[5])+1n).toString();const vk=await fetch('/zk/verification_key.json').then(r=>r.json());const ok=await window.snarkjs.groth16.verify(vk,changed,claim.proof);log.push(ok?'ERROR: altered proof accepted.':'Changed recipient rejected by cryptographic verifier.');});
function downloadRecovery(contents,name){if(!contents)throw Error('Recovery file is unavailable.');const u=URL.createObjectURL(new Blob([contents],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
window.zkBackup=()=>{persist();downloadRecovery(sessionStorage.getItem(savedKey),'careloop-preprod-private-recovery.json');};
window.zkBackupArchive=index=>{const entry=archives[index];if(!entry||!entry.key.startsWith(savedKey+':archive:'))throw Error('Recovery archive is unavailable for this account.');downloadRecovery(sessionStorage.getItem(entry.key),'careloop-preprod-archived-pool-recovery.json');};
window.zkRestore=file=>run(async()=>{if(!file)return;if(secret||dep)throw Error('Restore into a fresh browser tab before creating an enrollment.');if(file.size>100000)throw Error('Recovery file too large.');const s=assertRecoveryNetwork(JSON.parse(await file.text()));const restoredCommitment=s.secret?commitment(s.secret):null;if(s.approval){if(s.approval.siblings?.length!==3||s.approval.directions?.length!==3)throw Error('Invalid recovery path');}const restoredDep=s.dep?await loadDeployment(s.dep):null;secret=s.secret||null;approval=s.approval||null;transactions=restoredTransactions(s);selectSubmitted();cloudContext=s.cloudContext?{reportId:s.cloudContext.reportId,programId:s.cloudContext.programId,canFund:false}:null;dep=restoredDep;if(restoredCommitment)window.careloopCommitment=restoredCommitment;else delete window.careloopCommitment;rewardStorageValid=true;log.push('Recovery restored. Refresh the Preprod pool before treating any transaction as confirmed.');});
