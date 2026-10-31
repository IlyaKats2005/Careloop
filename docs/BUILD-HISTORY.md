# Build history and source provenance

The [official FAQ](https://hackathon.tum-blockchain.com/faq) allows an existing project only when it is meaningfully extended during the event. It also permits open-source libraries, starter kits and AI coding tools. Careloop therefore discloses its earlier prototype rather than describing all source as a new project created from nothing at the event.

## Earlier prototype

Commit [`4887676`](https://github.com/IlyaKats2005/Careloop/commit/4887676f2f87a8015481b177219e2fd1eeea12b9), recorded **29 October 2026 at 18:36 CET**, contains a static website under `dist/` and Sites hosting metadata. That user-interface prototype existed before the hackathon.

## Extensions recorded on 30–31 October

The subsequent history adds the application's backend and payment implementation:

- Accounts, persistent reports, program invitations and database migrations.
- Gemini analysis, evidence validation, completion policy and separate clinical review.
- The Circom reward circuit, Groth16 proof generation, Aiken/Plutus V3 contracts and Cardano transaction builders.
- Masumi paid analysis, actual result/receipt evidence and reproducible integration commands.
- Automatic sponsored funding and claims, durable transaction journals and receipt verification.
- Registered demo wallets, three enrolled clients plus one enrollment example, separate sponsor budgets, persistent refresh and explicit restart.
- Application/integration tests, deployment preparation and submission documentation.

Useful history checkpoints:

| Recorded time (CET) | Commit | Evidence |
| --- | --- | --- |
| 30 Oct, 17:01 | [`45d04ef`](https://github.com/IlyaKats2005/Careloop/commit/45d04ef) | First recorded extension after the static prototype |
| 30 Oct, 20:27 | [`5c48802`](https://github.com/IlyaKats2005/Careloop/commit/5c48802) | Confirmed automatic website payout and relay progress |
| 31 Oct, 08:56 | [`31c79fe`](https://github.com/IlyaKats2005/Careloop/commit/31c79fe) | Sponsor app-credit accounting |
| 31 Oct, 09:03 | [`90dafb4`](https://github.com/IlyaKats2005/Careloop/commit/90dafb4) | Separate AI and client budget panels |
| 31 Oct, 09:23 | [`749605c`](https://github.com/IlyaKats2005/Careloop/commit/749605c) | Refresh persistence and interface changes |
| 31 Oct, 09:43 | [`f882b3b`](https://github.com/IlyaKats2005/Careloop/commit/f882b3b) | Automatic reward-list updates and proof progression |

Inspect the changes directly:

```sh
git log --reverse --format='%h %aI %s'
git diff --stat 4887676f2f87a8015481b177219e2fd1eeea12b9..HEAD
git diff 4887676f2f87a8015481b177219e2fd1eeea12b9..HEAD -- src scripts integrations/masumi zk/reward.circom contracts/validators
```

Commit timestamps show when changes were recorded; they do not independently establish when every line was authored. The organizers determine whether the submitted extension meets their eligibility rule.

## Reused components

Careloop uses the official Masumi TUM quickstart as the basis of its paid-agent integration, and includes upstream Poseidon circuit code, Aiken standard-library code and snarkjs assets. Their provenance, pinned versions and retained licenses are listed in [the README](../README.md#source-provenance-and-licenses) and [Masumi integration documentation](../integrations/masumi/README.md). AI coding tools were used in implementation and documentation. Upstream code is not claimed as original Careloop work.
