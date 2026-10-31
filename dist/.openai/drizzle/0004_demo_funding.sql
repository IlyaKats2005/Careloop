CREATE TABLE care_demo_funding (
 workspace_id TEXT PRIMARY KEY NOT NULL REFERENCES care_workspaces(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0,
 ledger_json TEXT NOT NULL
);
