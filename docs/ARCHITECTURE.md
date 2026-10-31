# Careloop: what it does and why it uses blockchain

[Live demo](https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/) · [Source](https://github.com/IlyaKats2005/Careloop) · [Run instructions](RUNNING.md)

## The product

Careloop connects research sponsors, clinics and participants. Sponsors provide a budget for collecting follow-up reports and paying for their analysis. Participants complete program-specific check-ins and earn a completion reward. Clinics define programs, inspect reports and resolve questions about eligibility or inconsistent answers.

The payment should not depend on a clinic employee manually approving and sending every transfer. An ordinary complete, consistent submission can pass the configured completion policy automatically. Clinical concerns are tracked separately: reporting an unpleasant symptom does not automatically disqualify someone from payment. The model assists with review; it is an untrained demo, not a clinical decision-maker.

The intended experience is that participants can see how their rewards are funded, sponsors can see how allocated funds are used, and medical answers do not have to be published to prove eligibility for payment.

## Three kinds of funds

These are distinct balances, not interchangeable names for the same money.

| Balance | What it means | How it changes |
| --- | --- | --- |
| App demo credits | Resettable budget accounting in the hosted database | A new demo has 1,000 credits: 750 unassigned, 50 for AI and 200 for clients. Sponsor actions allocate or release unused credits for each purpose separately. |
| Participant reward funds | Actual disposable test ADA on Cardano Preprod | The sponsor wallet funds a contract with 20 test ADA. A verified claim transfers 2 test ADA to a participant. Fees come from the sponsor wallet. |
| Paid report analysis | Masumi escrow payment on Preprod | In paid mode, submitting a report automatically queues one sponsored 1-test-USDM job; its result commitment and seller settlement have independent receipts. |

For app accounting, one AI credit is reserved before analysis and spent only when analysis succeeds; a failed request releases it. Two client credits are committed when an approved reward enters payment processing and spent only after its matching on-chain payment is verified.

Clicking the sponsor's allocation controls reserves **database credits**. It does not itself send ADA or create a blockchain escrow. The actual reward lock occurs later, in the funding transaction. Resetting a demo restores app credits, not ADA balances, old contracts or the relay's spending allowance.

## What happens from check-in to reward

1. **Registration and enrollment.** A participant saves a Preprod receiving address in their profile. Joining a program creates a private enrollment secret in the browser and a public commitment for the server. Being signed in identifies the profile; it does not recover a missing enrollment secret or give the app the wallet's spending key.
2. **Report submission.** The backend stores the answers and the program configuration used for that report. It checks enrollment, reporting period and duplicate submissions. In paid mode submission automatically reserves the sponsor’s AI budget and queues one paid job. If that budget or the installation allowance is exhausted, the saved report waits and the worker retries without another participant action. The worker purchases the report’s Masumi escrow and waits for confirmed funding before Gemini receives the fictional answers. It commits the result hash on Cardano; only the matching result with a confirmed commitment reaches server completion policy. Seller withdrawal is tracked separately and may settle later. Unresolved contradictions or missing information can place the reward on hold.
3. **Approval batch.** The application constructs a Merkle root for approved enrollment commitments scoped to the program, period and amount. The demonstration uses a depth-three tree with eight leaves, including synthetic entries. This root represents off-chain authorization; the chain does not independently judge the answers.
4. **Sponsor funding.** The relay reads the hosted queue, builds and signs a real Cardano transaction, and locks 20 test ADA in a parameterized Aiken/Plutus V3 contract. A unique state token identifies that pool. The UI waits for confirmed funding before advancing.
5. **Private proof in the browser.** The participant's browser uses the local secret and membership path to generate a Groth16 proof over BLS12-381. The proof binds eligibility to the approved root, program, reporting period, reward amount and recipient payment key. Keep My rewards, My reports or the report open during this step.
6. **Claim and on-chain verification.** The relay verifies the proof, constructs the claim and signs with the sponsor wallet to cover fees. Cardano's spending validator verifies the proof and payment conditions. It requires the correct 2-test-ADA recipient output, preserves the pool identity and remaining value, and records a previously unused nullifier.
7. **Confirmation.** The relay checks the actual chain receipt against the expected report, pool, recipient and amount. Only then does the application mark the reward paid. A queued job, approval label or transaction hash alone is not confirmation.

**The proof is generated before the participant receives the money.** It is verified as part of spending the funded contract. After a successful demo claim, the pool changes from 20 to 18 test ADA and the recipient gets 2 test ADA. The recipient's account password or wallet extension is not needed to sign this sponsored transfer.

Each report currently gets its own pool. The contract supports up to eight claims with a retained reserve, but the automatic flow does not reuse one shared clinic pool across reports. The remaining funds have no implemented refund/close route. This explains why a 2-ADA reward currently requires substantially more sponsor liquidity than 2 ADA.

## Exactly what the ZK proof proves

The private witness consists of the enrollment secret, three Merkle sibling values and three path directions. The circuit checks that the secret produces an enrollment commitment included in the approved root for the stated scope and reward.

| Public proof input | Purpose |
| --- | --- |
| Root | Identifies the approved batch |
| Nullifier | A deterministic claim marker derived from the secret and scope; used to reject reuse within the pool |
| Program and period | Scope the reward to a program and reporting period |
| Amount | Binds the proof to the reward amount |
| Recipient | Binds the claim to the recipient's payment key hash |
| Domain | Separates the proof's application scope |
| Binding | Connects the nullifier and recipient so an existing proof cannot simply be redirected |

The private secret and membership path are not included in the on-chain proof inputs. The contract also receives the proof itself and transaction data. Wallet addresses, amounts, timing, pool state and public inputs remain visible.

The proof establishes **membership in an approved batch and possession of its secret**. It does not establish that a report is medically true, that the AI is correct, that a person has only one account, or that the clinic is legitimate. The application rejects duplicate enrollment/program/period submissions, while the contract rejects nullifier reuse within its own pool. Separate accounts or unrelated pools are not a global uniqueness system.

Source: [`zk/reward.circom`](../zk/reward.circom), [`src/zk-core.js`](../src/zk-core.js), [`contracts/validators/rewards.ak`](../contracts/validators/rewards.ak), [`contracts/lib/careloop/state.ak`](../contracts/lib/careloop/state.ak).

## Why blockchain adds value

**Sponsors and participants share a settlement record.** Anyone can inspect actual contract funding and payouts without asking the clinic to export its private accounting database. A confirmed transfer cannot be erased by editing the Careloop report. The recipient can verify that their address received the reward, and the sponsor can verify how much entered and left the contract.

**The contract enforces the payment conditions.** Once funds are locked, a claim must satisfy the validator's proof, recipient, amount and state-transition rules. The application cannot make an invalid spend valid by changing a screen label. This is stronger than a UI that merely says a reward is approved.

**The clinic does less payment administration.** It still owns the clinical workflow and resolves exceptions, but ordinary completion rewards can move directly from sponsor-funded escrow to participant wallets. The sponsor relay handles submission and fees; clinic staff do not need to send each transfer or reconcile every claim manually.

**Payment verification does not require public medical answers.** The contract consumes a proof of authorization instead of the questionnaire. This separates the public financial record from the underlying clinical content and gives a useful basis for a more private deployment.

A centralized payment database would be simpler if all parties already trusted one operator's accounting and did not need independently verifiable escrow. Careloop uses blockchain specifically for shared settlement evidence and enforced claim rules. It still trusts the off-chain authorization process and depends on services to create and deliver claims.

## What is decentralized, and what is not

| Component | Current implementation and trust boundary |
| --- | --- |
| Settlement and contract validation | Cardano Preprod validates transfers and retains the shared ledger. The ledger is independent of Careloop's database. |
| Website, accounts and reports | Hosted web application, server API and Cloudflare D1 database. These are centralized. |
| Analysis and eligibility decision | External Gemini service plus application policy. The chain verifies authorized membership, not the quality of this decision. |
| Transaction signer and queue processing | A dedicated sponsor relay currently runs on the operator's computer. It must remain online to progress automatic payouts. |
| Private proof generation | Runs in the participant's browser; the enrollment secret is not sent to the relay. The browser must retain or restore that secret. |
| Approval-root authority | The validator has a key authorized to publish a root. In the sponsored demo, that key is the funding sponsor's key; the parameter is named `clinic` in the code. This is not an independent clinic signature over every report. |

The accurate claim is **“decentralized settlement with off-chain report handling,”** not “no centralized server.” The prepared Docker/Render deployment would remove the operator's laptop dependency, but would still be a hosted signer service, not a decentralized queue.

## Transparency and privacy: current demo versus the product goal

The goal is for participants to inspect sponsor allocations for their clinic while only authorized clinical processing sees their answers. The current implementation provides some of that separation, with explicit limits:

| Question | What the current demo actually provides |
| --- | --- |
| Can sponsors and clinics see actual payments? | Yes. Their panels show report-specific test-USDM escrow/settlement and test-ADA pool/payout receipts. Totals cover the workspace, not the sponsor’s whole wallet. Optional allocation controls remain off-chain credits. |
| Can a participant see their reward and actual contract funding? | Yes. Their report exposes funding and claim transaction links and verified payment progress. Public chain data can be checked independently. |
| Can a signed-in participant browse the whole clinic's sponsor allocation? | No. A participant-facing aggregate allocation panel is not implemented. Demo role switching can show the Sponsor panel during a presentation. |
| Are answers, patient IDs and enrollment secrets published to Cardano? | The reward transactions do not include the questionnaire, account identity, enrollment secret or membership path. Public transaction metadata can still be linkable. |
| Does ZK make the raw report visible only to the clinic? | No. The backend stores the report and the external AI provider receives its answers. The operator can link records and addresses. ZK is not encryption of the report database. |
| Are sponsor and clinic demo roles isolated? | No. They are freely switchable views in one demonstration workspace. The nonparticipant workspace API can return report records in Sponsor view even though the UI shows funding. This is not a confidentiality guarantee. |

Thus the defensible privacy statement is: **“The blockchain can verify reward eligibility without publishing the medical report or the participant's enrollment secret.”** Clinic-only access to raw reports would require a different data-access and AI-processing design; it cannot be claimed merely because a ZK proof is present.

## The AI-service payment

In paid mode the website creates one sponsored 1-test-USDM job automatically for each submitted report, subject to sponsor budget and installation limits. The durable worker uses the registered seller and Masumi Payment Service, and only the matching confirmed result reaches completion policy. Final seller settlement is tracked separately. Optional app credits remain off-chain accounting.

The [`integrations/masumi`](../integrations/masumi/README.md) package contains the website worker and the original standalone Standard API service. It requests Masumi escrow funding, waits for the matching funding confirmation, runs the analysis, commits a result hash and verifies settlement of 1 test USDM to the seller. This is a second Cardano payment purpose alongside participant rewards. It has its own local services and setup.

The repository includes [an earlier paid AI receipt and reward evidence](preprod-demo.json) and [a confirmed automatic website reward](live-form-payment.json). These establish completed historical demonstrations; a new report must show its own matching confirmed transaction.
