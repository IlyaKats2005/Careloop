import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,cpSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalDatabase} from '../scripts/local-db.mjs';
import {authAPI,getSession} from '../src/auth.js';
import {dataAPI,currentPeriod} from '../src/data-api.js';

const migrationsDirectory=fileURLToPath(new URL('../drizzle',import.meta.url));
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'careloop-local-db-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,filename:join(dir,'dev.sqlite'),migrationsDirectory};}
let requestId=0;
function request(path,body,cookie){return new Request('https://careloop.test'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:'https://careloop.test','cf-connecting-ip':'local-db-test-'+(++requestId),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const cookieOf=response=>response.headers.get('Set-Cookie').split(';')[0];

test('local migrations run once and password sessions persist after database reopen',async t=>{
 const options=fixture(t);let DB=createLocalDatabase(options);
 try{
  const registration=await authAPI(request('/api/auth/register',{email:'local@example.test',password:'fictional-local-password',displayName:'Local Demo',role:'patient'}),{DB});
  assert.equal(registration.status,200);const cookie=cookieOf(registration),user=(await registration.json()).user;
  const before=await DB.prepare('SELECT tag FROM _careloop_local_migrations ORDER BY tag').all();assert.ok(before.results.length>=2);
  DB.close();DB=createLocalDatabase(options);
  const restored=await getSession(request('/api/session',undefined,cookie),{DB});assert.equal(restored.user.id,user.id);
  assert.equal(await DB.prepare('SELECT count(*) AS n FROM auth_users').first('n'),1);
  assert.deepEqual((await DB.prepare('SELECT tag FROM _careloop_local_migrations ORDER BY tag').all()).results,before.results);
 }finally{DB.close();}
});

test('real workspace reports and JSON audit updates persist through the D1 adapter',async t=>{
 const options=fixture(t);let DB=createLocalDatabase(options);
 try{
  const started=await dataAPI(request('/api/demo/start',{}),{DB});assert.equal(started.status,200);
  const cookie=cookieOf(started),workspace=await started.json(),program=workspace.programs[0];assert.equal(workspace.programs.length,3);
  const answers={status:'About the same',medication:program.medicationOptions[0]||'',missed:'No',symptoms:Object.fromEntries(program.symptoms.map(topic=>[topic,'None'])),urgent:[],impact:'Not at all',hydration:'Yes',contact:'No'};
  const saved=await dataAPI(request('/api/data/reports?mode=demo',{fictional:true,programId:program.id,periodId:currentPeriod(program).id,commitment:'123',answers},cookie),{DB});assert.equal(saved.status,201);
  const report=(await saved.json()).report;
  const reviewed=await dataAPI(request('/api/data/reports/'+report.id+'/review?mode=demo',{action:'review',note:'Fictional local review.'},cookie),{DB});assert.equal(reviewed.status,200);
  DB.close();DB=createLocalDatabase(options);
  const restored=await dataAPI(request('/api/workspace?mode=demo',undefined,cookie),{DB});assert.equal(restored.status,200);
  const reports=(await restored.json()).reports;assert.equal(reports.length,1);assert.equal(reports[0].id,report.id);assert.equal(reports[0].clinical,'Reviewed');assert.equal(reports[0].decision,'Fictional local review.');assert.equal(reports[0].audit.length,2);
 }finally{DB.close();}
});

test('batches roll back on failure and bindings reject unsupported values',async()=>{
 const DB=createLocalDatabase({filename:':memory:',migrationsDirectory});
 try{
  await DB.prepare('CREATE TABLE local_adapter_fixture (id INTEGER PRIMARY KEY, value TEXT NOT NULL)').run();
  const result=await DB.batch([DB.prepare('INSERT INTO local_adapter_fixture (id,value) VALUES (?,?)').bind(1,'first'),DB.prepare('SELECT value FROM local_adapter_fixture WHERE id=?').bind(1)]);
  assert.equal(result[0].meta.changes,1);assert.equal(result[1].results[0].value,'first');
  await assert.rejects(DB.batch([DB.prepare('INSERT INTO local_adapter_fixture (id,value) VALUES (?,?)').bind(2,'rolled back'),DB.prepare('INSERT INTO local_adapter_fixture (id,value) VALUES (?,?)').bind(1,'duplicate')]));
  assert.equal(await DB.prepare('SELECT count(*) AS n FROM local_adapter_fixture').first('n'),1);
  for(const value of [undefined,true,{},NaN,Infinity])assert.throws(()=>DB.prepare('SELECT ?').bind(value),/Unsupported database binding/);
  await assert.rejects(DB.prepare('SELECT value FROM local_adapter_fixture WHERE id=1').first('missing'),/column/);
  await assert.rejects(DB.prepare('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind('token','missing-user',0,1).run(),/FOREIGN KEY/);
 }finally{DB.close();}
});

test('local startup rejects changes to applied migrations',t=>{
 const options=fixture(t),copy=join(options.dir,'drizzle');cpSync(migrationsDirectory,copy,{recursive:true});options.migrationsDirectory=copy;
 const DB=createLocalDatabase(options);DB.close();
 appendFileSync(join(copy,'0000_email_auth.sql'),'\n-- Unexpected edit to an applied migration.\n');
 assert.throws(()=>createLocalDatabase(options),/applied local migration has changed/);
});
