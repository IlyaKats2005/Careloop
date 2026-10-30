import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {cardanoProxy} from '../src/cardano-proxy.js';
import {api} from '../src/api.js';
const root=resolve('public'), types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:8787');let response;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/cardano/')){const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>131072){res.writeHead(413);res.end();return;}chunks.push(c);}response=await (url.pathname.startsWith('/cardano/')?(r=>cardanoProxy(r)):api)(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),process.env);
 }else{const f=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!f.startsWith(root+'/'))throw Error('Invalid path');response=new Response(await readFile(f),{headers:{'Content-Type':types[extname(f)]||'application/octet-stream'}});}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(404);res.end('Not found');}});
server.listen(8787,'127.0.0.1',()=>console.log('Local: http://localhost:8787'));
