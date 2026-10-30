// Fixed Preview-only bridge: browsers cannot reliably call Koios across origins.
const endpoints=new Map([['epoch_params','GET'],['totals','GET'],['asset_addresses','GET'],['address_info','POST'],['tx_info','POST'],['account_info','POST'],['datum_info','POST'],['tx_status','POST'],['submittx','POST'],['ogmios','POST']]);
const buckets=new Map();
export async function cardanoProxy(request,fetcher=fetch){
 const url=new URL(request.url),endpoint=url.pathname.slice('/cardano/'.length);
 if(endpoints.get(endpoint)!==request.method)return new Response('Unsupported Preview request',{status:404});
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return new Response('Origin rejected',{status:403});
 const ip=request.headers.get('cf-connecting-ip')||'local',now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000){b={start:now,count:0};if(buckets.size>10000)buckets.clear();buckets.set(ip,b);}if(++b.count>90)return new Response('Try again shortly',{status:429});
 let body;if(request.method==='POST'){const reader=request.body?.getReader(),chunks=[];let length=0;while(reader){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>131072){await reader.cancel();return new Response('Request too large',{status:413});}chunks.push(value);}body=new Uint8Array(length);let i=0;for(const c of chunks){body.set(c,i);i+=c.length;}}
 if(endpoint==='ogmios'){try{if(JSON.parse(new TextDecoder().decode(body)).method!=='evaluateTransaction')return new Response('Only evaluation allowed',{status:400});}catch{return new Response('Invalid request',{status:400});}}
 try{const response=await fetcher('https://preview.koios.rest/api/v1/'+endpoint+url.search,{method:request.method,headers:{'Content-Type':endpoint==='submittx'?'application/cbor':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(15000)});return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}catch{return Response.json({error:'Preview provider unavailable. Please retry.'},{status:502});}
}
