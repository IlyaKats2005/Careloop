# Render deployment proposal

Recommended configuration: one Frankfurt background worker, `1c-2g` (2 GB RAM), with a 1 GB persistent disk. Published base prices checked on 31 October 2026 are $25/month compute + $0.25/month disk, before tax or additional usage. The 2 GB choice provides memory headroom for transaction construction and verification; actual cloud memory consumption is not yet measured. This hosts only the sponsor relay; it does not move the separate Masumi/PostgreSQL services.

Sources: https://render.com/pricing and https://render.com/docs/blueprint-spec

1. Sign into https://dashboard.render.com/ and connect the Careloop repository. Verify the displayed price before purchasing. Import the root `render.yaml` Blueprint.
2. Set the existing relay token privately. The service starts with `SPONSOR_START_ENABLED=false`: it cannot submit transactions in this mode. Deployment has not been performed merely by committing this file.
3. Follow the migration steps in README.md: stop the old signer and preserve its complete journal. Transfer it privately into `/var/data/sponsor-relay/`, owned by the runtime user, directory mode 700 and journal mode 600. Remove only the old stopped process's lock after confirming it is stopped. Never clear payment history or create an empty replacement journal.
4. Add Render secret files named `seed.txt` and `blockfrost.key` using the existing dedicated Preprod credentials. Do not paste them into chat, Git, logs or this document. The wrapper copies these to an ephemeral private directory with mode 600.
5. Set `SPONSOR_START_ENABLED=true` and redeploy. Keep one instance. Check logs, the website's fresh heartbeat, budget and a new live payment. The wrapper refuses to start without the migrated journal.
6. Open the participant check-in. Verify a new approved report reaches confirmed payment; use a separate participant/program for a genuine hold result. Record the actual transaction hashes and show the live report.

The Docker package is an alternative for a VPS. This Render configuration uses the native Node runtime, so local Docker access is not required. No account or paid service has been created by this preparation. The current worker allowance is ten funded reports and at most 250 test ADA, including the preserved history. Deployment is blocked until a Render account is connected and its charges are authorized. The active Mac relay still owns its journal; do not enable the cloud signer until that relay is stopped and the journal has been transferred. The local GitHub CLI credential also needs renewed access before the latest source can be published to that repository.
