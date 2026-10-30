import {readFile} from 'node:fs/promises';
import path from 'node:path';
try {
 const state=JSON.parse(await readFile(path.resolve(process.env.SPONSOR_STATE_DIR||'.local/sponsor-relay','health.json'),'utf8'));
 if(!Number.isSafeInteger(state.pid)||state.network!=='Preprod'||!Number.isFinite(state.lastHeartbeat)||Date.now()-state.lastHeartbeat>90000||state.lastHeartbeat>Date.now()+5000)throw Error();
 process.kill(state.pid,0);
 console.log('Preprod relay heartbeat is current.');
} catch { console.error('Relay heartbeat unavailable or stale.'); process.exitCode=1; }
