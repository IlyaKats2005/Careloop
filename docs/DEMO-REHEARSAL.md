# Live rehearsal and recording

## Gate before recording

Open **Demo tools → Check payment service → Check service**. The sponsor must be **Online** with remaining new-report budget. An unavailable or stale service is not ready. Do not consume the final budget slot in rehearsal if you need another new payout for judging. See [the run guide](RUNNING.md) for the exact operator command.

When the sponsor allowance is increased, the worker automatically queues previously approved reports that were blocked by that limit. It rechecks policy eligibility and preserves existing payment jobs and transaction references. No further clinic approval is needed. A funded wallet and the worker's local spending allowance are also required.

## Four clients and restart

Enter the participant or clinic demo and open **Demo tools → Choose participant**. Alex Morgan, Maya Chen and Noah Bennett are already enrolled; Sam Rivera is registered but has not joined a program. All four have distinct Preprod receiving wallets saved in their profiles. Wallet addresses are public; their recovery keys are kept outside the app source.

Open Sam, choose **Use invitation**, then **Join program** to demonstrate enrollment. Switch to another client to show their separate reports and enrollment state. The clinic workspace shows the whole cohort.

**Refresh** updates the current reports and balances without resetting anything. A browser reload resumes the same workspace and saved screen. To start over, choose **Demo tools → Restart demo** and confirm: this creates a new private workspace with the original three enrolled clients, Sam awaiting enrollment and no reports. Unsaved questionnaire drafts remain in memory and are not restored after a browser reload.

Every new demo has **1,000 app credits**: 750 available to the sponsor, 200 reserved for client rewards, and 50 reserved for AI. Choose **Sponsor** in **View as** to block additional credits for Careloop Research Clinic or release unused allocations. The clinic dashboard shows the same budget, updating every four seconds. One credit is charged for a successful AI analysis; failures return the reserved credit. Two credits are reserved for an approved client reward and become spent only on a verified Preprod payment.

These are resettable **app accounting credits**, not a wallet balance or a model provider invoice. Allocating credits does not create an on-chain deposit. The real Cardano funding and claim still use the separate live sponsor. Restart preserves old server records, blockchain transactions and private enrollment recovery state. It does not replenish real wallets or reset the live payment allowance.

The website and database are hosted. ZK proofs run in each participant's browser. Until the separate hosting migration is completed, the sponsor payment worker runs locally. The paid website analysis also needs the local Masumi service, database and report worker.

## Successful case

1. Open Alex, Maya or Noah through **Demo tools → Choose participant**, or enroll Sam first, then open a check-in.
2. Show the wallet already saved in the profile; there is no address to paste into the form. The demo creates the private enrollment key automatically on first use. Download its recovery file and keep the download out of the recording. Ordinary participant registration asks for a receiving address once and remembers it across logins.
3. Enter complete fictional answers that agree: taking medication as prescribed, no missed doses, no new symptoms, no impact, able to keep fluids down, no contact requested. Fill the exact questions of the selected program.
4. Review, consent and submit, then request the sponsored 1-test-USDM analysis. Follow its escrow and result commitment. An eligible result does not need another clinic approval click.
5. Show the saved report ID and actual decision. If it goes on hold, show that result and inspect the reason; do not describe it as an automatic pass.
6. Keep the participant's **My rewards**, **My reports**, or submitted report open. Funding confirmation triggers the private proof; the sponsor pays fees. Wait for the new claim's verified receipt, then open its explorer link and inspect the 2-ADA recipient output.

## Hold case

Use a different enrolled participant or a different program, with no previous report in the period. Give a fictional contradiction: answer “No” to missed doses, but explicitly say in the narrative that three scheduled doses were missed in this reporting period. Complete the other required fields and submit normally.

Show the returned decision and its reason. The AI can classify differently; a predetermined screen is not evidence. If it passes, that is an observed result needing investigation, not a successful hold rehearsal. A symptom flag alone should not block a completion reward.

The clinic's queue must show the same held report. Show that there is no queued payout or new transaction for it. Do not approve the report until after demonstrating the hold.

## Record at most 2 minutes 30 seconds

Use real screen recordings. Network waits may be cut only with an explicit “waiting for network confirmation” time jump; retain the same report ID and its actual transaction across the cut. Never replace a pending payment with an unrelated old receipt.

| Time | Screen |
| --- | --- |
| 0:00–0:15 | Program and participant purpose |
| 0:15–0:40 | Enter and submit a new fictional check-in |
| 0:40–1:05 | Real decision, funding, proof and confirmed payment; disclose any time cut |
| 1:05–1:25 | Separate held report and the clinic's matching queue |
| 1:25–2:10 | Paid Masumi job input, useful output, escrow and seller receipt |
| 2:10–2:25 | Public GitHub repository, setup instructions and business case |

Suggested narration:

“Careloop helps study sponsors collect consistent follow-up reports and reward participants for completing them. A clinic configures a program; a participant joins and submits a fictional questionnaire.

This submission is saved online and analyzed by Gemini. The application checks completion and inconsistencies. It authorizes qualifying reports automatically; symptoms can request clinical review without cancelling a completion reward.

The sponsor funds a Cardano Preprod contract. The participant's browser creates a private eligibility proof, and the sponsor submits the claim and pays its fees. This is this report's transaction: the participant receives two test ADA. Confirmation takes time; the app displays the real progress.

Here is a separate report with contradictory answers. Its reward is on hold, with the reason visible to both the participant and clinic. No reward has been sent for that report.

Careloop also exposes a paid AI-analysis service through Masumi. This job locked one test USDM in escrow, produced a questionnaire analysis, committed its result hash and settled payment to the service. This job belongs to the saved website report. Its matching confirmed result drives completion policy; the seller’s final withdrawal settles later.

Both payments use Cardano Preprod. The sponsor funds the service and participant rewards. Our public repository contains the code, setup instructions and transaction evidence.”

## Submission gate

Verify the public GitHub URL while signed out, the setup from a clean checkout, the video duration, and all transaction links. Paste the project description from SUBMISSION.md into Devfolio, add the actual video URL and verify the submission confirmation. A prepared script is not a recorded or submitted video.
