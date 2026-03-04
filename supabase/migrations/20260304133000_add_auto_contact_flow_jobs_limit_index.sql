/*
  # Add index for per-flow daily limit

  Optimizes daily send limit queries by flow in auto_contact_flow_jobs.
*/

CREATE INDEX IF NOT EXISTS idx_auto_contact_flow_jobs_flow_action_status_updated
  ON auto_contact_flow_jobs (flow_id, action_type, status, updated_at);
