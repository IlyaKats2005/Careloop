import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('all app pages render and clinic AI errors stay visible',async()=>{
 const elements=new Map();const document={querySelector:s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',style:{},value:'review',checked:true});return elements.get(s);}};
 const window={scrollTo(){},careloopEscape:s=>s,privacyPanel:()=>'<div>Proof area</div>',zkApprove(){}};
 const context=vm.createContext({document,window,setTimeout:()=>{},fetch:async()=>Response.json({message:'Key missing'},{status:503})});
 vm.runInContext(readFileSync('public/app.js','utf8'),context);
 for(const p of ['overview','checkin','reports','rewards','queue','program']){vm.runInContext(`nav('${p}')`,context);assert.ok(elements.get('#app').innerHTML.length>200);}
 vm.runInContext("switchRole('clinic');openReport('R-104')",context);assert.match(elements.get('#app').innerHTML,/Analyze fictional report/);
 await vm.runInContext("runAI('R-104')",context);assert.match(elements.get('#app').innerHTML,/Key missing/);
});
