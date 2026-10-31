# Careloop

**A fictional research check-in becomes either an authorized reward or a visible hold. A private proof releases the reward on Cardano Preprod.**

[Open the app](https://careloop-study-prototype.perasperaadastra3008.chatgpt.site) · [Live demo guide](docs/LIVE-DEMO.md) · [Hackathon submission](docs/SUBMISSION.md) · [Masumi agent setup](integrations/masumi/README.md)

Careloop connects participants, study programs and clinics. Programs define their questionnaire, reporting schedule and AI review focus. The prototype includes medication follow-up and general wellbeing examples. It accepts **fictional data and disposable Preprod assets only**.

## The real workflow

1. A participant joins a clinic program with its invitation code and creates a private enrollment secret in the browser. The server stores the public commitment.
2. The participant submits a check-in. The server saves its original answers and program configuration, checks the reporting period and rejects a duplicate submission.
3. Gemini analyzes the report. Server policy decides whether completion qualifies for a reward or needs clarification. A successful model response is not, by itself, permission to spend funds. Model failure or unreliable output remains visible and does not silently pass.
4. An authorized submission is queued for the sponsor relay. The bounded relay funds a real **20-test-ADA smart-contract pool**, observes confirmation, and publishes its public deployment metadata. A held report waits for clinic review.
5. The participant browser generates a Groth16 proof using its local enrollment secret and selected payout address. The sponsor relay pays the transaction fees and submits a claim that transfers exactly **2 test ADA** to that address.
6. The UI separates approval, funding, proof preparation, transaction submission and **confirmed payment**. Its explorer link points to the transaction for that report. A fake database flag or an unrelated transaction cannot establish payment.

Clinical review is separate from reward eligibility. Concerning symptoms may require clinical follow-up without automatically removing a completion reward. AI cannot diagnose, determine that a participant is safe, or notify a doctor in this demo.

This workflow requires the sponsor relay to be online and funded. Network confirmation is asynchronous; “submitted” does not mean “paid.” See [the live walkthrough](docs/LIVE-DEMO.md) for the presentation sequence and recovery behavior. The guided Blockchain lab animation remains an educational illustration and is not payment evidence.

## Why blockchain

The sponsor commits the reward budget to a contract. A valid proof authorizes a scoped claim without publishing the questionnaire or enrollment secret. The contract checks the approved root, program, period, payout key, fixed reward and unused nullifier, then preserves the remaining pool state. Replaying that same claim cannot withdraw again from its pool.

The shared ledger records the payout and consumed claim independently of the application's database. It does not prove that a questionnaire is truthful, that a person is globally unique, or that the AI is clinically correct. The database still holds reports and account records. Authorization policy is an off-chain trust boundary.

## Two payment purposes, one network

| Flow | Who funds it | What receives payment | Implementation |
| --- | --- | --- | --- |
| Participant completion reward | Sponsor | Participant payout address | Custom Aiken/Plutus V3 pool + browser Groth16 proof |
| Paid questionnaire-analysis job | Sponsor/buyer | AI-service seller | Masumi escrow on Cardano Preprod |

The hosted questionnaire currently uses the configured Gemini API directly. It does **not** purchase a Masumi job for every form. The separate, reproducible [Masumi integration](integrations/masumi/README.md) demonstrates the qualifying paid agent service.

## Run the app locally

Requirements: Node.js **24+**, npm and Git.

```sh
git clone https://github.com/IlyaKats2005/Careloop.git
cd Careloop
npm ci
cp .env.example .env
chmod 600 .env
```

Edit the private `.env`: set `GEMINI_API_KEY`, keep `AI_PROVIDER=gemini` and `AI_MODEL=gemini-2.5-flash`. The API key is server-only. To use OpenRouter instead, set `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` and an available model identifier.

```sh
npm run build
node --env-file=.env scripts/dev.mjs
```

Open the printed URL, normally http://localhost:8787. Use `CARELOOP_PORT=8789` to select another port. Node's SQLite backs local accounts, reports and programs at ignored `.local/dev-data.sqlite`; restarting the server preserves them. Hosted deployments use Cloudflare D1 with schema migrations under `drizzle/`.

Create a clinic account and copy a program's invitation code. Create a participant account and join with that code, or use a private guest demo to explore both roles. Authentication uses ordinary email/password accounts. Accounts and invitation codes are demo access controls; they do not verify professional credentials or patient identity.

## Demo operations

Open **Sponsor** to reserve or release the clinic's AI and client reward budgets. Each new demo starts with 1,000 app credits: 750 unallocated, 200 for rewards and 50 for AI. Clinic balances and funding activity update automatically. **Refresh** updates the current reports and balances without resetting the run. A browser reload resumes the same workspace, participant, program and saved report. Only **Demo tools → Restart demo**, after confirmation, restores the starting balances and the three-enrolled/one-unenrolled cohort. Navigation is stored for this tab; questionnaire drafts remain in memory only. These app credits are separate from real test ADA, model-provider billing and the live payment allowance, which are not reset.

Open **Demo readiness** in the app to check the sponsor heartbeat and remaining budget. Check-in now includes enrollment creation and private recovery controls before submission. The screen labels the separate Masumi service and prior receipts explicitly.

- [Always-on worker deployment](deploy/README.md): Docker Compose package with persistent journal, restart policy and heartbeat health check. Requires a separately provisioned host.
- [Live rehearsal and ≤2.5-minute recording guide](docs/DEMO-REHEARSAL.md): both real outcomes and narration.

## Run the sponsor relay

The public website persists reports and the relay queue. The relay is a separate operator process that signs **Preprod-only** transactions with a dedicated sponsor wallet. It makes authenticated outbound requests; it needs no public inbound port or tunnel. For this hackathon the operator may run it on their computer, which must remain awake and connected.

Use a dedicated wallet with disposable Preprod ADA, never a mainnet wallet. Prepare a private seed file and, optionally, a private Blockfrost Preprod project-key file. Put their paths in `.env`; do not paste secrets into commands or commit the files. The example configuration includes:

```dotenv
SPONSOR_SITE_URL=https://careloop-study-prototype.perasperaadastra3008.chatgpt.site
SPONSOR_RELAY_TOKEN=
SPONSOR_SEED_FILE=
SPONSOR_BLOCKFROST_KEY_FILE=
SPONSOR_STATE_DIR=.local/sponsor-relay
SPONSOR_MAX_JOBS=4
SPONSOR_MAX_SPEND_ADA=100
```

Set the same strong relay token in the hosted server environment and the relay's private `.env`. Keep it out of client JavaScript. Obtain free test ADA from the [Cardano Preprod faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/). The default four-job budget needs approximately 100 test ADA, with extra liquidity/collateral useful for the wallet. The relay uses public Koios if no Blockfrost key file is configured.

```sh
# Read-only readiness check: does not submit transactions.
node --use-env-proxy --env-file=.env scripts/sponsor-relay.mjs --check

# Start the bounded relay. This command can submit Preprod transactions.
node --use-env-proxy --env-file=.env scripts/sponsor-relay.mjs
```

Keep `.local/sponsor-relay` across restarts. It contains transaction journals used to reconcile uncertain submissions. Do not delete journals and blindly retry: an already submitted transaction may still confirm. `--once` performs one poll and **can transact**; it is not a dry run. If the relay stops or its budget runs out, the app must show waiting/error status rather than a simulated payment.

Each approved report currently gets a separate experimental pool. A pool starts with 20 test ADA; a claim pays 2 test ADA and leaves 18. There is no refund/close path. Budget for those locked funds; this is not an efficient production pool design.

## Data and privacy

- Submitted answers, program snapshots, AI output, clinic decisions and public reward metadata live in the server database. A fresh sign-in can recover them on another device.
- Unsaved form drafts remain in memory. Private guest workspaces are associated with an `HttpOnly` cookie for seven days.
- Enrollment secrets and recovery files stay in the participant browser. Download a recovery file before switching devices or closing a tab with reward state. Signing in elsewhere does not recover that secret.
- The public chain receives proof/public inputs and transaction information, not the questionnaire or enrollment secret. Addresses, amounts, timing, program/period and nullifiers are public and may be linkable.
- The hosting operator can link accounts to stored reports. This email-account prototype does **not** guarantee that only a clinic can identify a participant.
- Fictional answers are sent to an external model provider. Do not enter real medical information.

## Verification and existing evidence

[Public transaction evidence](docs/preprod-demo.json) records completed tests on **Cardano Preprod, network magic 1**:

- **Masumi service payment:** seller received 1 test USDM. [Confirmed withdrawal](https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1).
- **Earlier patient reward:** real Groth16 proof, 2 test ADA paid, pool changed from 20 to 18 ADA and recorded its nullifier. [Funding](https://preprod.cardanoscan.io/transaction/f7b17e0f0f34ad3f8406c9f22e21e90c9c5d0c1fc33468ae32217013f88dbc13) · [Claim](https://preprod.cardanoscan.io/transaction/3cdc05fd37d24ce89529db27057ffdcd44b9eef40269888cc3ebf1faf6fa0b10).

Those historical receipts came from dedicated test wallets. They are **not** proof that a newly submitted website report has been paid. Use that report's fresh confirmed transaction for the live demonstration. New automatic-relay verification must be recorded separately after it completes.

```sh
npm test
node --test integrations/masumi/*.test.mjs
node scripts/test-zk.mjs
cd contracts
../node_modules/.bin/aiken check -m 'careloop/fixtures.{..}' -m 'careloop/state.{..}' -m 'rewards.{..}'
```

Tests cover authorization, server persistence, duplicate reports, model evidence validation, private-proof inputs, transaction-state verification and actual Plutus evaluation in the Lucid emulator. Unit/emulator success is separate from live network confirmation.

## Implementation map

| Component | Source |
| --- | --- |
| Participant/clinic UI and report state | `public/app.js` |
| Shared records and authorization | `src/data-api.js`, `src/auth.js`, `drizzle/` |
| AI adapter and response validation | `src/api.js` |
| Sponsor transaction worker | `scripts/sponsor-relay.mjs` |
| Browser enrollment/proof/payment state | `src/privacy-ui.js`, `src/zk-core.js`, `src/reward-status.js` |
| Cardano transactions and wallet integration | `src/cardano.js`, `src/cardano-wallet.js` |
| Circuit and validator | `zk/reward.circom`, `contracts/validators/rewards.ak` |
| Paid Masumi agent | `integrations/masumi/` |
| Educational and live blockchain views | `public/blockchain.js` |

## Limits

The AI is an untrained Gemini demo with per-program instructions, not a trained or clinically validated specialist. Clinic enrollment and identity verification remain demonstration controls. The database blocks repeated submissions for an enrollment/program/period; the contract blocks nullifier reuse within its pool. Creating another account or unrelated pool is not globally prevented by ZK.

The proof system uses an experimental single-machine development setup. The depth-3 tree includes synthetic entries; batches and one-period pools are not a production scalability design. There is no refund path, production security audit, email verification or password reset. No doctor is automatically contacted. Keep the demonstration to fictional inputs and test assets.

## Source provenance and licenses

Careloop's own source is GPL-3.0-or-later. Existing upstream files retain their notices.

- Poseidon BLS12-381 circuit: Cardano Foundation `bls`, commit `3f43b60c92beb98a43331a00ae6a5ec1316acce1`; notice retained in `zk/vendor/poseidon_bls12_381.circom`.
- Vendored Aiken stdlib v3.1.0, commit `7d5cee54b2bb4eea211ae3bd806c7c39e5fd899d`; `contracts/STDLIB-LICENSE`.
- snarkjs 0.7.6: GPL-3.0; `public/SNARKJS-LICENSE`.
- Masumi integration adapted from the [official TUM quickstart](https://github.com/masumi-network/tum-hackathon-quickstart), with Careloop's fictional-questionnaire client, payment verification and recovery logic. See its integration README for provenance and dependencies.

Do not commit environment files, runtime journals, account credentials, wallet seeds, private recovery files or database contents.
