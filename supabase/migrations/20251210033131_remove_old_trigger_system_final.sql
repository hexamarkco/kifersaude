/*
  # Remove Old Trigger-Based Auto-Send System

  ## Overview
  This migration permanently removes the old trigger-based automatic message sending system.
  The system has been replaced with a scheduled processing approach using pg_cron.

  ## What is Removed
  - `trigger_auto_send_on_lead_insert` - Trigger that fired on every lead insert
  - `trigger_auto_send_lead_messages()` - Function that called the Edge Function on insert
  
  ## Why This Change
  The old trigger-based system had limitations:
  - Required webhook to fire on every insert (resource intensive)
  - Could fail silently if Edge Function was unavailable
  - No retry mechanism for failed sends
  - No batch processing capabilities
  
  The new scheduled system:
  - Runs independently via pg_cron every minute
  - Processes leads in batches (50 at a time)
  - Has built-in retry logic (up to 3 attempts)
  - Continues working even if some leads fail
  - Better duplicate detection
  - Self-healing with lock timeout

  ## Notes
  - The auto-send-lead-messages Edge Function is kept for backwards compatibility
  - The new process-pending-leads Edge Function is used by the scheduled system
  - Existing leads are not affected
  - New leads will be processed by the scheduled system
*/

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_send_on_lead_insert ON leads;

-- Drop the function if it exists (CASCADE to remove any dependencies)
DROP FUNCTION IF EXISTS trigger_auto_send_lead_messages() CASCADE;

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Old trigger-based auto-send system removed successfully.';
  RAISE NOTICE 'The new scheduled processing system will now handle automatic message sending.';
  RAISE NOTICE 'To monitor the system, check v_lead_processing_dashboard view.';
END $$;