/*
  # Add action payload to auto contact jobs

  Stores extra data for webhook/email/task actions.
*/

ALTER TABLE auto_contact_flow_jobs
  ADD COLUMN IF NOT EXISTS action_payload jsonb;
