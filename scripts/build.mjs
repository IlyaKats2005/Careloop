import {build} from 'esbuild';
import {wasmLoader} from 'esbuild-plugin-wasm';
import {readFile,writeFile,mkdir,cp,rm,readdir} from 'node:fs/promises';
await build({entryPoints:['src/payments-view.js'],outfile:'public/payments.js',bundle:true,format:'iife',globalName:'CareloopPayments',platform:'browser',target:'es2022'});
await build({entryPoints:['src/programs.js'],outfile:'public/programs.js',bundle:true,format:'iife',globalName:'CareloopPrograms',platform:'browser',target:'es2022'});
await build({entryPoints:['src/privacy-ui.js'],outfile:'public/privacy.js',bundle:true,format:'iife',platform:'browser',target:'es2022',external:['/chain/wallet.js']});
await rm('public/chain',{recursive:true,force:true});
await build({entryPoints:['src/cardano-wallet.js'],outfile:'public/chain/wallet.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,plugins:[wasmLoader()],publicPath:'/chain/'});
await cp('contracts/plutus.json','public/zk/plutus.json');
await cp('node_modules/snarkjs/build/snarkjs.min.js','public/snarkjs.min.js');
const files=['index.html','app.js','payments.js','blockchain.js','blockchain.css','programs.js','style.css','privacy.js','snarkjs.min.js','zk/reward.wasm','zk/reward.zkey','zk/verification_key.json','SNARKJS-LICENSE','zk/plutus.json',...(await readdir('public/chain')).map(f=>'chain/'+f)];
const types={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json','wasm':'application/wasm','zkey':'application/octet-stream'};
let embedded='export const assets={\n';
for(const f of files){const bytes=await readFile('public/'+f);embedded+=JSON.stringify('/'+f)+':'+JSON.stringify({type:types[f.split('.').at(-1)]||'text/plain',base64:bytes.toString('base64')})+',\n';}
embedded+='};\n';await mkdir('.local',{recursive:true});await writeFile('.local/assets.js',embedded);
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['src/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
// Sites applies these schema migrations to the hosted D1 binding before upload.
// package-site.mjs also copies root drizzle/ into this artifact location.
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Worker artifact built.');
