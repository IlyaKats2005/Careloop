const COOKIE='__Host-careloop_session';
const SESSION_SECONDS=7*24*60*60;
const ITERATIONS=100000;
const encoder=new TextEncoder();
const roles=new Set(['patient','clinic']);
const rateLimits=new Map();
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=value=>Uint8Array.from(value.match(/../g)||[],v=>parseInt(v,16));
const randomHex=length=>hex(crypto.getRandomValues(new Uint8Array(length)));
const sha256=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const fail=(message,status=400,code='INVALID_INPUT')=>Object.assign(new Error(message),{status,code});

export async function hashPassword(password,salt,iterations=ITERATIONS){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations,hash:'SHA-256'},key,256)));
}
function equalHash(left,right){
  if(typeof left!=='string'||typeof right!=='string'||left.length!==right.length)return false;
  let difference=0;for(let i=0;i<left.length;i++)difference|=left.charCodeAt(i)^right.charCodeAt(i);
  return difference===0;
}
export function normalizeEmail(value){
  if(typeof value!=='string')throw fail('Enter a valid email address.');
  const email=value.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Enter a valid email address.');
  return email;
}
function validatePassword(value){
  if(typeof value!=='string'||value.length<10||value.length>128)throw fail('Use a password of 10–128 characters.');
  return value;
}
function cookie(token,maxAge=SESSION_SECONDS){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
function tokenFrom(request){
  const values=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));
  if(values.length!==1)return null;
  const token=values[0].slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;
}
function db(env){if(!env.DB?.prepare)throw fail('Account storage is temporarily unavailable. Please try again later.',503,'AUTH_STORAGE_UNAVAILABLE');return env.DB;}
function publicUser(user){return {id:user.id,email:user.email,displayName:user.display_name,role:user.role};}
function session(user=null){return {signedIn:!!user,user:user?publicUser(user):null,mode:'fictional-demo',workspaces:user?[user.role]:['patient','clinic'],clinicMembershipVerified:false,emailVerified:false};}

export async function getSession(request,env={}){
  const token=tokenFrom(request);if(!token)return session();
  const tokenHash=await sha256(token);
  const user=await db(env).prepare('SELECT u.id, u.email, u.display_name, u.role, s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ?').bind(tokenHash).first();
  if(!user)return session();
  if(user.expires_at<=Math.floor(Date.now()/1000)){
    await db(env).prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(tokenHash).run();
    return session();
  }
  return session(user);
}
export async function requireIdentity(request,env={}){
  const current=await getSession(request,env);if(current.user)return current.user;
  throw fail('Sign in to continue.',401,'AUTH_REQUIRED');
}
// These are demo accounts: choosing the clinic role does not verify a clinic.
// The public analysis endpoint continues to accept only explicit fictional data.
export async function authorizeAnalysis(request,body,env={}){
  if(body?.fictional!==true)throw fail('Only fictional demo reports are accepted.',400,'FICTIONAL_REPORT_REQUIRED');
  const current=await getSession(request,env);
  return {kind:current.signedIn?'signed-in-demo':'anonymous-demo',clinicMembershipVerified:false};
}
function checkOrigin(request){
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw fail('Origin not allowed.',403,'ORIGIN_NOT_ALLOWED');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw fail('JSON required.',415,'JSON_REQUIRED');
}
async function readBody(request){
  const reader=request.body?.getReader();if(!reader)throw fail('Request body required.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw fail('Request too large.',413,'REQUEST_TOO_LARGE');}chunks.push(value);}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  try{const body=JSON.parse(new TextDecoder().decode(buffer));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw fail('Invalid JSON.');}
}
function limit(key,max,windowMs=15*60*1000){
  const now=Date.now();for(const [k,v] of rateLimits)if(v.until<=now)rateLimits.delete(k);
  const entry=rateLimits.get(key)||{count:0,until:now+windowMs};
  if(entry.count>=max||(rateLimits.size>=2000&&!rateLimits.has(key)))throw fail('Too many attempts. Please try again in 15 minutes.',429,'RATE_LIMITED');
  entry.count++;rateLimits.set(key,entry);
}
async function issueSession(database,user){
  const token=randomHex(32);const now=Math.floor(Date.now()/1000);
  await database.prepare('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token),user.id,now,now+SESSION_SECONDS).run();
  return json(session(user),200,{'Set-Cookie':cookie(token)});
}
export async function authAPI(request,env={}){
  const path=new URL(request.url).pathname;
  if(path!=='/api/session'&&!path.startsWith('/api/auth/'))return null;
  try{
    if(path==='/api/session'){
      if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405,{Allow:'GET, HEAD'});
      const value=await getSession(request,env);
      return request.method==='HEAD'?new Response(null,{headers}):json(value);
    }
    if(!['/api/auth/register','/api/auth/login','/api/auth/logout'].includes(path))return json({error:'Not found'},404);
    if(request.method!=='POST')return json({error:'Method not allowed'},405,{Allow:'POST'});
    checkOrigin(request);
    const database=db(env);
    if(path==='/api/auth/logout'){
      const token=tokenFrom(request);if(token)await database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      return json(session(),200,{'Set-Cookie':cookie('',0)});
    }
    const ip=request.headers.get('cf-connecting-ip')||'local';
    limit('ip:'+ip,30);
    const body=await readBody(request);
    const email=normalizeEmail(body.email);const password=validatePassword(body.password);
    limit('email:'+await sha256(email),12);
    if(path==='/api/auth/register'){
      if(!roles.has(body.role))throw fail('Choose participant or clinic.');
      const displayName=typeof body.displayName==='string'?body.displayName.trim():'';
      if(displayName.length<2||displayName.length>80)throw fail('Use a display name of 2–80 characters.');
      const existing=await database.prepare('SELECT id FROM auth_users WHERE email = ?').bind(email).first();
      if(existing)throw fail('An account could not be created with these details. Try signing in.',409,'REGISTRATION_UNAVAILABLE');
      const salt=randomHex(16);const passwordHash=await hashPassword(password,salt);
      const user={id:crypto.randomUUID(),email,display_name:displayName,role:body.role};
      try{
        await database.prepare('INSERT INTO auth_users (id, email, display_name, role, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(user.id,email,displayName,body.role,passwordHash,salt,ITERATIONS,Math.floor(Date.now()/1000)).run();
      }catch(error){
        if(/unique|constraint/i.test(String(error?.message)))throw fail('An account could not be created with these details. Try signing in.',409,'REGISTRATION_UNAVAILABLE');
        throw error;
      }
      return await issueSession(database,user);
    }
    const user=await database.prepare('SELECT id, email, display_name, role, password_hash, password_salt, password_iterations FROM auth_users WHERE email = ?').bind(email).first();
    // Spend the same KDF work for unknown accounts and incorrect passwords.
    const candidate=await hashPassword(password,user?.password_salt||'00'.repeat(16),user?.password_iterations||ITERATIONS);
    if(!user||!equalHash(candidate,user.password_hash))throw fail('Email or password is incorrect.',401,'INVALID_CREDENTIALS');
    return await issueSession(database,user);
  }catch(error){
    const status=error.status||500;
    return json({error:error.code||'AUTH_UNAVAILABLE',message:status===500?'Account service is temporarily unavailable. Please try again later.':error.message},status,status===429?{'Retry-After':'900'}:{});
  }
}
export async function sessionResponse(request,env={}){return authAPI(request,env);}
