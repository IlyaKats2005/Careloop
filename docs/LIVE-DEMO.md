# Show a real check-in and payment

Use the actual **Weekly check-in / Program check-in** screen, the report's status and its fresh explorer links. The Blockchain lab animation is optional supporting material; it does not count as a paid submission.

## Prepare before the audience arrives

1. Start the hosted or local app with its real Gemini configuration and database.
2. Configure the same `SPONSOR_RELAY_TOKEN` on the server and the sponsor worker. Start the bounded relay using [the README commands](../README.md#run-the-sponsor-relay). Check that it is online and funded with disposable Preprod ADA. Keep its machine awake.
3. Open two separate browser sessions if demonstrating accounts: one clinic, one participant. The clinic creates a program or shares an existing invitation code; the participant joins it. Guest mode supports a smaller single-session demonstration.
4. Use a participant/program/reporting-period combination with **no existing submission**. The database intentionally prevents another check-in for the same enrollment and period. For a second case, use a separate demonstration participant or a second program; do not delete earlier payment evidence to replay it.
5. Confirm the payout address belongs to a disposable Preprod demonstration wallet. Keep enough test ADA in the sponsor wallet for both funding and transaction fees. The participant's proof must bind to the selected recipient.
6. Save the participant's private recovery file. Show the public address or explorer as needed; never screen-share the recovery file, seed, relay token or server environment.
7. Have a separate Masumi paid-job result and its confirmed seller receipt ready. That payment is required by the Cardano track and is distinct from the participant reward.

## Successful live case

1. Select a program and open its check-in.
2. Enter a short, internally consistent **fictional** report. Use the actual form controls and confirm fictional-data consent.
3. Submit. Show that the report has a server-assigned ID and that AI analysis is pending/completed. Explain the completion decision shown by the application.
4. If automatically authorized, follow the real statuses: queued for sponsor → funding submitted → funding confirmed → local proof → claim submitted → claim confirmed. Follow any payout-address or proof action requested by the interface.
5. Open the **new claim's explorer link**. Show the transaction, the 2-test-ADA recipient output and the pool state. The funding transaction and claim transaction are different transactions.
6. Refresh the report or sign in again to demonstrate server persistence. An approval or submitted hash alone must never be presented as a settled payment.

Cardano confirmation and proof generation take time. Do not promise zero latency. The app should show progress while waiting and surface a real error if a provider, relay, model or proof fails.

## Hold case

Use a fresh eligible demonstration participant or another program/reporting period. Submit a fictional report that needs clarification: for example, mutually inconsistent structured answers and narrative about treatment adherence. Show the **actual decision and reason returned by the system**. AI-based classification is not a guaranteed script, so rehearse the exact sample before presenting it.

The held report should remain saved and visible in the clinic queue. Open its original answers and review controls. A held report must not queue a payable claim until the relevant eligibility/completion decision is resolved. Do not use concerning symptoms alone to claim that a reward should be rejected: clinical follow-up and completion eligibility are separate.

An unavailable AI service is also an honest blocked path, but describe it as an analysis failure rather than suspected misconduct.

## Suggested ≤2.5-minute video

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Participant check-in and clinic program | “Sponsors need useful follow-up reports; participants need predictable completion rewards.” |
| 0:15–0:45 | Fill and submit a short fictional form | “The report is saved, checked and analyzed. Clear submissions qualify; unresolved inconsistencies go on hold.” |
| 0:45–1:15 | Real processing states and fresh claim explorer | “The sponsor funds the contract. A browser proof releases 2 test ADA. This is this report's confirmed transaction.” |
| 1:15–1:35 | Separate held report and clinic queue | “The report remains available for review. A hold is visible and does not fake a successful payment.” |
| 1:35–2:15 | Masumi paid job: input, useful result, escrow/withdrawal receipt | “The sponsor can also buy the analysis as a Masumi service. This paid job settled 1 test USDM on the same Preprod network.” |
| 2:15–2:30 | Customer benefit and limits | “Shared payout rules and private approval proofs; clinical validation, verified enrollment and production operations are future work.” |

If chain confirmation exceeds the video allowance, cut the waiting time with an explicit “waiting for confirmation” transition. Retain the same report ID and hashes before and after the cut. Do not replace the transaction with an animation or an unrelated historical receipt. For live judging, let the actual confirmation complete in front of the audience.

The Masumi segment must show a paid job/request from its own input through result and payment, not merely an explorer screenshot. The full receipt may take longer than the video; identify any waiting-time edit honestly.

## When something is on hold or not paid

| Displayed state | Meaning | Next action |
| --- | --- | --- |
| Needs clarification / on hold | Completion policy cannot authorize this report yet | Open the original answers in the clinic queue and record a review decision |
| Analysis failed | No acceptable model result was saved | Check provider configuration/quota; retry the same report |
| Waiting for sponsor | An authorized request has not been processed | Check relay heartbeat, budget and dedicated wallet funds |
| Transaction submitted | A transaction hash exists; settlement is not proven yet | Wait for independent confirmation; do not rebroadcast blindly |
| Proof unavailable / key mismatch | The local private enrollment state does not match the saved approval | Restore the correct private recovery file |
| Confirmed paid | The exact matching payout and pool transition were verified | Open the fresh explorer link and preserve it with the report |

Keep worker journals when troubleshooting. Repeatedly creating new accounts or pools is not a valid way to resolve an uncertain transaction; it can consume the test budget and obscure evidence.
