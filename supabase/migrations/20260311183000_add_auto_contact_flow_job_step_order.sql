/*
  # Add deterministic step ordering to auto contact flow jobs

  Keeps queued jobs in the same sequence defined in the flow builder,
  especially when multiple steps share the same scheduled timestamp.
*/

ALTER TABLE auto_contact_flow_jobs
  ADD COLUMN IF NOT EXISTS step_order integer;

UPDATE auto_contact_flow_jobs
SET step_order = 0
WHERE step_order IS NULL;

ALTER TABLE auto_contact_flow_jobs
  ALTER COLUMN step_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_jobs_due_with_order
  ON auto_contact_flow_jobs (status, scheduled_at, step_order);
