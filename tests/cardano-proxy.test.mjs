import test from 'node:test';import assert from 'node:assert/strict';import {cardanoProxy} from '../src/cardano-proxy.js';
test('Preprod bridge never proxies arbitrary paths or cross-origin submissions',async()=>{
 const f=()=>{throw Error('Must not fetch')};
 assert.equal((await cardanoProxy(new Request('https://demo/cardano/mainnet'),f)).status,404);
 assert.equal((await cardanoProxy(new Request('https://demo/cardano/submittx',{method:'POST',headers:{Origin:'https://evil'},body:'abc'}),f)).status,403);
 assert.equal((await cardanoProxy(new Request('https://demo/cardano/ogmios',{method:'POST',body:JSON.stringify({method:'submitTransaction'})}),f)).status,400);
});
test('Preprod bridge forwards signed CBOR intact to the fixed Preprod host',async()=>{
 const bytes=new Uint8Array([1,2,3]);let seen=false;
 const response=await cardanoProxy(new Request('https://demo/cardano/submittx',{method:'POST',body:bytes}),async(url,options)=>{seen=true;assert.equal(url,'https://preprod.koios.rest/api/v1/submittx');assert.deepEqual(options.body,bytes);assert.equal(options.headers['Content-Type'],'application/cbor');return Response.json('a'.repeat(64));});
 assert.equal(response.status,200);assert.ok(seen);
});
