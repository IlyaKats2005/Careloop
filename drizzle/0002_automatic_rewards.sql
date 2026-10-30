ALTER TABLE care_reports ADD COLUMN recipient_address TEXT;
--> statement-breakpoint
ALTER TABLE care_reports ADD COLUMN reward_decision_json TEXT;
--> statement-breakpoint
ALTER TABLE care_reports ADD COLUMN payout_error TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE care_payment_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 report_id TEXT NOT NULL UNIQUE REFERENCES care_reports(id) ON DELETE CASCADE,
 state TEXT NOT NULL,
 recipient_address TEXT NOT NULL,
 approval_json TEXT NOT NULL,
 claim_json TEXT,
 dep_json TEXT,
 fund_tx_hash TEXT,
 claim_tx_hash TEXT,
 error TEXT NOT NULL DEFAULT '',
 lease_token TEXT,
 lease_worker TEXT,
 lease_expires_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 receipt_json TEXT
);
--> statement-breakpoint
CREATE INDEX care_payment_jobs_state_idx ON care_payment_jobs(state,created_at);
--> statement-breakpoint
CREATE TABLE care_sponsor_relay (id TEXT PRIMARY KEY NOT NULL,last_seen INTEGER NOT NULL);
