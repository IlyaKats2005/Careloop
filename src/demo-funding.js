// Resettable app credits. These reservations are not on-chain deposits and do
// not mint ADA, pay a model provider invoice, or reverse a confirmed payment.
const first=(DB,sql,...args)=>DB.prepare(sql).bind(...args).first();
const fail=(message,code='CLINIC_BUDGET',status=409)=>Object.assign(new Error(message),{code,status});
const stamp=()=>new Date().toISOString();
const initial=()=>({total:1000,available:750,clinic:{id:'careloop-clinic',name:'Careloop Research Clinic',rewards:200,ai:50},charges:{},events:[{at:stamp(),kind:'allocation',bucket:'rewards',amount:200,description:'Starting client reward budget'},{at:stamp(),kind:'allocation',bucket:'ai',amount:50,description:'Starting AI budget'}]});
async function rowFor(DB,workspaceId){
 const workspace=await first(DB,'SELECT mode FROM care_workspaces WHERE id=?',workspaceId);
 if(workspace?.mode!=='demo')return null;
 await DB.prepare('INSERT OR IGNORE INTO care_demo_funding (workspace_id,ledger_json) VALUES (?,?)').bind(workspaceId,JSON.stringify(initial())).run();
 return first(DB,'SELECT * FROM care_demo_funding WHERE workspace_id=?',workspaceId);
}
function summary(row){
 if(!row)return null;
 const ledger=JSON.parse(row.ledger_json),charges=Object.values(ledger.charges);
 const sum=(bucket,status)=>charges.filter(c=>c.bucket===bucket&&c.status===status).reduce((n,c)=>n+c.amount,0);
 return{revision:row.revision,total:ledger.total,available:ledger.available,unit:'demo credits',clinic:{...ledger.clinic,rewardPending:sum('rewards','reserved'),rewardSpent:sum('rewards','spent'),aiPending:sum('ai','reserved'),aiSpent:sum('ai','spent')},events:ledger.events.slice(-40).reverse()};
}
async function change(DB,workspaceId,mutate){
 for(let attempt=0;attempt<10;attempt++){
  const row=await rowFor(DB,workspaceId);if(!row)return null;
  const ledger=JSON.parse(row.ledger_json);if(mutate(ledger)===false)return summary(row);
  ledger.events=ledger.events.slice(-100);
  const saved=await DB.prepare('UPDATE care_demo_funding SET ledger_json=?,revision=revision+1 WHERE workspace_id=? AND revision=?').bind(JSON.stringify(ledger),workspaceId,row.revision).run();
  if(Number(saved.meta?.changes??saved.changes))return summary({...row,revision:row.revision+1,ledger_json:JSON.stringify(ledger)});
 }
 throw fail('The funding balance changed. Try again.','FUNDING_CONFLICT');
}
export async function demoFunding(DB,workspaceId){return summary(await rowFor(DB,workspaceId));}
export async function allocateDemoFunding(DB,workspaceId,body){
 const {clinicId,bucket,action,amount}=body;
 if(clinicId!=='careloop-clinic'||!['ai','rewards'].includes(bucket)||!['reserve','release'].includes(action)||!Number.isSafeInteger(amount)||amount<1||amount>1000)throw fail('Choose a clinic, budget and a whole amount between 1 and 1,000.','FUNDING_INPUT',400);
 return change(DB,workspaceId,ledger=>{
  if(action==='reserve'){
   if(amount>ledger.available)throw fail('The sponsor does not have enough unallocated demo credits.');
   ledger.available-=amount;ledger.clinic[bucket]+=amount;
  }else{
   if(amount>ledger.clinic[bucket])throw fail('Only unused clinic credits can be released. Pending and spent credits stay committed.');
   ledger.clinic[bucket]-=amount;ledger.available+=amount;
  }
  ledger.events.push({at:stamp(),kind:action,bucket,amount,description:action==='reserve'?'Sponsor reserved credits for the clinic':'Sponsor released unused clinic credits'});
 });
}
export async function reserveDemoCharge(DB,report,bucket){
 return change(DB,report.workspace_id,ledger=>{
  const key=bucket+':'+report.id;if(ledger.charges[key])return false;
  const amount=bucket==='ai'?1:2;
  if(ledger.clinic[bucket]<amount)throw fail(bucket==='ai'?'The clinic AI budget is empty. Ask the sponsor to reserve more AI credits.':'The clinic client reward budget is empty. Ask the sponsor to reserve more reward credits.');
  ledger.clinic[bucket]-=amount;ledger.charges[key]={bucket,amount,status:'reserved',reportId:report.id};
  ledger.events.push({at:stamp(),kind:'pending',bucket,amount,reportId:report.id,description:bucket==='ai'?'AI analysis credit reserved':'Client reward credits reserved'});
 });
}
export async function settleDemoCharge(DB,report,bucket,success=true){
 return change(DB,report.workspace_id,ledger=>{
  const key=bucket+':'+report.id,charge=ledger.charges[key];if(!charge||charge.status==='spent')return false;
  if(success)charge.status='spent';else{ledger.clinic[bucket]+=charge.amount;delete ledger.charges[key];}
  ledger.events.push({at:stamp(),kind:success?'spent':'returned',bucket,amount:charge.amount,reportId:report.id,description:success?(bucket==='ai'?'AI analysis completed':'Client payment confirmed on Preprod'):'Unused analysis credit returned'});
 });
}
