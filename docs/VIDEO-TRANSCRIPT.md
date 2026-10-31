# Careloop — ready-to-record video transcript

Target: **2 minutes 25 seconds**, leaving five seconds below the [hackathon's 2½-minute maximum](https://hackathon.tum-blockchain.com/prizes#how-to-submit). The narration is 278 words: aim for about 120 words per minute, with short pauses.

[Live demo](https://careloop-study-prototype.perasperaadastra3008.chatgpt.site/) · [Public repository](https://github.com/IlyaKats2005/Careloop) · [Operator setup](RUNNING.md) · [Payment architecture](ARCHITECTURE.md)

## Prepare the recording

- Keep the sponsor relay, Masumi Payment Service/database and paid report worker running. The website itself is hosted. Follow [the run guide](RUNNING.md#paid-ai-for-website-reports); viewers do not need to start anything.
- Choose an enrolled demo participant with no submission for the selected program and reporting period. Keep the participant report or rewards page open until the browser has generated and sent its proof.
- Use complete, consistent fictional answers. Do not start with a held report, or promise that any arbitrary report will pass.
- Capture **one report and its own paid Masumi job**, from submission to useful analysis, participant payout and final seller receipt. The AI seller's settlement occurs later than its result commitment and may occur after the participant payout. Allow at least the configured 36-minute escrow unlock delay from the quote, plus processing and confirmation; this is preparation time, not the video length.
- Cut network waits with an explicit **“Later — after blockchain confirmation”** or **“Later — after escrow settlement”** caption. Keep the same report and job across each cut. Say “confirmed” and “paid” only when the matching receipt is actually confirmed.
- Open the real report's explorer links. Do not substitute a historical receipt, the educational payment animation, or an off-chain credit balance.
- On the Mac, press **Shift–Command–5**, choose a recording area, then **Options → Microphone → your MacBook or headset microphone**. Click Record. Voice is captured only when a microphone is selected. Record and play back a ten-second test first. [Apple's recording instructions](https://support.apple.com/102618).

## Screen sequence

These are editing targets, not deadlines for network confirmations. Read only the narration below.

| Video time | Show |
| --- | --- |
| 0:00–0:19 | Careloop landing page or clinic program. Introduce the customer, problem and proposed business model. |
| 0:19–0:40 | **View as → Sponsor**. Show the separate AI/test-USDM and participant/test-ADA panels. |
| 0:40–1:03 | **View as → Participant → Check-in**. Show the new care journey, a few actual answers, **Review & send**, then submission. Cut or accelerate form entry as needed. |
| 1:03–1:22 | The saved report's paid AI panel: funded escrow, its useful analysis and result commitment. Insert the confirmation-wait caption. Briefly show the same report/job identifier. |
| 1:22–1:51 | The same report's reward panel: 20-test-ADA funding, private proof, then confirmed claim. Open the claim explorer and point to its 2-test-ADA recipient output. |
| 1:51–2:02 | The same report's Masumi seller receipt after settlement. Insert the settlement-wait caption and show its confirmed 1-test-USDM receipt. |
| 2:02–2:25 | Briefly return to the clinic's report view, then the public GitHub README and transaction-evidence/setup links. End while the repository URL is visible. |

## Read aloud

Careloop helps research sponsors collect follow-up reports and reward participants for completing them. Clinics manage the study and review exceptions. Our customers are research sponsors, and our proposed business model is a service fee per completed report.

The sponsor dashboard separates AI payments from participant rewards. Both use Cardano Preprod. The AI service costs one test USDM per report; an eligible participant receives two test ADA. Demo budget credits are separate from actual on-chain deposits.

I’m using an enrolled participant whose wallet is already saved. This check-in asks about treatment, symptoms and everyday wellbeing. I submit a complete, consistent fictional report. The sponsor automatically pays for analysis; the participant never buys credits or approves a payment.

After the confirmation wait, Masumi escrow is funded. The AI returns a structured review, and its result commitment is recorded on-chain. This report passes completion checks, so its reward is authorized without another clinic approval.

The sponsor locks twenty test ADA in the reward contract. My browser generates a zero-knowledge proof of membership in the approved batch. The contract verifies that proof, binds the claim to my receiving wallet, and prevents reuse within this pool. Here is the confirmed transaction: two test ADA reaches the participant, with fees covered by the sponsor.

After the settlement wait, this same Masumi job also shows its seller receipt: one test USDM paid to the AI-service provider.

Blockchain gives every party independently verifiable payment evidence and reduces the clinic’s payment administration. Questionnaires stay off the public blockchain, although our hosted backend and AI provider process the answers. This is a testnet demo using fictional data. Our public repository contains the code, setup instructions and transaction evidence.

## Accuracy notes — not spoken

- This script describes a successful observed run. If a step is pending or the report is held, finish that run or explain its actual state before recording a success claim.
- Sponsor app allocations are off-chain reservations. They do not themselves lock tokens. Masumi escrow funding and reward-pool funding are actual, separate transactions.
- The current pool starts with 20 test ADA and pays 2 to this participant, leaving 18 in the contract. Do not describe it as a deployed reusable/refundable clinic-wide pool.
- The ZK proof verifies approved membership and claim constraints; it does not prove the medical truth of answers. The nullifier prevents reuse within the pool.
- Raw answers stay off the public chain, but the backend stores them and the model provider receives them. Do not claim “only the clinic can see the data” or that the entire app has no central server.
- A service fee per completed report is the proposed business model, not an already implemented platform fee.

