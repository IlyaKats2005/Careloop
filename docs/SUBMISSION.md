# Careloop — TUM Blockchain & AI Hackathon submission

## Project links

- App: https://careloop-study-prototype.perasperaadastra3008.chatgpt.site
- Intended public repository: https://github.com/IlyaKats2005/Careloop
- Reproduction: [README](../README.md), [live demonstration](LIVE-DEMO.md), [paid Masumi agent](../integrations/masumi/README.md)
- Confirmed historical transactions: [preprod-demo.json](preprod-demo.json)

The repository link is the intended publication destination; verify it is publicly accessible before submission. Do not claim this document itself is a completed Devfolio submission.

## The problem and customer

A research sponsor needs complete, consistent longitudinal reports. Participants need a simple reporting experience and a predictable completion reward. Clinics need a review queue that distinguishes incomplete or contradictory reports from medical concerns.

Careloop connects these tasks: configurable questionnaires, an AI-assisted review, explicit reward rules and an auditable on-chain payout. The sponsor funds the reward and pays for the service; the participant does not buy access to their own reward.

## What we built

- Ordinary email/password accounts, clinic programs, invitation codes and server-persisted reports.
- Per-program questionnaire and AI configuration, retaining the exact configuration used for each submitted report.
- Automatic reward authorization for reports that meet the configured completion policy, with visible holds for reports requiring clarification. Clinical concerns remain separate from reward disqualification.
- A bounded Preprod sponsor relay, browser-generated zero-knowledge proofs, exact 2-test-ADA payouts and confirmed transaction evidence.
- A separate Masumi-paid questionnaire-analysis service, with result hashes and an independently checked seller receipt.
- A blockchain visualization that distinguishes illustrative walkthroughs, observed live state and historical evidence.

The current model is Gemini with program-specific instructions. It is not a trained or clinically validated medical model.

## Cardano implementation and evidence

Both payment flows use **Cardano Preprod, network magic 1**.

### Paid AI-service job: qualifying Masumi flow

A buyer funds Masumi escrow for a fictional questionnaire-analysis job. The service waits for confirmed funding, processes the input, submits its result hash and verifies settlement at the seller address.

- Confirmed seller withdrawal: `e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1`
- Explorer: https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1
- Receipt: **1 test USDM** to the dedicated seller.
- Reproducible implementation: [`integrations/masumi/`](../integrations/masumi/README.md).

The current hosted form calls Gemini directly. Do not claim each website submission purchases a Masumi job. The paid service and participant reward are separate integrations.

### Participant reward: custom privacy/payment flow

The sponsor funds an Aiken Plutus V3 pool. A browser-generated Groth16 BLS12-381 proof establishes membership in its approved batch and binds the claim to the program, period and recipient. A nullifier prevents replay within that pool.

Earlier verified integration evidence:

- Funding: https://preprod.cardanoscan.io/transaction/f7b17e0f0f34ad3f8406c9f22e21e90c9c5d0c1fc33468ae32217013f88dbc13
- Claim: https://preprod.cardanoscan.io/transaction/3cdc05fd37d24ce89529db27057ffdcd44b9eef40269888cc3ebf1faf6fa0b10
- Result: pool 20 → 18 test ADA, participant received 2 test ADA, nullifier recorded.

Fresh automatic website run, confirmed 30 October 2026 at 20:24 Berlin time (19:24 UTC):

- Report: `R-e5b222bf-2805-4c60-a85b-49f335b3563c`
- Funding: https://preprod.cardanoscan.io/transaction/3ab289b65292f64d19211436b9c417c725d332431dad72c9bd1ff5a67f6e3bb1
- Claim: https://preprod.cardanoscan.io/transaction/822634daddc045a367669ebba5d6c07af7d3ec071c984cabb1c26c27e479f2e5
- Result: participant received 2 test ADA; pool retained 18 test ADA.
- Saved relay verification: [live-form-payment.json](live-form-payment.json).

These receipts belong to this completed run. A new demonstration must show its own report and transaction, not reuse these as its payout.

## What must be submitted

Verified against the official event and Cardano pages on 30 October 2026:

- A **public repository** with a README explaining setup and run commands, public before the deadline.
- A demo video of **at most 2.5 minutes**.
- A detailed Devfolio project description: problem, implementation and operation.
- For Cardano: transaction hash for a paid **Masumi job or x402 request on Preprod**.
- The video must explain the customer, problem and business case and show a paid job/request from start to finish.
- The description must identify the Cardano tools used and explain a route to real use.

Official schedule lists **31 October 2026 at 15:00, Munich local time**, as the submission deadline, followed by live judging. Recheck the official schedule for any organizer changes.

Sources:

- https://hackathon.tum-blockchain.com/prizes#how-to-submit
- https://hackathon.tum-blockchain.com/prizes#cardano
- https://hackathon.tum-blockchain.com/
- https://tum.devfolio.co/
- https://www.masumi.network/tum-hackathon/agent-guide.md

The Masumi tutorial calls payments optional for initial setup. The event's Cardano qualification rule requires a paid job or request. Completing only the website reward flow does not replace that requirement.

## Before marking the submission ready

- Verify the public GitHub URL opens while signed out.
- Run the documented setup and tests on a clean checkout.
- Check that no credentials, wallet seeds, database contents or private recovery files are tracked.
- Perform a fresh successful form → proof → confirmed payment run and a separate held-report run.
- Preserve the corresponding on-chain transaction links and the paid Masumi result/receipt.
- Keep the sponsor relay running, awake and funded for live judging.
- Record the ≤2.5-minute video and add its URL in Devfolio.
- Submit the actual Devfolio form and verify its confirmation.

## Honest limits to state in the pitch

This is a fictional-data, testnet prototype. The externally hosted database persists records; a separate sponsor relay currently runs on an operator's computer and must remain online. Production would require a properly hosted signer/queue worker, spending controls, audited contracts, clinical validation, verified clinic membership and a stronger privacy/identity design.

There is no global proof that one person has only one account. Public addresses and transaction metadata can be linkable. Each report currently receives its own experimental pool, with no refund/close path. The proof establishes approval membership, not medical truth. Automatic reward authorization is an off-chain policy decision; the smart contract enforces the resulting proof and payment conditions.
