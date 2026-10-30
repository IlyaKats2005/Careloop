# Careloop — private research-reward demo

Fictional questionnaire → external AI suggestion → human clinic approval → browser-generated Groth16 proof → local reward simulation.

## Implemented

- Existing participant/clinic UI, with separate AI and clinic actions.
- Server-only Gemini / OpenRouter adapter (`POST /api/analyze`), restricted to free models, with timeouts, bounded inputs, JSON/evidence checks and explicit errors. The model cannot approve payment.
- Real **Groth16 over BLS12-381** proof generation and verification in the participant browser. The secret and Merkle path are not sent to the API.
- Circom approval-membership circuit, including program/period/domain scoping, a deterministic nullifier and payout-key binding.
- Compiled Aiken Plutus V3 reward validator, plus one-shot state-NFT minting policy. Actual generated proofs are tested in Aiken.
- Demonstrations of duplicate-claim and changed-recipient rejection.

## Not connected / not production

- No live AI call until a provider API key is configured on the server. There is **no silent fake response fallback**.
- No Cardano transaction has been submitted. The UI settlement is explicitly a browser-local simulation; resetting/reloading resets its state. The on-chain validator, rather than browser storage, enforces durable duplicate prevention after deployment.
- No real clinic authentication, secure medical record store, or identity deduplication. Role switching and the eight-entry approval batch are fictional demonstration controls, not access control. Clinic and patient run in the same browser for the demo.
- No clinical validation, private payment rail, or anonymity guarantee. Program, period, amount, recipient and nullifier are public. Small batches, timing, known wallets, repeated recipients and network metadata can reveal connections.
- Development-only single-machine setup. Do not use real funds. Review circuit and upstream hash parameters, perform an independent security audit and a suitable ceremony before any production deployment.
- AI requests may be processed/stored by the external model provider. Only fictional input is permitted. Removing a name does not make a clinical narrative anonymous.
- Masumi/Sokosumi service-payment integration is separate and is not yet wired into this reward pool.

## Run locally

Node 24+:

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:8787. Existing public proving artifacts are committed, so no ceremony is required to try the demo.

To enable the free AI, create a Gemini API key, put it in an **untracked** `.env` using `.env.example`, and launch:

```sh
node --env-file=.env scripts/dev.mjs
```

Gemini configuration: `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash`, `GEMINI_API_KEY`. Google controls free-tier eligibility and quotas; no paid plan is provisioned by this code.

Alternative OpenRouter model: `openrouter/free`. It may route to different free models; set `AI_MODEL` to a specific supported `:free` model for repeatable demonstrations. Free capacity and rate limits are not guaranteed. Only the fixed official Gemini or OpenRouter endpoints are called. The server has a best-effort six-request/hour/IP throttle per isolate, not a distributed production quota.

For the hosted Site, set `GEMINI_API_KEY`, `AI_PROVIDER` and `AI_MODEL` using the Sites server environment configuration and redeploy. Never add it to client JavaScript or `.openai/hosting.json`.

## Demo walkthrough

1. Participant → My rewards → Create enrollment.
2. Switch to Clinic → review Alex's Week 04 report.
3. Click Analyze fictional report (requires the server key). Inspect the suggestion; it does not change approval.
4. Confirm eligibility and approve the reward.
5. Participant → My rewards → Generate ZK proof.
6. Verify & simulate reward. Try duplicate claim, then Test changed recipient.
7. Inspect the public claim: proof, root, scoped nullifier and payout information, no secret or questionnaire.

Only one approved report per session is supported. Eight entries form the synthetic batch; they do not represent eight real independent patients. Reload starts a new demo.

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

The pool is identified by a unique NFT, minted once using an input UTxO. The clinic alone can replace the approved root, with all other state and value preserved. A claim preserves the NFT/script and remaining assets, pays the exact reward to an enterprise key address and appends the nullifier. Fees come from a separate funding input. A maximum of eight claims keeps the experimental datum bounded. This version has one fixed reporting period per pool, no top-up/close/recovery action, and no batching scalability claim.

Deployment still requires choosing actual clinic signer / seed UTxO / unique domain, parameterising the scripts with the **matching** verification key, initialising the NFT-bearing pool with correct program/period/root/budget, building and evaluating actual transactions with current Preprod protocol parameters, and wallet signing. The included blueprint is unparameterised, not a deployed contract. No mainnet deployment is supported by this demo.

The scope/domain must be unique for the intended logical pool; duplicate prevention is within that pool, not global identity deduplication. Do not initialise multiple independently funded pools for the same program/period and claim they share spent state.

## Source provenance / licences

- `zk/vendor/poseidon_bls12_381.circom`: Cardano Foundation `bls`, commit `3f43b60c92beb98a43331a00ae6a5ec1316acce1`; original licence retained. JS constants are extracted from this file. This is experimental upstream code.
- `contracts/lib/aiken` and `contracts/lib/cardano`: vendored Aiken stdlib v3.1.0, commit `7d5cee54b2bb4eea211ae3bd806c7c39e5fd899d`, licence in `contracts/STDLIB-LICENSE`. Upstream test-only files excluded; vendoring avoids dependence on a global writable compiler cache.
- snarkjs 0.7.6: GPL-3.0. Distributed browser bundle licence retained in `public/SNARKJS-LICENSE`. Careloop source is GPL-3.0-or-later; upstream files retain their licences.

The hosted app does not include a private clinic key, wallet seed or API key. Changes are recorded in the Site's source repository.
