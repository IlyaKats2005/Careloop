ALTER TABLE auth_users ADD COLUMN recipient_address TEXT;
--> statement-breakpoint
-- Reuse an existing participant's wallet only when their report history has
-- exactly one receiving address. Existing report destinations remain unchanged.
UPDATE auth_users SET recipient_address=(
  SELECT MAX(r.recipient_address) FROM care_reports r
  JOIN care_enrollments e ON e.id=r.enrollment_id WHERE e.participant_key=auth_users.id
) WHERE role='patient' AND (
  SELECT COUNT(DISTINCT r.recipient_address) FROM care_reports r
  JOIN care_enrollments e ON e.id=r.enrollment_id WHERE e.participant_key=auth_users.id
)=1;
--> statement-breakpoint
CREATE TABLE care_demo_clients (
  workspace_id TEXT NOT NULL REFERENCES care_workspaces(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  seeded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(workspace_id, client_id)
);
