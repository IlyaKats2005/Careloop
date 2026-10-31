# Careloop — submission text

Copy the sections below into the corresponding project-description fields in [the TUM Devfolio event](https://tum.devfolio.co/). Field names may vary in the signed-in form. Select **Cardano: Agentic Commerce on Cardano**. The TUM Blockchain Track considers submitted projects automatically; no BSV or API3 implementation is claimed.

This file prepares the submission content. It does not represent a saved or submitted Devfolio entry. Video preparation is outside this handoff at the project owner's request.

## Project name

Careloop

## Tagline

Sponsor-funded research check-ins, paid AI analysis, and private eligibility proofs for Cardano rewards.

## The problem it solves

Research sponsors need complete, consistent follow-up reports. Participants need a clear reporting experience and predictable rewards. Clinics need to review exceptions and clinical concerns without becoming the manual payments department for every completed questionnaire.

Careloop joins these workflows in one application. A sponsor allocates separate budgets for AI analysis and participant rewards. A clinic configures a research program and its questionnaire. Participants enroll, submit check-ins, and receive rewards directly to the wallet saved at registration. The application authorizes ordinary qualifying reports automatically and exposes unresolved inconsistencies for clinic review. Reporting symptoms does not automatically remove a completion reward.

The paying customer is a research sponsor or study operator. They would pay for useful analysis of completed reports and fund participant incentives. The proposed business model combines program-management software with per-analysis service payments; there is no revenue or production-adoption claim in this demo.

## How it works

The hosted application stores accounts, enrollment commitments, original answers, program snapshots and review decisions. Gemini returns a structured analysis with evidence linked to the submitted answers. Server-side completion policy determines whether a reward can proceed; the model does not independently authorize spending or make a medical decision.

For an approved reward, a dedicated sponsor relay funds an Aiken/Plutus V3 contract on Cardano Preprod with 20 test ADA. Once funding confirms, the participant's browser generates a Groth16 proof over BLS12-381. It establishes membership in an approved batch while keeping the enrollment secret and membership path out of the public claim. The proof binds the reward to the program, period, amount and recipient payment key.

The sponsor covers transaction fees and submits the claim. The validator verifies the proof, requires the correct 2-test-ADA recipient output, preserves the remaining pool and records an unused nullifier. The application marks payment complete only after checking the matching chain receipt. One demonstrated claim leaves 18 test ADA in its pool.

The website’s sponsored-analysis request purchases a fictional questionnaire analysis for 1 test USDM through Masumi Payment Service. A durable worker waits for confirmed escrow, analyzes that report’s saved answers and program configuration, commits the result hash and returns the matching confirmed result to completion policy. It separately verifies seller settlement. Each report has one immutable paid job; refresh does not buy another. The original standalone Standard API service and its historical paid-job evidence remain available.

## Why Cardano and zero-knowledge proofs

Sponsor funding and participant payouts can be inspected independently on a shared ledger, rather than relying solely on the clinic's accounting. Contract validation enforces claim conditions, and direct sponsor-funded rewards reduce the clinic's payment administration. The chain verifies approved membership without receiving the medical questionnaire or enrollment secret.

This decentralizes settlement, not the whole application. Reports and eligibility policy still use a hosted backend. The backend and external AI provider can access submitted answers; ZK does not provide clinic-only access to the raw report. The demo's role selector is not a confidentiality boundary. Sponsor credit allocations are database accounting; only actual contract transactions represent on-chain locks. Participants can inspect their own reward funding; a clinic-wide allocation view for participants is not yet implemented.

## Cardano tools and technology

Cardano Preprod; Masumi Payment Service and Standard agent API; Aiken and Plutus V3; Lucid Evolution; Circom; snarkjs; Groth16 over BLS12-381; Poseidon commitments and Merkle membership; Blockfrost and Koios; JavaScript/Node.js; Cloudflare Workers and D1; Gemini.

The Masumi integration is adapted from the official TUM quickstart. Dependencies and source/license provenance are documented in the repository. A Sokosumi Coworker entry point is also included; the submitted payment evidence below belongs to the completed Standard API job, not a completed Coworker Task.

## Prior work and event extension

Careloop had a static interface prototype before the event. The repository records its backend, ZK/contract payment implementation, Masumi service integration and operational demo extensions in commits on 30–31 October. The [build history](BUILD-HISTORY.md) identifies the earlier baseline and subsequent changes. Upstream starter/library code and AI coding assistance are disclosed; we do not claim that the earlier prototype or dependencies were created during the hackathon.

## Challenges we addressed

We separated clinical review from reward eligibility so that a symptom flag does not incorrectly block a valid completion reward. We distinguished app credit budgets from real testnet wallet funds and pending payments from confirmed settlement. We implemented durable transaction journals and exact-byte retries so uncertain network responses do not create replacement payments. We also made browser proof generation and payment status updates work from the participant's reports and rewards screens, and made refresh preserve progress while an explicit restart begins a new demo run.

## Evidence and validation

- Completed Masumi Standard API job: `1224781e-666a-42f4-b01e-0b5ebfe24373`.
- Paid-job settlement: `e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1` — **1 test USDM** net to the seller.
- The public evidence file contains the actual fictional input, exact AI output, input/result hashes and seller receipt. The hashes were matched to the saved job/payment record and the settlement was independently rechecked through Blockfrost on 31 October 2026.
- A separate automatic website run paid **2 test ADA** to a participant: claim `822634daddc045a367669ebba5d6c07af7d3ec071c984cabb1c26c27e479f2e5`.
- The current source passed the application and Masumi integration test suites (run `npm test` and `npm run test:masumi` for the current counts). These checks are separate from live chain receipt verification.

## How it could run in real use

A sponsor would fund a study, clinics would configure questionnaires and review exceptions, and participants would receive direct completion rewards. Analysis is purchased as an explicit Masumi job whose payment is linked to its result. The next operational step is to move the signer to a persistent hosted worker using the included deployment package. A real clinical deployment would also need appropriate clinic access and data-processing boundaries, a validated review model, and a reusable reward-pool design.

The current demo uses fictional reports and disposable Preprod assets. The browser generates the private proof; the sponsor relay still runs on the operator's computer. Each report gets a separate experimental pool with no refund/close path. The proof establishes approved membership, not medical truth or global identity uniqueness. The paid website route requires an explicit sponsored-analysis request; submitting a form alone does not spend test USDM. The operator must keep Masumi, its report worker and the reward relay online.

## Links to enter

| Purpose | URL |
| --- | --- |
| Live application | https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/ |
| Public repository | https://github.com/IlyaKats2005/Careloop |
| README / setup | https://github.com/IlyaKats2005/Careloop/blob/main/README.md |
| Exact local run instructions | https://github.com/IlyaKats2005/Careloop/blob/main/docs/RUNNING.md |
| Architecture and privacy explanation | https://github.com/IlyaKats2005/Careloop/blob/main/docs/ARCHITECTURE.md |
| Prior prototype and event extension | https://github.com/IlyaKats2005/Careloop/blob/main/docs/BUILD-HISTORY.md |
| Paid AI job: actual input, result and receipt | https://github.com/IlyaKats2005/Careloop/blob/main/docs/evidence/masumi-paid-job.json |
| Qualifying paid AI settlement explorer | https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1 |
| Masumi reproduction | https://github.com/IlyaKats2005/Careloop/blob/main/integrations/masumi/README.md |
| Automatic website reward evidence | https://github.com/IlyaKats2005/Careloop/blob/main/docs/live-form-payment.json |
| Participant pool funding explorer | https://preprod.cardanoscan.io/transaction/3ab289b65292f64d19211436b9c417c725d332431dad72c9bd1ff5a67f6e3bb1 |
| Participant payout explorer | https://preprod.cardanoscan.io/transaction/822634daddc045a367669ebba5d6c07af7d3ec071c984cabb1c26c27e479f2e5 |

The historical receipts demonstrate those specific completed runs. A new live demonstration must show its own report/job and transaction. No video URL is supplied in this handoff.
