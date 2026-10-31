import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {DEMO_CLIENTS} from '../src/demo-clients.js';
import {authAPI,getSession,requireIdentity,hashPassword,normalizeEmail} from '../src/auth.js';
let ip=0;
function database(){
  const sqlite=new DatabaseSync(':memory:');for(const name of ['0000_email_auth','0001_workspace_data','0002_automatic_rewards','0003_client_profiles'])sqlite.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));
  return {sqlite,prepare(sql){
    const statement=sqlite.prepare(sql);
    return {bind(...args){
      return {async first(){return statement.get(...args)||null;},async run(){return statement.run(...args);}};
    }};
  }};
}
const signup={email:' Fictional@Example.test ',password:'fictional-pass-123',role:'patient',recipientAddress:DEMO_CLIENTS[0].recipientAddress,displayName:'Fictional Participant'};
function request(path='/api/session',body,extra={}){return new Request('https://careloop.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://careloop.test','cf-connecting-ip':'test-'+(++ip),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const cookieOf=response=>response.headers.get('set-cookie').split(';')[0];

test('register stores salted password hash and establishes an HttpOnly cookie session',async()=>{
  const DB=database();const response=await authAPI(request('/api/auth/register',signup),{DB});
  assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.signedIn,true);assert.equal(data.user.email,'fictional@example.test');assert.equal(data.user.role,'patient');assert.equal(data.clinicMembershipVerified,false);
  assert.match(response.headers.get('set-cookie'),/^__Host-careloop_session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800$/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const stored=DB.sqlite.prepare('SELECT * FROM auth_users').get();
  assert.notEqual(stored.password_hash,signup.password);assert.equal(stored.password_salt.length,32);assert.equal(stored.password_iterations,100000);
  assert.equal(stored.password_hash,await hashPassword(signup.password,stored.password_salt));
  const sessionRow=DB.sqlite.prepare('SELECT * FROM auth_sessions').get();assert.ok(!response.headers.get('set-cookie').includes(sessionRow.token_hash));
  const current=await getSession(request('/api/session',undefined,{cookie:cookieOf(response)}),{DB});assert.equal(current.user.id,data.user.id);
  assert.equal((await requireIdentity(request('/api/session',undefined,{cookie:cookieOf(response)}),{DB})).id,data.user.id);
  DB.sqlite.close();
});

test('login rejects wrong and unknown credentials equally and ignores client role changes',async()=>{
  const DB=database();await authAPI(request('/api/auth/register',{...signup,email:'login@example.test'}),{DB});
  const wrong=await authAPI(request('/api/auth/login',{email:'login@example.test',password:'wrong-password'}),{DB});
  const unknown=await authAPI(request('/api/auth/login',{email:'unknown@example.test',password:'wrong-password'}),{DB});
  assert.equal(wrong.status,401);assert.equal(unknown.status,401);assert.deepEqual(await wrong.json(),await unknown.json());
  const correct=await authAPI(request('/api/auth/login',{email:'LOGIN@example.test',password:signup.password,role:'clinic'}),{DB});
  assert.equal(correct.status,200);assert.equal((await correct.json()).user.role,'patient');
  DB.sqlite.close();
});

test('logout revokes session server-side and clears cookie',async()=>{
  const DB=database();const registration=await authAPI(request('/api/auth/register',{...signup,email:'logout@example.test'}),{DB});const cookie=cookieOf(registration);
  const response=await authAPI(request('/api/auth/logout',{}, {cookie}),{DB});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await getSession(request('/api/session',undefined,{cookie}),{DB})).signedIn,false);
  assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM auth_sessions').get().n,0);
  DB.sqlite.close();
});

test('expired sessions and arbitrary identity headers cannot authenticate',async()=>{
  const DB=database();const registration=await authAPI(request('/api/auth/register',{...signup,email:'expired@example.test'}),{DB});const cookie=cookieOf(registration);
  DB.sqlite.exec('UPDATE auth_sessions SET expires_at=1');
  assert.equal((await getSession(request('/api/session',undefined,{cookie}),{DB})).signedIn,false);
  const nativeHeaders={'oai-authenticated-user-id':'fake','oai-authenticated-user-email':'fake@example.test','x-demo-role':'clinic'};
  assert.equal((await getSession(request('/api/session',undefined,nativeHeaders),{DB})).signedIn,false);
  await assert.rejects(requireIdentity(request(),{DB}),{code:'AUTH_REQUIRED',status:401});
  DB.sqlite.close();
});

test('input validation, cross-origin requests and unavailable storage fail closed',async()=>{
  const DB=database();
  assert.equal((await authAPI(request('/api/auth/register',{...signup,password:'short'}),{DB})).status,400);
  assert.equal((await authAPI(request('/api/auth/register',{...signup,role:'admin'}),{DB})).status,400);
  assert.equal((await authAPI(request('/api/auth/register',signup,{Origin:'https://evil.test'}),{DB})).status,403);
  assert.equal((await authAPI(request('/api/auth/login',signup),{})).status,503);
  assert.equal((await authAPI(request('/api/auth/register',{...signup,displayName:'x'.repeat(5000)}),{DB})).status,413);
  assert.equal((await authAPI(request('/api/auth/register'),{DB})).status,405);
  assert.equal((await authAPI(request('/api/session'),{DB})).headers.get('vary'),'Cookie');
  assert.equal(await authAPI(request('/api/analyze'),{DB}),null);
  assert.throws(()=>normalizeEmail('not-email'));
  DB.sqlite.close();
});

test('clinic registration is a demo role, and duplicate accounts do not overwrite passwords',async()=>{
  const DB=database();const first=await authAPI(request('/api/auth/register',{...signup,email:'clinic@example.test',role:'clinic'}),{DB});
  assert.equal(first.status,200);const user=await first.json();assert.deepEqual(user.workspaces,['clinic']);assert.equal(user.clinicMembershipVerified,false);
  const second=await authAPI(request('/api/auth/register',{...signup,email:'clinic@example.test',password:'replacement-password'}),{DB});
  assert.equal(second.status,409);assert.equal(DB.sqlite.prepare('SELECT count(*) AS n FROM auth_users').get().n,1);
  const login=await authAPI(request('/api/auth/login',{email:'clinic@example.test',password:signup.password}),{DB});assert.equal(login.status,200);
  DB.sqlite.close();
});

test('participant registration saves a validated wallet and every login returns the same profile address',async()=>{
 const DB=database();
 for(const recipientAddress of [undefined,'','addr1mainnet','not-a-wallet']){
  const response=await authAPI(request('/api/auth/register',{...signup,email:'wallet@example.test',recipientAddress}),{DB});assert.equal(response.status,400);
 }
 const registered=await authAPI(request('/api/auth/register',{...signup,email:'wallet@example.test'}),{DB}),cookie=cookieOf(registered);
 assert.equal((await registered.json()).user.recipientAddress,signup.recipientAddress);
 const login=await authAPI(request('/api/auth/login',{email:'wallet@example.test',password:signup.password,recipientAddress:DEMO_CLIENTS[1].recipientAddress}),{DB});
 assert.equal((await login.json()).user.recipientAddress,signup.recipientAddress);
 assert.equal((await authAPI(request('/api/auth/wallet',{recipientAddress:DEMO_CLIENTS[1].recipientAddress}),{DB})).status,401);
 const changed=await authAPI(request('/api/auth/wallet',{recipientAddress:DEMO_CLIENTS[1].recipientAddress},{cookie}),{DB});
 assert.equal(changed.status,200);assert.equal((await changed.json()).user.recipientAddress,DEMO_CLIENTS[1].recipientAddress);
 assert.equal((await getSession(request('/api/session',undefined,{cookie}),{DB})).user.recipientAddress,DEMO_CLIENTS[1].recipientAddress);
 DB.sqlite.close();
});
