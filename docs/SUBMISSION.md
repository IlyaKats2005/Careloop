# Careloop — TUM Blockchain & AI Hackathon submission

## Project links

- App: https://careloop-study-prototype.perasperaadastra3008.chatgpt.site
- GitHub repository: https://github.com/IlyaKats2005/Careloop
- Reproduction: [README](../README.md), [local-service instructions](RUNNING.md), [live demonstration](LIVE-DEMO.md), [paid Masumi agent](../integrations/masumi/README.md)
- Precise blockchain rationale, payment flow and privacy boundaries: [architecture](ARCHITECTURE.md)
- Copy-ready project description and complete link table: [DEVFOLIO.md](DEVFOLIO.md)
- Paid job input, actual AI output, matching hashes and seller receipt: [evidence](evidence/README.md)
- Confirmed historical transactions: [preprod-demo.json](preprod-demo.json)

Verify the latest source and these documents are visible at the repository URL before submission. This document is not itself a completed Devfolio submission.

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
- Separate sponsor budgets for AI and participant rewards; three enrolled demo clients and one ready to enroll; saved receiving wallets; persistent refresh and an explicit restart control.

The current model is Gemini with program-specific instructions. It is not a trained or clinically validated medical model.

## Why blockchain

Sponsor and participant can independently inspect actual contract funding and payouts. The contract checks the proof, recipient, amount and unused claim marker, so a clinic's private database is not the sole evidence of payment. Ordinary eligible reports can trigger direct sponsor-funded rewards without clinic staff manually sending every transfer. ZK allows the chain to verify approved membership without publishing the questionnaire or enrollment secret.

This decentralizes settlement, not the entire application. Accounts, reports, AI calls and approval policy still use the hosted backend, and the relay remains a separate local process. The backend and external AI provider can access report data; the demo roles do not guarantee sponsor/clinic confidentiality. “Only the clinic knows the data” is not a property implemented by the current proof. App budget credits are off-chain, and a participant-facing view of the clinic's full sponsor allocation remains a product goal. See [the architecture explanation](ARCHITECTURE.md) for the exact boundaries.

## Cardano implementation and evidence

Both payment flows use **Cardano Preprod, network magic 1**.

### Paid AI-service job: qualifying Masumi flow

A buyer funds Masumi escrow for a fictional questionnaire-analysis job. The service waits for confirmed funding, processes the input, submits its result hash and verifies settlement at the seller address.

- Confirmed seller withdrawal: `e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1`
- Explorer: https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1
- Receipt: **1 test USDM** to the dedicated seller.
- Reproducible implementation: [`integrations/masumi/`](../integrations/masumi/README.md).
- Completed Standard API job: `1224781e-666a-42f4-b01e-0b5ebfe24373`.
- Public input/result evidence: [masumi-paid-job.json](evidence/masumi-paid-job.json). Its input and result hashes match the saved job/payment record. The withdrawal's valid contract status and exact seller net receipt were independently checked again via Blockfrost on 31 October 2026.

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

Rechecked against the official event and Cardano pages on **31 October 2026**. The Cardano details were read from the official prize page's embedded track data because its default HTML view shows the BSV tab.

- A **public repository** with a README explaining setup and run commands, public before the deadline.
- A demo video of **at most 2.5 minutes**.
- A detailed Devfolio project description: problem, implementation and operation.
- For Cardano: transaction hash for a paid **Masumi job or x402 request on Preprod**.
- The video must explain the customer, problem and business case and show a paid job/request from start to finish.
- The description must identify the Cardano tools used and explain a route to real use.

Official schedule lists **31 October 2026 at 15:00, Munich local time**, as the submission deadline, followed by live judging. Recheck the official schedule for any organizer changes.

Choose **Cardano — Agentic Commerce on Cardano**. The TUM Blockchain Track is automatic and does not use one of the three partner-track slots. This project does not claim BSV or API3 qualification.

Sources:

- https://hackathon.tum-blockchain.com/prizes#how-to-submit
- https://hackathon.tum-blockchain.com/prizes#cardano
- https://hackathon.tum-blockchain.com/
- https://hackathon.tum-blockchain.com/faq
- https://tum.devfolio.co/
- https://www.masumi.network/tum-hackathon/agent-guide.md

The Masumi tutorial calls payments optional for initial setup. The event's Cardano qualification rule requires a paid job or request. Completing only the website reward flow does not replace that requirement.

## Requirement checklist

| Requirement | Prepared evidence / status |
| --- | --- |
| Public source repository | GitHub's unauthenticated API confirms `IlyaKats2005/Careloop` is public. Latest local changes still require an authenticated push. |
| Setup and run instructions | [README](../README.md), [exact operator and fresh-clone commands](RUNNING.md), and [Masumi setup](../integrations/masumi/README.md). |
| Detailed project description | [Copy-ready Devfolio text](DEVFOLIO.md), including problem, customer, business case, implementation, tools, challenges and real-use plan. |
| Completed paid service on Cardano Preprod | Completed Masumi Standard API job and independently rechecked 1-test-USDM seller receipt in [the evidence package](evidence/README.md). |
| Transaction hash and explorer link | Paid-job hash and URL are in the description and evidence; participant reward links are separately labeled. |
| Code and behavior validation | An isolated checkout passed `npm ci`, `npm run build`, 216 application tests and 30 Masumi integration tests on Node 26.7.0. Its local web server and the public app returned HTTP 200. Public evidence hashes are reproducible without keys. |
| Prior-work disclosure | [Build history](BUILD-HISTORY.md) identifies the static prototype from 29 October and the substantial extensions recorded on 30–31 October. Eligibility is determined by the organizers. |
| Team and attendance | The event is in person, with teams of up to five. Actual registered members and attendance must match the signed-in Devfolio team; this repository does not verify them. |
| Video within the event's limit | Explicitly excluded from this preparation at the project owner's request. No finished video or public video URL is claimed. |
| Devfolio submission | Content and links are prepared. The signed-in project form has not been saved/submitted through this handoff, and no submission confirmation is claimed. |
| Live judging | Keep the sponsor relay running and the participant browser available for proof generation; [run guide](RUNNING.md). |

The public event pages do not expose the user's signed-in Devfolio form, so account-specific required fields and the final submission receipt must be checked there. Video is still an event requirement even though its preparation is excluded here.

## Push the prepared project

All prepared source and documentation should be committed before running this block. It authenticates GitHub CLI if needed, pushes `main`, and adds the live app link to the repository's About section. It does not push ignored credentials or runtime files.

```sh
(
  set -e
  cd "$HOME/.codex/.chatgpt-projects/g-p-6ac89d8629088191afb47e3bffebeb7f/sites/careloop"
  gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web
  gh auth setup-git
  git push https://github.com/IlyaKats2005/Careloop.git main
  gh repo edit IlyaKats2005/Careloop --homepage "https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/" --description "Sponsor-funded research check-ins, paid AI analysis, and ZK eligibility proofs for Cardano rewards."
)
```

Open [Devfolio](https://tum.devfolio.co/), use [the prepared description and URLs](DEVFOLIO.md), supply the separately prepared video, select Cardano, and verify that the platform confirms submission. Publishing source code alone is not a Devfolio submission.

## Honest limits to state in the pitch

This is a fictional-data, testnet prototype. The externally hosted database persists records; a separate sponsor relay currently runs on an operator's computer and must remain online. Production would require a properly hosted signer/queue worker, spending controls, audited contracts, clinical validation, verified clinic membership and a stronger privacy/identity design.

There is no global proof that one person has only one account. Public addresses and transaction metadata can be linkable. Each report currently receives its own experimental pool, with no refund/close path. The proof establishes approval membership, not medical truth. Automatic reward authorization is an off-chain policy decision; the smart contract enforces the resulting proof and payment conditions.
