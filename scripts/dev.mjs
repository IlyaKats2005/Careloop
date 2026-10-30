import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {cardanoProxy} from '../src/cardano-proxy.js';
import {api} from '../src/api.js';
import {createLocalDatabase} from './local-db.mjs';
const port=Number(process.env.CARELOOP_PORT||8787);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('CARELOOP_PORT must be a valid port number.');
const DB=createLocalDatabase(),env={...process.env,DB};
const root=resolve('public'), types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
 const base=new URL('http://'+(req.headers.host||'localhost:'+port));
 if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||!req.url.startsWith('/')){res.writeHead(400);res.end('Invalid local request');return;}
 const url=new URL(req.url,base);let response;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/cardano/')){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>131072){res.writeHead(413,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Request too large'}));return;}chunks.push(c);}response=await (url.pathname.startsWith('/cardano/')?(r=>cardanoProxy(r)):api)(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);
 }else{const f=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!f.startsWith(root+'/'))throw Error('Invalid path');response=new Response(await readFile(f),{headers:{'Content-Type':types[extname(f)]||'application/octet-stream'}});}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){
  const isAPI=req.url?.startsWith('/api/')||req.url?.startsWith('/cardano/');
  if(isAPI){console.error('Local API request failed.',{name:error?.name,code:error?.code});res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'LOCAL_REQUEST_FAILED',message:'The local request could not be completed.'}));}
  else{res.writeHead(404);res.end('Not found');}
 }});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://localhost:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{DB.close();process.exit(0);}));
