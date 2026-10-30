import constants from './poseidon-constants.js';
export const FIELD=BigInt('0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001');
const C=constants.POSEIDON_C.map(BigInt), M=[constants.POSEIDON_M0,constants.POSEIDON_M1,constants.POSEIDON_M2].map(r=>r.map(BigInt));
export function field(x){const v=BigInt(x);if(v<0n||v>=FIELD)throw Error('Non-canonical field element');return v;}
export function hash(a,b){let s=[0n,field(a),field(b)]; for(let r=0;r<65;r++){s=s.map((v,i)=>(v+C[r*3+i])%FIELD);s=s.map((v,i)=>r<4||r>=61||i===0?(v**5n)%FIELD:v);s=M.map(row=>row.reduce((v,c,i)=>(v+c*s[i])%FIELD,0n));}return s[0];}
export const config={program:'1',period:'5',amount:'2000000',domain:'20261030'};
export function commitment(secret){return hash(1n,secret).toString();}
export function scope(c=config){return hash(c.domain,hash(c.program,c.period));}
export function leaf(commit,c=config){return hash(hash(commit,scope(c)),c.amount).toString();}
export function randomSecret(){let x;do{x=BigInt('0x'+Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join(''));}while(x===0n||x>=FIELD);return x.toString();}
export function tree(leaves,index){if(leaves.length!==8||!Number.isInteger(index)||index<0||index>=8)throw Error('Eight leaves required');let row=leaves.map(field),siblings=[],directions=[],i=index;while(row.length>1){siblings.push(row[i^1].toString());directions.push(String(i%2));row=Array.from({length:row.length/2},(_,j)=>hash(row[j*2],row[j*2+1]));i=Math.floor(i/2);}return {root:row[0].toString(),siblings,directions};}
export function witness(secret,path,recipient,c=config){const nullifier=hash(secret,scope(c)).toString();return {...c,...path,secret,recipient:field(recipient).toString(),nullifier,binding:hash(nullifier,recipient).toString()};}
export function signals(w){return ['root','nullifier','program','period','amount','recipient','domain','binding'].map(k=>field(w[k]).toString());}
// Executable local ledger model, NOT a substitute for the Cardano validator.
export async function acceptClaim(state,claim,verify){const p=claim.publicSignals;if(!Array.isArray(p)||p.length!==8)throw Error('Invalid public inputs');p.forEach(field);if(p[0]!==state.root||p[2]!==state.program||p[3]!==state.period||p[4]!==state.amount||p[6]!==state.domain)throw Error('Approval or program mismatch');if(state.used.includes(p[1]))throw Error('Already claimed for this period');if(claim.recipient!==p[5])throw Error('Recipient mismatch');if(!await verify(claim))throw Error('Invalid proof');if(state.balance<BigInt(p[4]))throw Error('Insufficient budget');return {...state,used:[...state.used,p[1]],balance:state.balance-BigInt(p[4])};}
