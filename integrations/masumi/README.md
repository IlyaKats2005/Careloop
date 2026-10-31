# Careloop paid questionnaire-analysis agent

This is the reproducible Masumi service integration used alongside Careloop. It accepts a bounded **fictional** questionnaire, calls the same validated Gemini adapter as the app, waits for confirmed payment funding, commits the result hash and verifies the seller's token receipt.

It is separate from the participant reward relay. The hosted website does not invoke this paid service on every form submission. The standard agent API and the Sokosumi Coworker worker are two entry points; a completed historical Standard job is not evidence of a new Coworker Task.

## Source and dependencies

Adapted from the [official TUM quickstart](https://github.com/masumi-network/tum-hackathon-quickstart), with Careloop's direct Gemini questionnaire client, strict input/evidence checks, payment identity checks, seller-net receipt verification, journal recovery and worker locking. Upstream provenance is retained here. The unused Eve/team-name assistant is not required by this adaptation and is not bundled.

- Node.js **24.5+**.
- Install the root Careloop dependencies with `npm ci`.
- For the Coworker worker: Sokosumi CLI **1.0.4**, on `PATH`, using its supported runtime credential vault.
- A Gemini API key. Only the Coworker route needs a Sokosumi Preprod account, Personal Workspace and Task credits.
- For payment: your own Masumi Payment Service with a dedicated database, encryption key, seller wallet and Preprod payment source; test ADA and test USDM; a Blockfrost Preprod key to independently check settlement.

There are no additional dependencies in this directory. Pin the CLI version: this integration imports its runtime modules and is not guaranteed compatible with another version.

## Common configuration

Complete this for either the Standard API or Coworker route. From your cloned repository:

```sh
npm ci
cd integrations/masumi
cp .env.example .env
chmod 600 .env
mkdir -p .local docs
chmod 700 .local
```

Set your own `GEMINI_API_KEY` in this integration's `.env`. This file is separate from the root app's `.env`. If the files already exist, edit them instead of copying over them.

For the **paid Standard API job**, continue directly to [Prepare the separate paid service](#prepare-the-separate-paid-service). No Sokosumi CLI, account or Coworker is required for that route.

## Optional: configure an execution-only Coworker

Only for the Coworker route:

```sh
npm install --global @masumi_network/sokosumi@1.0.4
sokosumi --version
sokosumi skills
```

Follow the [official account/Coworker setup guide](https://www.masumi.network/tum-hackathon/agent-guide.md) using your own Preprod account and Personal Workspace. Reuse existing resources when resuming. Set the returned `COWORKER_ID` and private `GEMINI_API_KEY` in `.env`; leave `PAID_TASKS_ENABLED=false` for the first execution test.

Import the Coworker runtime credential through the CLI's supported `runtime key-import --api-key-stdin` flow. Do not copy a key into this repository. The tracked `sokosumi-runtime.mjs` reads the CLI runtime vault. If the OS vault is unavailable, stop and configure a supported credential setup before starting the worker.

```sh
npm run worker
```

The worker calls Gemini directly; it does not require an Eve process. Run only one worker for the same Coworker/workspace. Leave organization ID and slug blank for Personal Workspace; if using an organization, set both values together and confirm access before starting.

In another terminal, replace the placeholder with your own Coworker ID:

```sh
sokosumi --preprod tasks create --personal \
  --coworker-id YOUR_COWORKER_ID \
  --name "Careloop fictional questionnaire" \
  --description '{"fictional":true,"answers":{"medication":"semaglutide","status":"Taking as prescribed","dose":"Unchanged; exact dose not supplied","symptoms":{"nausea":"None"},"hydration":"Yes","notes":"Fictional demonstration. No new concerns."}}' \
  --status READY --json
```

Save the returned Task ID and inspect the completed result. Input may be raw JSON as above or `CARELOOP_REPORT_JSON` followed by a newline and JSON. Real patient data is rejected by policy: use fictional input only. This adapted client has no conversational session, so it does not implement the starter's interactive follow-up replies.

## Prepare the separate paid service

Read the official [Masumi Payment Service setup](https://github.com/masumi-network/masumi-payment-service) and the [TUM payment instructions](https://github.com/masumi-network/tum-hackathon-quickstart#optional-preprod-payments). The event requires a qualifying paid job even though the tutorial makes payment optional for initial setup.

Provision your own dedicated MPS instance, database, encryption secret, selling wallet and Preprod source. Save its admin key as `ADMIN_KEY=your_private_admin_key` in private `.local/mps.env`; set file permission `600`. Replace the placeholder with your own MPS key in an editor. No account, wallet, source or registration IDs are supplied in this repository.

Save your own MPS response fields in **ignored** `docs/payment-state.json`:

```json
{
  "sourceId": "YOUR_MPS_PREPROD_SOURCE_ID",
  "walletId": "YOUR_MPS_SELLING_WALLET_ID",
  "sellerAddress": "YOUR_PREPROD_SELLER_ADDRESS",
  "sellerVkey": "YOUR_SELLER_PAYMENT_KEY_HASH"
}
```

Set `MPS_URL`, `AGENT_API_PORT`, `AGENT_AUTHOR` and `BLOCKFROST_API_KEY_PREPROD` in `.env`. Use your own team/author name. The API binds to loopback; do not expose the local MPS admin API publicly.

```sh
# Creates a wallet-scoped runtime key; private token is written under .local/.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env payment-registration.mjs key

# Registers the agent using your dedicated seller wallet.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env payment-registration.mjs register

# Read registration until it is confirmed. This checks source/wallet identity.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env payment-registration.mjs
```

The registration helper saves `docs/registration-state.json` and derives the matching source index and seller key from the confirmed registry. Both state JSON files are ignored by Git. Keep `.local/mps-runtime.env` private and reuse it on resume. Do not create a new key after an uncertain write without checking the existing MPS records.

Start the Standard agent API:

```sh
npm run api
```

It exposes `/availability`, `/input_schema`, `/start_job` and `/status` on the configured loopback port. The API validates fictional input before requesting payment. It does not send the model request until the matching escrow is confirmed as funded.

## Reproduce the Standard paid job

This route creates a new job and purchases it using your dedicated MPS buyer setup. It submits actual **Preprod** payment transactions. It charges **1 test USDM**, plus transaction fees. Prepare your own MPS buyer wallet/source with sufficient test assets first.

In another terminal, from this integration directory:

```sh
# Request signed payment terms for a fixed fictional sample.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env paid-demo.mjs start

# Purchase that exact saved quote using the configured MPS buyer setup.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env paid-demo.mjs purchase

# Watch its actual result and independently verified seller receipt.
node --use-env-proxy --env-file=.env --env-file=.local/mps.env paid-demo.mjs --watch
```

The state is retained under `.local/paid-demo-state.json`, with the result under `.local/standard-jobs/` and a final private receipt under `.local/paid-demo-receipt.json`. The watcher checks the matching confirmed withdrawal transaction and seller net receipt of exactly 1,000,000 atomic test-USDM units. An agent `completed` status alone is not enough to claim seller settlement.

Escrow deadlines and settlement waits are real; this flow can take tens of minutes. The watcher has a two-hour limit. Do not delete journals or rerun a purchase merely because confirmation is slow. An uncertain `*-pending` stage requires inspection before recovery.

For a paid **Coworker Task** instead, leave the same API running, set `PAID_TASKS_ENABLED=true`, restart the single worker and create a new Task using your own configured workspace. The worker publishes the payment request to Sokosumi and verifies the resulting task receipt. Test workspace access/credits before starting; do not switch workspaces while payment is pending.

## Evidence to publish

Publish only sanitized, useful evidence: job/Task ID, fictional input, model result, network, exact transaction hash and seller net test-token receipt. Keep admin/runtime keys, wallet material, raw runtime files and database contents private.

Existing confirmed Standard job seller withdrawal:

https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1

This historical transaction is not a receipt for a new run. Keep every new run's input, result and matching transaction together.

## Tests

```sh
npm test
```

Tests use fixtures and stubs; they do not provision accounts or spend assets. They check bounded fictional input, truthful model-output validation, workspace isolation, signed-quote constraints, payment confirmation, uncertain-write handling, exact seller net receipts and worker locking. Live setup and settlement require the real services described above.
