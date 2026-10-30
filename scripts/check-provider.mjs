import {analyze} from '../src/api.js';
process.stdout.write('Ready for secret on hidden stdin.\n');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
let data='';process.stdin.on('data',async chunk=>{data+=chunk.toString();if(!data.includes('\n'))return;process.stdin.pause();const key=data.trim();data='';
try{const result=await analyze({status:'Taking as prescribed',symptoms:{Nausea:'Mild'},details:'Mild nausea for three days.',contact:'Yes'},{AI_PROVIDER:'gemini',GEMINI_API_KEY:key,AI_MODEL:'gemini-2.5-flash'});console.log(JSON.stringify(result));process.exit(result.status===200?0:1);}catch{console.log('Provider test failed; credentials were not logged.');process.exit(1);}});
