# Always-on sponsor worker

This package runs the existing Preprod sponsor relay on an always-on Linux machine with Docker Compose. The hosted website remains on Sites. This is deployment preparation, not evidence that a cloud worker has been provisioned.

## Preserve the existing payment history

1. Stop the existing relay process gracefully. Do not run two copies with the same sponsor wallet or journal.
2. Transfer the complete `.local/sponsor-relay/` directory privately to the host. Keep `journal.json`; it preserves the signed bytes and confirmed transactions. Never reset it to recover an uncertain payment.
3. After verifying the old process is stopped, remove its obsolete `relay.lock` from the migrated copy. Do not remove a lock while any worker is running.
4. Transfer the dedicated Preprod seed and Blockfrost key into a private directory as `seed.txt` and `blockfrost.key`, each mode 600. Both directories must belong to the UID/GID used by the service. Do not commit or include them in the Docker build context.
5. Create a private mode-600 environment file containing `SPONSOR_SITE_URL`, `SPONSOR_RELAY_TOKEN`, `SPONSOR_MAX_JOBS` and `SPONSOR_MAX_SPEND_ADA`. Use the same server token and retain the existing budget. The state directory and key paths are provided by Compose.

Set these paths on the host (paths, not secret values):

```sh
export RELAY_ENV_FILE=/srv/careloop/relay.env
export RELAY_STATE_DIR=/srv/careloop/state
export RELAY_PRIVATE_DIR=/srv/careloop/private
export RELAY_UID=1000 RELAY_GID=1000
```

From the repository root:

```sh
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml run --rm sponsor-relay node --use-env-proxy scripts/sponsor-relay.mjs --check
docker compose -f deploy/compose.yaml up -d
docker compose -f deploy/compose.yaml ps
```

The preflight is read-only. Starting the service authorizes existing queued Preprod jobs within its configured limits. Docker restarts an exited process after failure or host restart; it does not automatically replace uncertain transactions. A health check turns unhealthy if the worker stops successfully heartbeating. It does not prove sufficient funds or network transaction confirmation.

Open **Demo tools → Check payment service → Check service** in Careloop and verify a fresh online heartbeat. Then perform a fresh questionnaire-to-payout run. Do not call the migration complete until that report's new transaction confirms.

## Operations

```sh
docker compose -f deploy/compose.yaml logs --tail=50 sponsor-relay
docker compose -f deploy/compose.yaml stop sponsor-relay
```

The server and relay both enforce job budgets. Do not delete journals to replenish the budget. Keep the host awake and connected, maintain a private backup of the state directory, and deploy exactly one worker for this wallet. Masumi's payment service and AI agent are separate processes; this container does not move or host them.
