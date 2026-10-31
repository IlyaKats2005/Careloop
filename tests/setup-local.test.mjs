import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, cp, stat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {walletFromSeed} from '@lucid-evolution/lucid';
import {setupLocal} from '../scripts/setup-local.mjs';

async function directory(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'careloop-setup-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  await cp(new URL('../.env.example', import.meta.url), path.join(root, '.env.example'));
  return root;
}

test('fresh setup creates independent local credentials and a matching private testnet wallet', async t => {
  const a = await directory(t), b = await directory(t);
  const first = await setupLocal(a), second = await setupLocal(b);
  assert.equal(first.created, true);
  const env = parseEnv(await readFile(path.join(a, '.env'), 'utf8'));
  const other = parseEnv(await readFile(path.join(b, '.env'), 'utf8'));
  assert.equal(env.SPONSOR_SITE_URL, 'http://localhost:8787');
  assert.match(env.SPONSOR_RELAY_TOKEN, /^[a-f0-9]{64}$/);
  assert.notEqual(env.SPONSOR_RELAY_TOKEN, other.SPONSOR_RELAY_TOKEN);
  assert.notEqual(first.address, second.address);
  const seedPath = path.join(a, env.SPONSOR_SEED_FILE);
  const seed = (await readFile(seedPath, 'utf8')).trim();
  assert.equal(walletFromSeed(seed, {network: 'Preprod'}).address, first.address);
  assert.match(first.address, /^addr_test1/);
  assert.equal((await stat(seedPath)).mode & 0o777, 0o600);
  assert.equal((await stat(path.join(a, '.env'))).mode & 0o777, 0o600);
  assert.equal((await stat(path.dirname(seedPath))).mode & 0o777, 0o700);
});

test('rerunning setup preserves an existing environment and wallet byte for byte', async t => {
  const root = await directory(t);
  await setupLocal(root);
  const seedPath = path.join(root, '.local/sponsor-wallet/seed.txt');
  const seed = await readFile(seedPath, 'utf8');
  const envPath = path.join(root, '.env');
  const env = (await readFile(envPath, 'utf8')) + '\n# Existing operator settings\n';
  await writeFile(envPath, env);
  assert.deepEqual(await setupLocal(root), {created: false});
  assert.equal(await readFile(envPath, 'utf8'), env);
  assert.equal(await readFile(seedPath, 'utf8'), seed);
});
