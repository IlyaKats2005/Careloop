# Run Careloop: hosted demo and local services

**App:** https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/  
**Repository:** https://github.com/IlyaKats2005/Careloop

## What needs to be running

| Component | Where it runs now | Needed for the hosted check-in and participant reward? |
| --- | --- | --- |
| Website and API | Hosted online | Yes; already deployed |
| Accounts, reports, budgets and payment queue | Hosted D1 database | Yes; already configured |
| Ordinary report analysis | Hosted API calling Gemini | Yes; already configured, subject to provider availability/quota |
| Sponsor payment relay | Operator's computer | **Yes; leave one relay process running** |
| Enrollment secret and ZK proof | Participant's browser | **Yes; keep My rewards, My reports or the report open until the proof is sent** |
| PostgreSQL, Masumi Payment Service and paid AI agent | Separate local integration | No; only for a separate paid AI-service demonstration |

The hosted website does not require a local web server. A participant does not need Terminal. The current demo operator does need the relay running. After a claim has been submitted, closing the participant tab does not undo the transaction, but the relay must continue checking and recording confirmation.

## Current preconfigured operator Mac

First check **Demo tools → Check payment service → Check service**. If the relay is already running, leave it running rather than start another copy.

If it is stopped, use:

```sh
cd "$HOME/.codex/.chatgpt-projects/g-p-6ac89d8629088191afb47e3bffebeb7f/sites/careloop"
node --use-env-proxy --env-file=.local/sponsor-relay.env scripts/sponsor-relay.mjs
```

Leave Terminal open, the Mac awake and its internet connection active. `relay_ready` means initialization completed; it does not mean every pending reward has already been paid. The worker checks the queue roughly every 15 seconds, and blockchain confirmations take additional time. Ctrl+C stops the relay and pauses further automatic processing.

For a read-only check without starting another worker:

```sh
node --use-env-proxy --env-file=.local/sponsor-relay.env scripts/sponsor-relay.mjs --check
```

The private file already points to the hosted demo and the existing wallet/journal. It is intentionally excluded from GitHub. The configured operator allowance was raised to **10 jobs / 250 test ADA**. The website's server allowance and the relay's limits both apply; a full wallet does not override them.

No `start-services.py` command is required for this normal workflow. That machine-specific helper belongs to the optional Masumi/PostgreSQL setup and is not part of a fresh clone.

## Use the demo in the browser

1. Open the live link and choose a demo role. Use **View as → Sponsor** to see independent AI and client budgets and reserve additional app credits if needed.
2. Open **Demo tools → Choose participant**. Alex, Maya and Noah are already enrolled. Sam has a registered wallet and can demonstrate joining with a clinic program's invitation code.
3. As the participant, submit a fictional, internally consistent check-in. The saved profile supplies the receiving address automatically. An ordinary valid report should pass the completion policy without an extra clinic approval click.
4. Keep **My rewards**, **My reports**, or the submitted report open. The browser generates the private proof when the pool is ready, and the relay submits the payment. If a hold is shown, inspect its actual reason in the clinic view.
5. Wait for a verified payment and open that report's claim transaction. The expected recipient output is **2 test ADA**. “Queued,” “approved,” and “submitted” are intermediate states.

**Refresh** updates the current run. A normal browser reload preserves its workspace and saved records. **Demo tools → Restart demo** explicitly creates a new run after confirmation, restoring the three-enrolled/one-unenrolled cohort and starting app credits. It does not reverse chain transactions, refill the real wallet or reset the relay allowance. Download the private enrollment recovery file if the same enrollment must be used on another device; account login alone does not restore the secret.

## Fresh clone: run your own local app

Use Node.js 26 for the currently tested runtime, plus npm and Git.

```sh
git clone https://github.com/IlyaKats2005/Careloop.git
cd Careloop
npm ci
cp .env.example .env
chmod 600 .env
```

Edit `.env` privately. Set `GEMINI_API_KEY`, retain `AI_PROVIDER=gemini` and the configured `AI_MODEL`, and set these values for a fully local deployment:

```dotenv
SPONSOR_SITE_URL=http://localhost:8787
SPONSOR_RELAY_TOKEN=REPLACE_WITH_YOUR_OWN_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
```

Use your own secret, not the literal placeholder. The same `.env` supplies the API and relay so their tokens match. The example file initially points at the hosted Careloop origin; change it for a local server. If you choose a different `CARELOOP_PORT`, update the relay URL to match.

```sh
npm run build
node --use-env-proxy --env-file=.env scripts/dev.mjs
```

Open **http://localhost:8787**. Leave this process running for a local app. Accounts and reports persist in `.local/dev-data.sqlite`. A clone does not contain the hosted database, operator credentials or wallet files.

Choose a guest demo, or create a clinic account and a participant account. The clinic's program invitation enrolls the participant. Outside the predefined demo cohort, participant registration requires a Preprod receiving address once.

### Configure the relay for that installation

Use a dedicated disposable Preprod wallet. Save its 15- or 24-word seed in a private file outside tracked source. An optional Blockfrost key must be a Preprod key, also in a private file. Give secret files owner-only permissions (`chmod 600`). Set their absolute paths in `.env`:

```dotenv
SPONSOR_SEED_FILE=/absolute/private/path/sponsor-seed.txt
SPONSOR_BLOCKFROST_KEY_FILE=/absolute/private/path/blockfrost-preprod.key
SPONSOR_STATE_DIR=.local/sponsor-relay
SPONSOR_MAX_JOBS=4
SPONSOR_MAX_SPEND_ADA=100
```

Leave `SPONSOR_BLOCKFROST_KEY_FILE` blank to use public Koios. Obtain free disposable test ADA from the [Cardano Preprod faucet](https://faucet.preprod.world.dev.cardano.org/basic-faucet). The funding builder needs a pure-ADA output of at least 25 test ADA and separate collateral; the relay reports if the wallet needs preparation. Budget for 20 test ADA locked per report, transaction fees and collateral. Wallet balance alone is not always sufficient if its outputs are unsuitable.

In a second terminal, from the repository root:

```sh
# Read-only readiness check.
node --use-env-proxy --env-file=.env scripts/sponsor-relay.mjs --check

# Start the worker; this may submit testnet transactions for approved jobs.
node --use-env-proxy --env-file=.env scripts/sponsor-relay.mjs
```

For a separately hosted installation, use its HTTPS origin and configure the same relay token in its server environment. Do not attempt to attach a new clone to the existing public demo without its operator configuration.

Keep the relay's `.local/sponsor-relay/` directory across restarts: it contains the journal used to reconcile and safely retry exact signed transactions. Run only one relay for the wallet. `--once` can submit transactions; only `--check` is a read-only preflight. Do not erase journals to replenish spending limits or recover an uncertain transaction.

## Optional: demonstrate an actual paid AI-service job

The normal website calls Gemini directly. Starting the participant relay does not start a Masumi AI seller or buy an AI job.

To reproduce the separate **1-test-USDM** analysis purchase, follow [the Masumi integration README](../integrations/masumi/README.md). It covers the dedicated PostgreSQL-backed Payment Service, seller registration, private environment files, Standard agent API, buyer funding, and commands to start, purchase and watch the paid job. The Sokosumi worker is an alternative entry point for Coworker Tasks. These services and credentials are not bundled as a ready-to-run public instance.

## Run without the operator's laptop

The repository includes [Docker Compose instructions](../deploy/README.md) and a [Render deployment plan](../deploy/RENDER.md). They are deployment preparation, **not an active cloud relay**. Moving the relay requires a provisioned host, private configuration and migration of the existing transaction journal, with the old signer stopped before the new one starts. Until that migration is completed, the local process above remains necessary.

## Diagnose a pending reward

| State or symptom | What to check |
| --- | --- |
| Reward queued | Check service heartbeat, server payment allowance and that the relay targets the same site. |
| Budget exhausted | Distinguish app AI/client credits, the server/relay job allowance, and real sponsor test ADA. Each is a separate limit. |
| Funding submitted | Wait for chain confirmation. Preserve the existing hash and journal. |
| Waiting for proof | Open the same participant's My rewards, My reports or report page with the matching local secret; restore its private recovery file if necessary. |
| Claim submitted | The chain has not yet been verified as settled. The running relay will check the matching payout. |
| Completion on hold | Inspect the saved report and policy reason in the clinic view. A clinical review label alone does not block an otherwise eligible reward. |
| AI analysis failed | Check the hosted or local model provider configuration and quota. The report remains saved. |

To verify the repository locally, run `npm test` and `npm run test:masumi`. These cover application and integration behavior; test success is separate from a new live Cardano payment confirmation.
