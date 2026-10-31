# Run your own Careloop environment

[Public demo](https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/) · [Repository](https://github.com/IlyaKats2005/Careloop) · [Architecture](ARCHITECTURE.md)

All commands below run from **your cloned repository**, using **your own credentials and test wallets**. You do not need the original developer's computer, private environment files or hosted database.

## Choose what to test

| Goal | What you need |
| --- | --- |
| Explore the shared public demo | A browser. Visitors need no Terminal; live payouts depend on the demo operator's funded relay. |
| Run the app and AI locally | Node.js 24.5+, npm, Git and your own Gemini API key. Node includes local SQLite; no separate database installation. |
| Test contracts and proofs offline | `npm ci`, `npm test`. Real Groth16 proofs and compiled Plutus scripts run in the emulator; no wallet funds or API credentials. |
| Pay participants on Cardano Preprod | Your local app, a funded disposable sponsor wallet, its relay, internet access and the participant browser for proof generation. |
| Reproduce a paid Masumi AI job | Separate Masumi setup, buyer/seller test wallets, test USDM and a model key; [integration guide](../integrations/masumi/README.md). |

## Install and start

Install Node.js **24.5 or newer**, npm and Git. Node 26 is the tested runtime. Then:

```sh
git clone https://github.com/IlyaKats2005/Careloop.git
cd Careloop
npm ci
npm run setup
```

The offline setup creates:

- `.env`: server configuration, a random relay token and the local API URL.
- `.local/sponsor-wallet/seed.txt`: a new, unfunded disposable sponsor wallet with owner-only permissions.
- `.local/sponsor-wallet/address.txt`: its public Preprod receiving address, also printed by setup.

It does not send transactions, request funds or contact a service. Rerunning it preserves an existing `.env` and wallet. Back up private wallet material if you fund it. None of these generated files is tracked by Git.

Open `.env` in your editor. Set your own `GEMINI_API_KEY`; keep `AI_PROVIDER=gemini` and `AI_MODEL=gemini-2.5-flash`. Get a key through [Google AI Studio](https://aistudio.google.com/apikey); model access and quota depend on your provider account. OpenRouter is also supported: set `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` and a model available to your account.

```sh
npm run build
npm run dev
```

Open **http://localhost:8787**. Keep this process running. `npm run dev` loads `.env` automatically. To change the port, set `CARELOOP_PORT` in `.env` and update `SPONSOR_SITE_URL` to match.

The interface works without a model key, but analysis shows a configuration error instead of inventing an AI result. For a complete report-to-payment demonstration, configure the model and fund the relay below.

Local accounts, reports, budgets and payment jobs persist in `.local/dev-data.sqlite`. The schema is created automatically. The hosted installation uses D1; its data is not copied into your local app.

### Existing configuration or wallet

If you already have `.env`, setup leaves it untouched. Compare it with `.env.example` and fill the needed settings yourself. For manual setup, copy `.env.example` to `.env`, generate a private relay token (at least 32 characters), and point `SPONSOR_SEED_FILE` to your own 15- or 24-word disposable wallet seed file. Both the API and relay must read the same token. Protect `.env` and seed/key files with owner-only permissions (`chmod 600` on macOS/Linux).

## Try the participant workflow

1. Choose **Try participant demo**. **Demo tools → Choose participant** offers Alex, Maya and Noah enrolled, and Sam ready to demonstrate enrollment. **View as** switches to clinic or sponsor.
2. The predefined profiles use public demonstration receiving addresses. You can inspect their payments, but the repository does not contain their spending keys. To receive funds in a wallet you control, register your own participant account with your Preprod address, create a clinic account in another browser session, and join its program using its invitation code. A participant receiving a sponsored reward needs no funds for fees.
3. Submit fictional, internally consistent answers. An ordinary qualifying report should be authorized without an extra clinic approval click. Clinical review and completion rewards are separate decisions.
4. With the relay configured, keep **My rewards**, **My reports** or the report open in the same browser. Its enrollment secret generates the proof after funding confirms. If the secret is missing, restore its private enrollment recovery file.
5. Wait for **confirmed payment**, then inspect that report's transaction: the participant receives **2 test ADA**. Queued, approved and submitted are intermediate states.

**Refresh** updates the current run. Browser reload preserves saved records. **Demo tools → Restart demo** explicitly starts a new run after confirmation, restoring starting app credits and the cohort. It cannot reverse transactions, refill the sponsor wallet or reset live payment limits. Account login alone does not recover a browser enrollment secret.

## Enable real Preprod rewards

The generated `.env` already contains matching local API/relay settings:

```dotenv
SPONSOR_SITE_URL=http://localhost:8787
# SPONSOR_RELAY_TOKEN is generated privately by npm run setup.
SPONSOR_SEED_FILE=.local/sponsor-wallet/seed.txt
SPONSOR_BLOCKFROST_KEY_FILE=
SPONSOR_STATE_DIR=.local/sponsor-relay
SPONSOR_MAX_JOBS=4
SPONSOR_MAX_SPEND_ADA=100
```

### Fund and prepare your sponsor wallet

1. Copy the **public address** printed by setup, also saved in `.local/sponsor-wallet/address.txt`.
2. Request free test ADA for it from the [Cardano Preprod faucet](https://faucet.preprod.world.dev.cardano.org/basic-faucet). Use Preprod, not Preview or mainnet. The faucet may require a human CAPTCHA. Wait for confirmation.
3. Prepare separate wallet outputs: one pure-ADA output of **at least 25 test ADA** and another of **at least 5 test ADA** for collateral. One large faucet output alone may not suffice. Import this disposable seed into a Cardano wallet configured for Preprod and use its output-splitting/collateral controls to retain both outputs. If it supports selecting inputs, a 30-ADA self-transfer followed by a 5-ADA self-transfer from the remaining change creates these outputs; do not consume the first output in the second transfer. Alternatively, set `SPONSOR_SEED_FILE` to an existing funded Preprod wallet with suitable outputs.
4. Keep at least about **100 test ADA** available for the default four-job allowance, including fees and collateral. Each report locks 20; a 2-ADA claim leaves 18 locked. There is no refund function.

Public Koios is the default provider. Optionally store your own **Preprod** Blockfrost key in a private mode-600 file and set `SPONSOR_BLOCKFROST_KEY_FILE` to its path. Receipt checks also use Koios, so its availability still matters.

### Start the worker

Leave `npm run dev` running. In a second terminal, open the same cloned repository:

```sh
npm run relay:check
npm run relay
```

`relay:check` reads the sponsor address, balance, output count and server status. It does not submit transactions, validate the token against a protected route, or guarantee suitable collateral. `relay` authenticates, heartbeats and submits Preprod transactions for approved jobs within its limits. Check **Demo tools → Check payment service → Check service** for a fresh online status. `relay_ready` means wallet initialization succeeded; a subsequent `relay_waiting` or `job_waiting` message explains a remaining problem.

Run one worker for this wallet. Preserve `.local/sponsor-relay/`: its journal holds signed bytes and transaction history for recovery. Do not delete it to reset limits or retry uncertain payments. `--once` can transact; it is not a dry run. Ctrl+C stops the worker. API job limits and relay spending limits apply independently of the displayed app credits.

The operator keeps the local server and relay running; participants only use browsers. After the proof is sent, the relay keeps checking confirmation even if the participant closes the tab.

## Validate without external credentials

After `npm ci`:

```sh
npm test
npm run test:masumi
```

The application suite evaluates serialized Plutus funding/claim transactions in the Lucid emulator, generates a real Groth16 proof, rejects tampering/repeated claims, and checks server, budget and UI behavior. These commands do not buy AI calls or submit network transactions. Masumi tests use fixtures for payment validation and recovery.

For direct Aiken validator checks:

```sh
cd contracts
../node_modules/.bin/aiken check -m 'careloop/fixtures.{..}' -m 'careloop/state.{..}' -m 'rewards.{..}'
cd ..
```

Committed WASM, proving key, verification key and contract blueprint are sufficient to run the demo. Do not regenerate the experimental trusted setup just to run the app. `node scripts/test-zk.mjs` additionally checks substitutions of every public input and writes a new proof into the tracked Aiken fixtures; use a disposable checkout to avoid fixture changes.

Verify historical paid-job hashes with [the public evidence instructions](evidence/README.md). Historical receipts prove those recorded runs, not a newly submitted report.

## Separate paid AI service

The website calls Gemini directly; the participant relay does not buy Masumi jobs. To reproduce the **1-test-USDM** paid analysis, follow [the Masumi integration guide](../integrations/masumi/README.md), including your own Payment Service, database, seller registration and buyer funding. Its Standard API route does not require a Sokosumi Coworker account; the Coworker worker is an alternative route. These are not bundled public services.

## Host your own installation

The shared public website and D1 database are hosted. Its sponsor worker is a separate operator process. [Docker Compose](../deploy/README.md) and [Render](../deploy/RENDER.md) relay deployment files are provided, but do not establish that a cloud worker is running.

For your hosted app, configure the same private relay token on the API and worker and set `SPONSOR_SITE_URL` to **your app's HTTPS origin**. A new clone has no permission to sign for the shared public demo. When moving an existing worker, stop the old signer, migrate its complete journal and dedicated wallet privately, and run one instance on the new host.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Unknown Node flag or missing `node:sqlite` | Install Node 24.5+; confirm `node --version`. |
| AI analysis failed | Set your model key in `.env`, restart `npm run dev`, check provider access/quota. |
| Reward queued | Relay heartbeat, matching API URL/token, server allowance and real wallet funds. |
| Unauthorized relay | API and relay need the same token; restart the API after editing `.env`. |
| Insufficient collateral / no suitable input | Prepare separate pure-ADA funding and collateral outputs. |
| Budget exhausted | App credits, server job allowance, relay limit and real test ADA are separate. |
| Funding/claim submitted | Wait for confirmation; preserve the hash and journal. |
| Waiting for proof | Open the participant report/rewards in the browser holding the enrollment secret. |
| Completion on hold | Inspect the actual policy reason. Clinical review alone does not block payment. |
