# Show a real check-in and payment

Open [the live app](https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/) and use the actual **Check-in** screen, the report's status and its fresh explorer links. **Demo tools → Payment walkthrough** is optional supporting material; its animation does not count as a paid submission. [Exact local-service commands](RUNNING.md) and [the blockchain explanation](ARCHITECTURE.md) are documented separately.

## Prepare before the audience arrives

1. The public app already has a hosted API, database and Gemini configuration. Open it; a local web server is unnecessary for this URL.
2. Keep the sponsor relay, Masumi Payment Service and paid report worker running using [the portable run instructions](RUNNING.md#paid-ai-for-website-reports). In **Demo tools → Check payment service → Check service**, check that it is online and has a remaining payment allowance. Keep its machine awake. The paid report flow needs Masumi/PostgreSQL in addition to the participant reward relay.
3. In guest demo mode, use **View as** for Participant, Clinic and Sponsor. **Demo tools → Choose participant** provides three enrolled clients and Sam ready to demonstrate enrollment. All four have a saved receiving wallet. If demonstrating actual accounts, use separate clinic and participant browser sessions and join with a program invitation code.
4. Use a participant/program/reporting-period combination with **no existing submission**. The database intentionally prevents another check-in for the same enrollment and period. For a second case, use a separate demonstration participant or a second program; do not delete earlier payment evidence to replay it.
5. Confirm the payout address belongs to a disposable Preprod demonstration wallet. Keep enough test ADA in the sponsor wallet for both funding and transaction fees. The participant's proof must bind to the selected recipient.
6. Save the participant's private recovery file. Show the public address or explorer as needed; never screen-share the recovery file, seed, relay token or server environment.
7. Have a separate Masumi paid-job result and its confirmed seller receipt ready. That payment is required by the Cardano track and is distinct from the participant reward.

## Successful live case

1. Select a program and open its check-in.
2. Enter a short, internally consistent **fictional** report. Use the actual form controls and confirm fictional-data consent.
3. Submit. The sponsor-funded 1-test-USDM analysis queues automatically; there is no participant payment action. Show the report ID, escrow funding and confirmed result commitment. Explain the completion decision from that paid result. Final seller settlement is a later, separately tracked step.
4. If automatically authorized, follow the real statuses: queued for sponsor → funding submitted → funding confirmed → local proof → claim submitted → claim confirmed. Keep the participant's **My rewards**, **My reports**, or submitted report open to generate the proof automatically. An ordinary valid report does not require another clinic approval click.
5. Open the **new claim's explorer link**. Show the transaction, the 2-test-ADA recipient output and the pool state. The funding transaction and claim transaction are different transactions.
6. Refresh the report or sign in again to demonstrate server persistence. An approval or submitted hash alone must never be presented as a settled payment.

Cardano confirmation and proof generation take time. Do not promise zero latency. The app should show progress while waiting and surface a real error if a provider, relay, model or proof fails.

Show the sponsor’s separate test-USDM and test-ADA payment panels, with this report’s receipts. Off-chain credits are under the optional demo controls: the actual 20-test-ADA lock and 2-test-ADA payout have separate chain transactions. **Refresh** keeps this run; only **Demo tools → Restart demo**, after confirmation, resets its app records and starting credits. It cannot reset actual wallet balances or old payments.

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
