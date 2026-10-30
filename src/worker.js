import {assets} from '../.local/assets.js';
import {api} from './api.js';
export default {async fetch(request,env){
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});
 const headers={'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'};
 return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers});
}};
