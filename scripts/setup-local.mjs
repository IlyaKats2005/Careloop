import {access, chmod, mkdir, readFile, writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateSeedPhrase, walletFromSeed} from '@lucid-evolution/lucid';

// Offline bootstrap: never connects to a provider or sends a transaction.
// Keep existing configurations and wallets intact when this command is rerun.
export async function setupLocal(root) {
  const envPath = path.join(root, '.env');
  try {
    await access(envPath);
    return {created: false};
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const directory = path.join(root, '.local', 'sponsor-wallet');
  await mkdir(directory, {recursive: true, mode: 0o700});
  await chmod(directory, 0o700);
  const seedPath = path.join(directory, 'seed.txt');
  let seed;
  try {
    seed = (await readFile(seedPath, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    seed = generateSeedPhrase();
    await writeFile(seedPath, seed + '\n', {flag: 'wx', mode: 0o600});
  }
  await chmod(seedPath, 0o600);
  const {address} = walletFromSeed(seed, {network: 'Preprod'});
  await writeFile(path.join(directory, 'address.txt'), address + '\n', {mode: 0o600});
  const template = await readFile(path.join(root, '.env.example'), 'utf8');
  const env = template
    .replace(/^SPONSOR_RELAY_TOKEN=.*$/m, 'SPONSOR_RELAY_TOKEN=' + randomBytes(32).toString('hex'))
    .replace(/^SPONSOR_SEED_FILE=.*$/m, 'SPONSOR_SEED_FILE=.local/sponsor-wallet/seed.txt');
  await writeFile(envPath, env, {flag: 'wx', mode: 0o600});
  return {created: true, address};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await setupLocal(path.resolve(fileURLToPath(new URL('..', import.meta.url))));
    if (result.created) {
      console.log('Created private .env and a new, unfunded Preprod sponsor wallet.');
      console.log('Sponsor receiving address: ' + result.address);
      console.log('Wallet backup: .local/sponsor-wallet/seed.txt (private; never commit or share).');
      console.log('Set GEMINI_API_KEY in .env, then run npm run build and npm run dev.');
      console.log('For real testnet rewards, fund and prepare this wallet as described in docs/RUNNING.md.');
    } else {
      console.log('Existing .env preserved. No credentials or wallets changed.');
      console.log('For manual configuration or an existing wallet, see docs/RUNNING.md.');
    }
  } catch {
    console.error('Setup could not finish. Check file permissions and existing configuration; preserve any existing wallet files.');
    process.exitCode = 1;
  }
}
