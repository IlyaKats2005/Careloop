var CareloopPayments = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/payments-view.js
  var payments_view_exports = {};
  __export(payments_view_exports, {
    aiPaid: () => aiPaid,
    paidAIState: () => paidAIState,
    paidAnalysisCard: () => paidAnalysisCard,
    participantPaid: () => participantPaid,
    proofCard: () => proofCard,
    realPaymentsSummary: () => realPaymentsSummary,
    sponsorPayments: () => sponsorPayments
  });
  var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  var txLink = (value, label) => hash(value) ? '<a href="https://preprod.cardanoscan.io/transaction/' + value + '" target="_blank" rel="noopener noreferrer">' + esc(label) + " \u2197</a>" : '<span class="muted">' + esc(label) + " \xB7 not confirmed</span>";
  var labels = { queued: "Waiting for the payment worker", escrow_pending: "Escrow funding pending", funded: "Escrow funded", running: "Paid analysis in progress", result_submitted: "Result transaction pending", result_ready: "Result confirmed \xB7 seller payment pending", settled: "AI service paid", blocked: "Paid job needs attention" };
  var paidAIState = (r) => r.analysisPayment ? labels[r.analysisPayment.state] || "Paid analysis pending" : null;
  function aiPaid(job) {
    const r = job?.receipt;
    return job?.state === "settled" && r?.verified === true && r.network === "Preprod" && r.txHash === job.settlementTxHash && hash(r.txHash) && r.sellerAddress === job.sellerAddress && r.unit === "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d" && r.netAtomicUnits === "1000000";
  }
  function participantPaid(report) {
    const p = report.payout, r = p?.receipt;
    return p?.state === "confirmed" && r?.verified === true && r.network === "Preprod" && r.txHash === p.claimTxHash && hash(r.txHash) && r.recipientAddress === p.recipientAddress && r.amount === "2000000";
  }
  function realPaymentsSummary(reports) {
    const ai = reports.filter((r) => r.analysisPayment?.fundingTxHash && hash(r.analysisPayment.fundingTxHash));
    const pools = reports.filter((r) => hash(r.payout?.fundTxHash) && ["awaiting_proof", "claim_queued", "submitted", "confirmed"].includes(r.payout?.state));
    return { aiFunded: ai.length, aiPaid: reports.filter((r) => aiPaid(r.analysisPayment)).length, adaFunded: pools.length * 20, adaPaid: reports.filter(participantPaid).length * 2, adaRemaining: pools.reduce((n, r) => n + (participantPaid(r) ? Number(r.payout.receipt.poolRemainingLovelace || "18000000") / 1e6 : 20), 0) };
  }
  function paidAnalysisCard(report, enabled = false) {
    const p = report.analysisPayment;
    if (!p) {
      if (report.ai) return '<p class="muted">Direct model analysis \xB7 no Masumi payment was recorded for this report.</p>';
      if (!enabled) return "";
      return '<section class="payment-card" aria-live="polite"><div class="eyebrow">SPONSOR-FUNDED ANALYSIS</div><h3>Waiting for sponsor funding.</h3><p>Your report is saved. Analysis starts automatically when the sponsor\u2019s AI budget and payment service are available. You do not need to request or pay for it.</p><p class="muted">The sponsor pays 1 test USDM through Masumi escrow for this report. Saved answers and program settings are sent to the analysis service after funding is confirmed.</p></section>';
    }
    const funded = hash(p.fundingTxHash), result = hash(p.resultTxHash), settled = aiPaid(p);
    return '<section class="payment-card" aria-live="polite"><div class="row"><div><div class="eyebrow">MASUMI \xB7 PAID AI SERVICE</div><h3>' + esc(paidAIState(report)) + '</h3></div><strong>1 test USDM</strong></div><ol class="payment-steps"><li class="complete">Queued automatically</li><li class="' + (funded ? "complete" : "") + '">Escrow funded</li><li class="' + (result ? "complete" : "") + '">Result confirmed</li><li class="' + (settled ? "complete" : "") + '">Seller paid</li></ol><p>' + (result ? "This report\u2019s paid result is available. Completion policy can now evaluate the participant reward." : funded ? "The service runs only after the sponsor\u2019s escrow funding is confirmed." : "The sponsor worker will fund this job. No AI-service payment is confirmed yet.") + "</p>" + (p.state === "result_ready" ? '<p class="muted">Masumi settlement follows its escrow timing; the result and the seller\u2019s final receipt are tracked separately.</p>' : "") + (p.error ? '<p class="error">' + esc(p.error) + "</p>" : "") + '<div class="payment-links">' + txLink(p.fundingTxHash, "Escrow funding") + txLink(p.resultTxHash, "Result commitment") + txLink(p.settlementTxHash, "Seller receipt") + "</div><details><summary>Job and result evidence</summary><p>Job: <code>" + esc(p.jobId || p.id) + "</code></p><p>Report: <code>" + esc(report.id) + "</code></p><p>Input hash: <code>" + esc(p.inputHash) + "</code></p><p>Result hash: <code>" + esc(p.resultHash || "Awaiting result") + "</code></p><p>Hashes bind this job\u2019s saved input and result; they do not certify medical correctness.</p></details></section>";
  }
  function proofCard(report, generating = false) {
    const p = report.payout || {}, confirmed = participantPaid(report), funded = hash(p.fundTxHash) && ["awaiting_proof", "claim_queued", "submitted", "confirmed"].includes(p.state), proofSent = ["claim_queued", "submitted", "confirmed"].includes(p.state);
    const title = confirmed ? "ZK proof verified on Cardano" : proofSent ? "Private proof received" : generating ? "Generating your private proof" : funded ? "Ready for your browser\u2019s proof" : "Your private reward claim";
    return '<section class="card proof-explainer"><div class="eyebrow">ZERO-KNOWLEDGE ELIGIBILITY</div><h3>' + title + '</h3><ol class="payment-steps"><li class="' + (funded ? "complete" : "") + '">Contract funded</li><li class="' + (proofSent ? "complete" : "") + '">Browser proof</li><li class="' + (confirmed ? "complete" : "") + '">Contract verifies</li><li class="' + (confirmed ? "complete" : "") + '">2 test ADA received</li></ol><p>The browser proves membership in the approved group and binds the claim to your receiving wallet. The contract checks the proof and an unused claim marker before releasing the reward.</p><p class="muted">No questionnaire, enrollment secret or Merkle path is published on-chain. Wallet addresses and payments remain public. The app backend and AI service still process the answers.</p>' + (confirmed ? txLink(p.claimTxHash, "Inspect proof-verifying payout") : '<p class="muted">Keep this participant\u2019s report or rewards page open until the proof is sent. No confirmed payout yet.</p>') + "</section>";
  }
  function sponsorPayments(reports) {
    const s = realPaymentsSummary(reports);
    const rows = reports.filter((r) => r.analysisPayment || r.payout?.fundTxHash || r.payout?.state && r.payout.state !== "not_requested");
    return '<section aria-live="polite"><div class="funding-panels"><section class="card"><div class="eyebrow">AI SERVICE \xB7 TEST USDM</div><h2>' + s.aiPaid + " <small>paid</small></h2><p><strong>" + s.aiFunded + ' test USDM</strong> in confirmed escrow funding across this workspace.</p><p>1 test USDM per automatically queued report analysis. Seller payment requires a matching confirmed receipt.</p></section><section class="card"><div class="eyebrow">PARTICIPANT REWARDS \xB7 TEST ADA</div><h2>' + s.adaPaid + " <small>paid</small></h2><p><strong>" + s.adaFunded + " test ADA</strong> funded \xB7 <strong>" + s.adaRemaining + ' test ADA</strong> remaining in the last confirmed pool states.</p><p>20 test ADA funds each pool; a successful private claim pays 2 test ADA.</p></section></div><p class="muted">Confirmed transactions for this workspace. These totals are not the sponsor\u2019s whole-wallet balance. Test ADA and test USDM are separate assets.</p><section class="card"><h3>Payments and evidence</h3>' + (rows.length ? rows.map((r) => '<div class="payment-ledger-row"><div><strong>' + esc(r.period || "Report") + "</strong><small>" + esc(r.id) + "</small></div><div><strong>AI \xB7 " + esc(paidAIState(r) || "No paid job requested") + "</strong><br>" + txLink(r.analysisPayment?.fundingTxHash, "Escrow") + " \xB7 " + txLink(r.analysisPayment?.settlementTxHash, "Seller receipt") + "</div><div><strong>Reward \xB7 " + (participantPaid(r) ? "2 test ADA confirmed" : esc(r.payout?.state || "Not started")) + "</strong><br>" + txLink(r.payout?.fundTxHash, "Pool funding") + " \xB7 " + txLink(r.payout?.claimTxHash, participantPaid(r) ? "Payout" : "Claim transaction") + "</div></div>").join("") : "<p>No payment has started in this workspace. Submitting a report starts its sponsored analysis automatically.</p>") + "</section></section>";
  }
  return __toCommonJS(payments_view_exports);
})();
