# Careloop — configurable research follow-up demo

Fictional questionnaire → external AI suggestion → human clinic approval → browser-generated Groth16 proof → wallet-signed Cardano Preprod reward.

## Implemented

- Participant and clinic workspaces, email/password accounts, clinic invitation codes, and a private guest demo, backed by server-side storage.
- Configurable programs with their own questionnaire topics, schedule, review focus and report history. GLP-1 follow-up is one of three starting examples.
- Submission automatically requests AI analysis. AI status, human clinic review and payment confirmation are shown separately; preloaded examples are kept outside submitted history.
- Server-only Gemini / OpenRouter adapter, with timeouts, bounded inputs, JSON/evidence checks and explicit errors. Saved-report analysis runs through the report endpoint; `POST /api/analyze` remains a fictional-input demo adapter. The model cannot approve payment.
- Real **Groth16 over BLS12-381** proof generation and verification in the participant browser. The enrollment secret stays local; the server stores the public commitment and approval witness.
- Circom approval-membership circuit, including program/period/domain scoping, a deterministic nullifier and payout-key binding.
- Compiled Aiken Plutus V3 reward validator, plus one-shot state-NFT minting policy. Actual generated proofs are tested in Aiken.
- Demonstrations of duplicate-claim and changed-recipient rejection.

## Accounts and data

`src/auth.js` implements registration, login, logout and session lookup. Hosted account records live in the Sites-provisioned Cloudflare D1 `DB` binding. Passwords are salted and hashed with PBKDF2; sessions use random tokens in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie, with only token hashes stored in D1. The account role selects a participant or clinic **demo** workspace. It does not verify a clinic, professional credentials or the identity of a patient. Email verification and password reset are not implemented.

`src/data-api.js` stores program configurations, enrollments, submitted questionnaires, AI results, clinic decisions and approval snapshots in D1. Each clinic account owns its workspace. A participant joins a program using its invitation code, sees their own reports, and shares those reports with the owning clinic. Authorization is checked on the server; changing a browser role cannot grant access to another workspace. Signed-in records can be loaded on another device. The app exposes participant pseudonyms to the clinic workspace; this is still a fictional-data demo, not a production medical record or fully anonymous system.

Guest mode creates a separate server workspace protected by a random `HttpOnly` cookie, with seven-day access. It supports both demo roles without mixing data with other visitors. Unsaved drafts remain in memory and are lost on reload. Earlier browser-only demo data is preserved locally but is not automatically imported into the new server workspace.

Enrollment secrets and private recovery material remain in browser storage, separated by account or guest state. Signing into another device restores saved reports, **not the private enrollment secret**. Download and protect the recovery file before changing devices or closing a tab with a funded pool.

## Programs and AI routing

`src/programs.js` defines and validates the starting program registry. Clinic demo users can create or edit programs through **Programs → Create program**: name, reporting cadence, symptom/experience topics, optional medication choices, concern checkboxes, question wording and AI review focus. Empty medication choices remove treatment and dosing questions. The current on-chain reward remains fixed at **2 test ADA**; creating a program does not deploy or fund a contract.

Every submitted report retains a snapshot of its program configuration. Future program edits affect new check-ins, while AI retries use the original report's configuration. The server validates that configuration and sends it as untrusted context alongside the answers to the configured external model. Programs currently share the Gemini demo model with different review context; dedicated trained models and clinical validation remain future work. Client configuration cannot supply a model endpoint, API key or a claim that a model is clinically validated.

## Report workflow

1. A participant completes the selected program's questionnaire and confirms that the data is fictional.
2. Submission saves the original answers and program snapshot on the server, then starts AI analysis. Its result or failure is saved with the report. A failure remains visible and retryable; it never becomes a fabricated result.
3. The clinic reviews the original answers and any AI suggestion, then records its own decision. Concern checkboxes are rule flags, not AI conclusions or completed clinical reviews.
4. The clinic separately approves eligibility and completion. Symptoms do not automatically remove the reward, and approval does not move money.
5. The sponsor funds the reward pool; the participant prepares a proof and signs a claim. Submitted transaction hashes and pool metadata can be saved with the report, but the server labels them **unverified**. A report is shown as paid only after the browser verifies its bound claim transaction and corresponding nullifier against the matching on-chain pool. A database payment label alone is not settlement evidence.

Preloaded examples are read-only illustrations. They do not represent submitted reports, AI calls or payments. The public AI endpoint continues to accept explicit fictional guest-demo input; password login does not turn it into a production clinical service.

## Not connected / not production

- Hosted Gemini calls are configured and tested. Local development needs a server-side provider key. There is **no silent fake response fallback**.
- Cardano Preprod funding and claiming transactions are implemented and evaluated with Lucid. Submission requires the user’s connected wallet signature. No live transaction is claimed without a confirmed hash. Browser session storage preserves the enrollment across reloads; private recovery export is available. On-chain state enforces duplicate prevention within a funded pool.
- Account authentication, workspace authorization and a shared clinic review queue are implemented, but there is no verified clinic membership, production medical record security or identity deduplication. Guest role switching and the eight-entry approval batch remain fictional demonstration controls.
- No clinical validation, private payment rail, or anonymity guarantee. Program, period, amount, recipient and nullifier are public. Small batches, timing, known wallets, repeated recipients and network metadata can reveal connections.
- Development-only single-machine setup. Do not use real funds. Review circuit and upstream hash parameters, perform an independent security audit and a suitable ceremony before any production deployment.
- AI requests may be processed/stored by the external model provider. Only fictional input is permitted. Removing a name does not make a clinical narrative anonymous.
- Both the Masumi/Sokosumi service-payment flow and the patient-reward pool now target **Cardano Preprod**. They still use separate contracts and payment flows: Masumi pays the AI service; this pool rewards the participant. Sharing a network does not connect them automatically, and the Masumi payment is not evidence of a live patient claim.

## Verified on Cardano Preprod

Both payment flows have completed on **Preprod (network magic 1)** using disposable test funds. Public evidence is recorded in [`docs/preprod-demo.json`](docs/preprod-demo.json).

- **Masumi AI-service payment:** the seller received exactly **1 test USDM**. [Confirmed withdrawal](https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1).
- **Patient reward:** a real Groth16 proof passed the on-chain Plutus V3 validator and paid exactly **2 test ADA** to a separate demonstration participant. [Confirmed claim](https://preprod.cardanoscan.io/transaction/3cdc05fd37d24ce89529db27057ffdcd44b9eef40269888cc3ebf1faf6fa0b10). The pool retained its state NFT, decreased from 20 to 18 test ADA, and recorded the nullifier.
- A repeated claim preparation was rejected using the confirmed on-chain nullifier. No duplicate transaction was broadcast. Validator-level tamper/duplicate tests also run in the emulator.

The live patient test used dedicated local signing wallets. The website wallet flow remains separately signed by the connected browser wallet; this receipt is not evidence of real clinic authentication or a trained medical model.

## Blockchain lab

The sidebar's **Blockchain lab** separates three views: a guided simulation of sponsor funding, a private proof, contract checks and duplicate rejection; the current wallet module's observed state; and the confirmed historical Preprod runs linked above. Guided balances are illustrations and send no transactions. The live view does not connect or sign automatically; use the reward workspace to query fresh on-chain state. Historical receipts demonstrate the integrations and never count as payment for a visitor's new report.

## Run locally

Node 24+:

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:8787. Existing public proving artifacts are committed, so no ceremony is required to try the demo.

The local server uses Node 24's SQLite through `scripts/local-db.mjs`, exposing the same D1-style API as production. Accounts, sessions, programs and submitted reports persist in the ignored `.local/dev-data.sqlite` file across server restarts. Local migrations are applied once in journal order; checksums reject changes to already-applied migrations. Local credentials and data are independent of the hosted database. Tests use isolated temporary databases.

To select another port, run `CARELOOP_PORT=8789 npm run dev`. Use the printed localhost URL for browser testing. Keep `.local/`, environment files and recovery files out of source control.

For hosting, `.openai/hosting.json` declares `"d1":"DB"`. The schema-only migrations and journal are in `drizzle/`; the build and Sites package include them under `dist/.openai/drizzle`. Sites provisions the binding and applies pending migrations before uploading the Worker. Do not edit an applied migration or create tables during request handling.

To enable the AI, create a Gemini API key, put it in an **untracked** `.env` using `.env.example`, and launch:

```sh
node --env-file=.env scripts/dev.mjs
```

Gemini configuration: `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash`, `GEMINI_API_KEY`. Google controls free-tier eligibility and quotas; no paid plan is provisioned by this code.

Alternative OpenRouter model: `openrouter/free`. It may route to different free models; set `AI_MODEL` to a specific supported `:free` model for repeatable demonstrations. Free capacity and rate limits are not guaranteed. Only the fixed official Gemini or OpenRouter endpoints are called. The server has a best-effort six-request/hour/IP throttle per isolate, not a distributed production quota.

For the hosted Site, set `GEMINI_API_KEY`, `AI_PROVIDER` and `AI_MODEL` using the Sites server environment configuration and redeploy. Never add it to client JavaScript or `.openai/hosting.json`.

## Moving from the earlier Preview demo

The patient-reward flow now targets Preprod. Old Preview enrollments, recovery files, balances and pool UTxOs are **not automatically migrated** and must not be reused as Preprod state. Create a new enrollment on Preprod, use a Preprod wallet with network magic **1**, and fund a new pool with Preprod test ADA. Keep any old recovery file separate; its pool remains on the original network.

No live patient reward is established by this network change. A signed transaction and confirmed on-chain payout are still required.

## Demo walkthrough

1. Choose **Try participant demo** to explore both roles in a private guest workspace. For separate accounts, create a clinic account, copy a program's invitation code, then create a participant account and join using that code.
2. Select an enrolled program and submit a fictional check-in. The report is saved online and AI analysis starts automatically when the server key is configured. Inspect its status and suggestion; neither changes clinic approval.
3. Open the owning clinic account or the clinic role in the same guest demo, refresh the queue, and review the submitted report. Record a review note, then separately confirm eligibility and approve the reward. The server saves the approval against the participant's public enrollment commitment.
4. Optionally use **Programs → Create program** to change the questionnaire and review focus. New programs have separate report histories; their AI remains an untrained demo model.
5. Open the site in a wallet-enabled browser. Set the wallet to **Preprod** (network magic **1**), obtain free Preprod test ADA, and connect it from My rewards. A generic testnet address or network ID alone does not distinguish Preprod from other Cardano test networks.
6. Download the private recovery file. Prepare a 20-test-ADA pool. Review outputs and fee, then personally sign and submit in your wallet. The wallet needs a pure ADA UTxO of at least 25 ADA plus separate collateral; use its send/split feature if needed.
7. Refresh on-chain state after confirmation. Download recovery again to include the deployed pool configuration.
8. Connect the recipient wallet (the same wallet is supported for this demo), generate the proof, and prepare a 2-test-ADA claim. Personally sign and submit. Refresh after confirmation.
9. A second preparation of the same claim is rejected from the on-chain nullifier. Test changed recipient checks proof binding locally.
10. The explorer link shows the submitted transaction. The UI distinguishes approval, claim submission and confirmed payment for the corresponding report.

The wallet module handles one loaded approval/pool at a time. Eight entries form the synthetic batch; they do not represent eight real independent patients. Submitted reports and approvals are saved online, while private enrollment state requires local storage or a recovery file. Closing the tab may clear that private state. The confirmed backend test receipts do not mean that a newly submitted website report has been paid.

## Tests

```sh
npm test
node scripts/test-zk.mjs
cd contracts
../node_modules/.bin/aiken check -m 'careloop/fixtures.{..}' -m 'careloop/state.{..}' -m 'rewards.{..}'
../node_modules/.bin/aiken build
```

`test-zk.mjs` creates a fresh proof and exports public fixtures for Aiken. It checks all eight public-input modifications, wrong secrets, non-boolean paths, duplicate claims and noncanonical field aliases. The full validator tests also check clinic authorisation, payout destination, amount conservation and preserved nullifiers.

To change the circuit, regenerate **all** artifacts and tests:

```sh
npm run zk:setup
node scripts/test-zk.mjs
npm run build
```

This creates a development-only setup using OS randomness. The `.ptau` intermediates are ignored. It is not an independently verified multi-party ceremony. Public proving keys and verification keys are intentionally shareable; they do not contain patient secrets.

## On-chain design

See `contracts/validators/rewards.ak` and `zk/reward.circom`.

Public signals, in order: root, nullifier, program, period, amount (lovelace), recipient payment-key hash as a big-endian integer, deployment domain, recipient-binding hash.

The circuit checks a depth-3 approved Merkle tree. Its leaf commits to the enrollment commitment, deployment domain, program, period and amount. The nullifier commits to the participant secret and scoped program/period/domain. The recipient-binding hash forces the recipient into the proof statement. All public scalars are checked for canonical field representation in the validator.

The pool is identified by a unique NFT, minted once using an input UTxO. The clinic alone can replace the approved root, with all other state and value preserved. A claim preserves the NFT/script and remaining assets, pays the exact reward to an address controlled by the proof-bound payment key (base or enterprise address) and appends the nullifier. Fees come from a separate funding input. A maximum of eight claims keeps the experimental datum bounded. This version has one fixed reporting period per pool, no top-up/close/recovery action, and no batching scalability claim.

The browser chooses the clinic signer from the connected wallet and an available seed UTxO, parameterises both scripts with the matching verification key, and builds the NFT-bearing pool transaction. Enrollment approval creates a random domain. Lucid evaluates transactions with current Preprod protocol parameters from public Koios, then the user signs. No mainnet deployment is supported. The 20-test-ADA pool reserves 4 ADA and has no refund path; only disposable test ADA should be used.

`tests/cardano.test.mjs` executes the actual serialized funding and claim transactions through Lucid’s Cardano emulator, including Plutus evaluation, checks exact payout/state, and rejects tampered proofs, wrong wallets and duplicate claims. This is not evidence of a live Preprod transaction; that requires a wallet signature and network confirmation.

The scope/domain must be unique for the intended logical pool; duplicate prevention is within that pool, not global identity deduplication. Do not initialise multiple independently funded pools for the same program/period and claim they share spent state.

## Source provenance / licences

- `zk/vendor/poseidon_bls12_381.circom`: Cardano Foundation `bls`, commit `3f43b60c92beb98a43331a00ae6a5ec1316acce1`; original licence retained. JS constants are extracted from this file. This is experimental upstream code.
- `contracts/lib/aiken` and `contracts/lib/cardano`: vendored Aiken stdlib v3.1.0, commit `7d5cee54b2bb4eea211ae3bd806c7c39e5fd899d`, licence in `contracts/STDLIB-LICENSE`. Upstream test-only files excluded; vendoring avoids dependence on a global writable compiler cache.
- snarkjs 0.7.6: GPL-3.0. Distributed browser bundle licence retained in `public/SNARKJS-LICENSE`. Careloop source is GPL-3.0-or-later; upstream files retain their licences.

The hosted app does not include a private clinic key, wallet seed or API key. Changes are recorded in the Site's source repository.
