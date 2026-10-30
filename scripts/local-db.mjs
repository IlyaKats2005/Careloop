import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Development only: a small D1-compatible adapter around Node's SQLite.
// Production receives its DB binding from Sites and never imports this module.
function boundValue(value){
  if(value===null||typeof value==='string')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  throw new TypeError('Unsupported database binding type; use a string, finite number, null or binary data.');
}

function applyMigrations(sqlite,directory){
  const journal=JSON.parse(readFileSync(resolve(directory,'meta/_journal.json'),'utf8'));
  if(journal.dialect!=='sqlite'||!Array.isArray(journal.entries))throw Error('Invalid local migration journal.');
  const entries=[...journal.entries].sort((a,b)=>a.idx-b.idx),seen=new Set();
  for(const [index,entry] of entries.entries()){
    if(entry.idx!==index||typeof entry.tag!=='string'||!/^[a-zA-Z0-9_]+$/.test(entry.tag)||seen.has(entry.tag))throw Error('Invalid local migration order.');
    seen.add(entry.tag);
  }
  sqlite.exec('CREATE TABLE IF NOT EXISTS _careloop_local_migrations (tag TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const applied=new Map(sqlite.prepare('SELECT tag, checksum FROM _careloop_local_migrations').all().map(row=>[row.tag,row.checksum]));
  for(const tag of applied.keys())if(!seen.has(tag))throw Error('Local database contains a migration absent from this checkout.');
  for(const entry of entries){
    const sql=readFileSync(resolve(directory,entry.tag+'.sql'),'utf8');
    const checksum=createHash('sha256').update(sql).digest('hex');
    if(applied.has(entry.tag)){
      if(applied.get(entry.tag)!==checksum)throw Error('An applied local migration has changed: '+entry.tag);
      continue;
    }
    sqlite.exec('BEGIN IMMEDIATE');
    try{
      sqlite.exec(sql);
      sqlite.prepare('INSERT INTO _careloop_local_migrations (tag, checksum, applied_at) VALUES (?, ?, ?)').run(entry.tag,checksum,Math.floor(Date.now()/1000));
      sqlite.exec('COMMIT');
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
}

export function createLocalDatabase({filename=resolve('.local/dev-data.sqlite'),migrationsDirectory=resolve('drizzle')}={}){
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true,mode:0o700});
  const sqlite=new DatabaseSync(filename);
  try{
    if(filename!==':memory:')chmodSync(filename,0o600);
    sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    applyMigrations(sqlite,migrationsDirectory);
  }catch(error){sqlite.close();throw error;}

  const owner=Symbol('local-d1');
  class Statement{
    constructor(sql,values=[]){this.sql=sql;this.values=values;this.owner=owner;}
    bind(...values){return new Statement(this.sql,values.map(boundValue));}
    async first(column){
      const row=sqlite.prepare(this.sql).get(...this.values);
      if(!row)return null;
      if(column===undefined)return {...row};
      if(!Object.hasOwn(row,column))throw Error('Requested database column was not found.');
      return row[column];
    }
    execute(){
      const start=performance.now(),statement=sqlite.prepare(this.sql);
      if(statement.columns().length){
        const results=statement.all(...this.values).map(row=>({...row}));
        return {success:true,results,meta:{duration:performance.now()-start,changes:0,rows_read:results.length,rows_written:0}};
      }
      const result=statement.run(...this.values),changes=Number(result.changes);
      return {success:true,results:[],meta:{duration:performance.now()-start,changes,last_row_id:Number(result.lastInsertRowid),rows_read:0,rows_written:changes}};
    }
    async all(){return this.execute();}
    async run(){return this.execute();}
  }
  return {
    prepare(sql){if(typeof sql!=='string'||!sql.trim())throw new TypeError('SQL statement required.');return new Statement(sql);},
    async batch(statements){
      if(!Array.isArray(statements)||statements.some(statement=>!(statement instanceof Statement)||statement.owner!==owner))throw new TypeError('Batch requires statements from this database.');
      sqlite.exec('BEGIN IMMEDIATE');
      try{const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results;}
      catch(error){sqlite.exec('ROLLBACK');throw error;}
    },
    close(){sqlite.close();},
  };
}
