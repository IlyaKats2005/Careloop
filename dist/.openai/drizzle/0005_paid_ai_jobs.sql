CREATE TABLE care_paid_ai_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 report_id TEXT NOT NULL UNIQUE REFERENCES care_reports(id),
 nonce TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued',
 metadata_json TEXT NOT NULL DEFAULT '{}',
 error TEXT NOT NULL DEFAULT '',
 lease_token TEXT,
 lease_worker TEXT,
 lease_expires_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX care_paid_ai_jobs_queue ON care_paid_ai_jobs(state, updated_at);
