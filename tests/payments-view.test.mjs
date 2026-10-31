import test from 'node:test';
import assert from 'node:assert/strict';
import {aiPaid,participantPaid,realPaymentsSummary,paidAnalysisCard,proofCard,sponsorPayments} from '../src/payments-view.js';
import {TEST_USDM} from '../src/paid-ai-jobs.js';
const ai={state:'settled',fundingTxHash:'a'.repeat(64),settlementTxHash:'b'.repeat(64),sellerAddress:'seller',receipt:{verified:true,network:'Preprod',txHash:'b'.repeat(64),sellerAddress:'seller',netAtomicUnits:'1000000',unit:TEST_USDM}};
const payout={state:'confirmed',fundTxHash:'c'.repeat(64),claimTxHash:'d'.repeat(64),recipientAddress:'recipient',receipt:{verified:true,network:'Preprod',txHash:'d'.repeat(64),recipientAddress:'recipient',amount:'2000000',poolRemainingLovelace:'18000000'}};
test('balances count matching chain receipts, never approvals or demo credits',()=>{
 assert.deepEqual(realPaymentsSummary([{analysisPayment:ai,payout},{payment:'Paid',funding:{total:1000}}]),{aiFunded:1,aiPaid:1,adaFunded:20,adaPaid:2,adaRemaining:18});
 assert.equal(aiPaid({...ai,receipt:{...ai.receipt,unit:'lovelace'}}),false);assert.equal(participantPaid({payout:{...payout,receipt:{...payout.receipt,recipientAddress:'wrong'}}}),false);
 assert.equal(realPaymentsSummary([{payout:{...payout,state:'submitted',receipt:null}}]).adaPaid,0);
});
test('ZK panel distinguishes submitted proof from on-chain verification and explains privacy scope',()=>{
 const pending=proofCard({payout:{...payout,state:'submitted',receipt:null}});assert.match(pending,/Private proof received/);assert.doesNotMatch(pending,/class="complete">Contract verifies/);
 const paid=proofCard({payout});assert.match(paid,/ZK proof verified on Cardano/);assert.match(paid,/backend and AI service still process the answers/);assert.match(paid,new RegExp(payout.claimTxHash));
});
test('paid UI identifies legacy analyses and escapes untrusted payment metadata',()=>{
 assert.match(paidAnalysisCard({ai:{}}),/no Masumi payment/);
 assert.match(paidAnalysisCard({id:'R-a123'},true),/Request sponsored analysis/);
 const html=paidAnalysisCard({id:'R-a123',analysisPayment:{...ai,jobId:'<script>alert(1)</script>',error:'<img src=x onerror=alert(1)>'}},true);
 assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.match(sponsorPayments([{analysisPayment:ai,payout}]),/separate assets/);
});
