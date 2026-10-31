# Public payment evidence

These files expose fictional demo input/results and public transaction evidence. They exclude private runtime configuration and wallet signing material.

## Qualifying paid AI service

[`masumi-paid-job.json`](masumi-paid-job.json) records one completed **Masumi Standard API** job, including its exact input and result text. This is not a Sokosumi Coworker Task ID.

- Job: `1224781e-666a-42f4-b01e-0b5ebfe24373`.
- Price and verified seller net receipt: **1 test USDM** on Cardano Preprod.
- [Settlement transaction](https://preprod.cardanoscan.io/transaction/e4fcfed76fe2b334fd2aa6d1f8531036513f31e5ec454a64cc8ad0d87a338ef1).
- The settlement was independently reread from Blockfrost on **31 October 2026**. The seller's matching token outputs minus inputs equal 1,000,000 atomic units. Its contract validation succeeded.

The purchaser identifier is a nonsecret request nonce, included so the public input and output hashes can be reproduced. Verify the hashes locally, without API keys or any payment:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inputHash, resultHash} from './integrations/masumi/standard-hash.mjs';
const job = JSON.parse(fs.readFileSync('docs/evidence/masumi-paid-job.json', 'utf8'));
assert.equal(inputHash(job.inputData, job.identifierFromPurchaser), job.inputHash);
assert.equal(resultHash(job.resultText, job.identifierFromPurchaser), job.resultHash);
console.log('Published job input and result hashes match.');
JS
```

These local hash checks establish consistency of the published input/output with the recorded hashes. The independent chain check establishes the seller receipt. They do not validate the clinical quality of the model's answer. The output is preserved as generated, including its limitations, and the model has not been clinically trained or validated for this use.

To create your own paid job, follow [the Masumi run instructions](../../integrations/masumi/README.md). Running that workflow buys another testnet job; it is not necessary to inspect the evidence here.

## Separate participant reward

[`../live-form-payment.json`](../live-form-payment.json) records an automatic website report that received **2 test ADA**, leaving **18 test ADA** from the original 20 in its contract pool.

- [Sponsor funding](https://preprod.cardanoscan.io/transaction/3ab289b65292f64d19211436b9c417c725d332431dad72c9bd1ff5a67f6e3bb1).
- [Participant claim](https://preprod.cardanoscan.io/transaction/822634daddc045a367669ebba5d6c07af7d3ec071c984cabb1c26c27e479f2e5).

This reward is a custom Aiken/Groth16 flow. It supports the project demonstration but does not replace the separate paid AI job required for the Cardano submission. Historical receipts must not be presented as payment for a newly created report.
