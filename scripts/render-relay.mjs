import {readFile,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
// Provisioning must never start a second signer before the migration is complete.
if(process.env.SPONSOR_START_ENABLED!=='true'){
 console.log('Relay staged. Import the existing journal and private credentials before enabling. No transactions will be submitted.');
 await new Promise(resolve=>{const timer=setInterval(()=>{},60000);for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{clearInterval(timer);resolve();});});
}else{
 let privateDir;
 try{
  const directory=process.env.SPONSOR_STATE_DIR;
  if(!directory||!path.isAbsolute(directory))throw Error('An absolute persistent state directory is required.');
  const journalPath=path.join(directory,'journal.json');
  const j=JSON.parse(await readFile(journalPath,'utf8'));
  if(j.version!==1||j.network!=='Preprod'||!j.jobs||!j.sponsorAddress)throw Error('Import the existing Preprod sponsor journal first.');
  if((await stat(journalPath)).mode&0o077)throw Error('The imported journal must have mode 600.');
  privateDir=await mkdtemp(path.join(tmpdir(),'careloop-keys-'));
  const secretDir=process.env.RENDER_SECRET_DIR||'/etc/secrets';
  const seed=(await readFile(path.join(secretDir,'seed.txt'),'utf8')).trim();
  const key=(await readFile(path.join(secretDir,'blockfrost.key'),'utf8')).trim();
  if(![15,24].includes(seed.split(/\s+/).length)||!key.startsWith('preprod'))throw Error('Valid dedicated Preprod credentials are required.');
  for(const [name,value] of [['seed.txt',seed],['blockfrost.key',key]])await writeFile(path.join(privateDir,name),value,{mode:0o600,flag:'wx'});
  process.env.SPONSOR_SEED_FILE=path.join(privateDir,'seed.txt');
  process.env.SPONSOR_BLOCKFROST_KEY_FILE=path.join(privateDir,'blockfrost.key');
  await import('./sponsor-relay.mjs');
 }catch{console.error('Cloud relay not started. Check the private migration, permissions and credentials; no secrets are printed.');process.exitCode=1;}
 finally{if(privateDir)await rm(privateDir,{recursive:true,force:true});}
}
