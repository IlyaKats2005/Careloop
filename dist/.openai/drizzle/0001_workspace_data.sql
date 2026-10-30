CREATE TABLE care_workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  demo_token_hash TEXT UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('account', 'demo')),
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE care_programs (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES care_workspaces(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL,
  invitation_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX care_programs_workspace_idx ON care_programs(workspace_id);
--> statement-breakpoint
CREATE TABLE care_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES care_programs(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES care_workspaces(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  pseudonym TEXT NOT NULL,
  commitment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(program_id, participant_key),
  UNIQUE(program_id, commitment)
);
--> statement-breakpoint
CREATE INDEX care_enrollments_participant_idx ON care_enrollments(participant_key);
--> statement-breakpoint
CREATE TABLE care_reports (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES care_workspaces(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES care_programs(id) ON DELETE CASCADE,
  enrollment_id TEXT NOT NULL REFERENCES care_enrollments(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL,
  period_label TEXT NOT NULL,
  program_json TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  quality TEXT NOT NULL,
  clinical TEXT NOT NULL,
  payment TEXT NOT NULL,
  ai_json TEXT,
  ai_error TEXT NOT NULL DEFAULT '',
  ai_status TEXT NOT NULL DEFAULT 'pending',
  ai_started_at INTEGER,
  ai_attempts INTEGER NOT NULL DEFAULT 0,
  audit_json TEXT NOT NULL DEFAULT '[]',
  decision TEXT NOT NULL DEFAULT '',
  approval_json TEXT,
  chain_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(program_id, enrollment_id, period_id)
);
--> statement-breakpoint
CREATE INDEX care_reports_workspace_idx ON care_reports(workspace_id);
--> statement-breakpoint
CREATE INDEX care_reports_enrollment_idx ON care_reports(enrollment_id);
