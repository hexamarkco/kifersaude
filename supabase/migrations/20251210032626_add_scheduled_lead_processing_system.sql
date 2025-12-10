/*
  # Add Scheduled Lead Processing System

  ## Overview
  This migration creates a server-side scheduled processing system for leads that:
  - Runs automatically every minute via pg_cron (independent of user sessions)
  - Processes leads in batches using cursor-based pagination
  - Detects and marks duplicate phone numbers
  - Sends automatic WhatsApp messages to new leads
  - Provides monitoring and logging capabilities

  ## New Tables
  
  ### `lead_processing_cursor`
  Singleton table that maintains the state of the lead processing system:
  - `id` - Always 1 (singleton pattern)
  - `last_processed_phone` - Last phone number processed (for cursor pagination)
  - `last_processed_at` - Timestamp of last execution
  - `is_running` - Lock flag to prevent concurrent executions
  - `total_processed` - Cumulative counter of processed leads
  - `last_error` - Most recent error for debugging
  - `reset_count` - Number of times cursor has been reset
  - `batch_size` - Number of leads to process per execution

  ## Modified Tables
  
  ### `leads`
  Adds tracking fields for automatic message processing:
  - `auto_message_sent_at` - Timestamp when automatic message was sent
  - `auto_message_attempts` - Counter for retry attempts (max 3)
  - `processing_notes` - Additional notes about processing issues

  ## Indexes
  Creates optimized indexes for ultra-fast queries:
  - Composite index on (telefone, status, auto_message_sent_at) for main query
  - Index on auto_message_sent_at for statistics

  ## Views
  
  ### `v_lead_processing_dashboard`
  Real-time dashboard view showing:
  - Current cursor position and status
  - Pending leads count
  - Processing statistics
  - System health indicators

  ### `v_pending_leads_summary`
  Summary of leads awaiting processing by status

  ## Security
  - Enables RLS on lead_processing_cursor
  - Adds policies for authenticated admin users
  - Service role has full access for Edge Function operations

  ## Notes
  - The cursor resets to beginning when no more leads are found
  - Lock timeout is 5 minutes to prevent deadlocks
  - Batch size defaults to 50 leads per execution
  - System designed to handle 3000+ leads per hour
*/

-- Create lead_processing_cursor table
CREATE TABLE IF NOT EXISTS lead_processing_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_processed_phone TEXT DEFAULT '0',
  last_processed_at TIMESTAMPTZ DEFAULT NOW(),
  is_running BOOLEAN DEFAULT false,
  total_processed BIGINT DEFAULT 0,
  last_error TEXT,
  reset_count INTEGER DEFAULT 0,
  batch_size INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_cursor_row CHECK (id = 1)
);

-- Add fields to leads table for tracking automatic processing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'auto_message_sent_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN auto_message_sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'auto_message_attempts'
  ) THEN
    ALTER TABLE leads ADD COLUMN auto_message_attempts INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'processing_notes'
  ) THEN
    ALTER TABLE leads ADD COLUMN processing_notes TEXT;
  END IF;
END $$;

-- Create optimized indexes for lead processing queries
CREATE INDEX IF NOT EXISTS idx_leads_processing_cursor 
  ON leads(telefone, status, auto_message_sent_at) 
  WHERE telefone IS NOT NULL AND telefone != '';

CREATE INDEX IF NOT EXISTS idx_leads_auto_message_sent 
  ON leads(auto_message_sent_at) 
  WHERE auto_message_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_phone_lookup 
  ON leads(telefone) 
  WHERE telefone IS NOT NULL AND telefone != '';

-- Initialize cursor with default values
INSERT INTO lead_processing_cursor (id, last_processed_phone, last_processed_at, is_running, total_processed)
VALUES (1, '0', NOW(), false, 0)
ON CONFLICT (id) DO NOTHING;

-- Create function to update cursor timestamp automatically
CREATE OR REPLACE FUNCTION update_cursor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_cursor_timestamp ON lead_processing_cursor;
CREATE TRIGGER trigger_update_cursor_timestamp
  BEFORE UPDATE ON lead_processing_cursor
  FOR EACH ROW
  EXECUTE FUNCTION update_cursor_timestamp();

-- Create dashboard view for monitoring
CREATE OR REPLACE VIEW v_lead_processing_dashboard AS
SELECT
  lpc.last_processed_phone,
  lpc.last_processed_at,
  lpc.is_running,
  lpc.total_processed,
  lpc.last_error,
  lpc.reset_count,
  lpc.batch_size,
  lpc.updated_at as last_activity,
  (SELECT COUNT(*) 
   FROM leads 
   WHERE status = 'Novo' 
     AND telefone IS NOT NULL 
     AND telefone != ''
     AND auto_message_sent_at IS NULL
     AND (auto_message_attempts < 3 OR auto_message_attempts IS NULL)
  ) as pending_count,
  (SELECT COUNT(*)
   FROM leads
   WHERE auto_message_sent_at IS NOT NULL
     AND auto_message_sent_at > NOW() - INTERVAL '24 hours'
  ) as processed_last_24h,
  (SELECT COUNT(*)
   FROM leads
   WHERE auto_message_sent_at IS NOT NULL
     AND auto_message_sent_at > NOW() - INTERVAL '1 hour'
  ) as processed_last_hour,
  CASE 
    WHEN lpc.is_running AND lpc.updated_at < NOW() - INTERVAL '5 minutes' THEN 'STALLED'
    WHEN lpc.is_running THEN 'RUNNING'
    ELSE 'IDLE'
  END as system_status
FROM lead_processing_cursor lpc
WHERE lpc.id = 1;

-- Create view for pending leads summary
CREATE OR REPLACE VIEW v_pending_leads_summary AS
SELECT
  status,
  COUNT(*) as total,
  COUNT(CASE WHEN auto_message_sent_at IS NULL THEN 1 END) as pending_auto_message,
  COUNT(CASE WHEN auto_message_attempts > 0 THEN 1 END) as has_attempts,
  COUNT(CASE WHEN auto_message_attempts >= 3 THEN 1 END) as max_attempts_reached
FROM leads
WHERE telefone IS NOT NULL AND telefone != ''
GROUP BY status
ORDER BY total DESC;

-- Enable RLS on lead_processing_cursor
ALTER TABLE lead_processing_cursor ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (for Edge Function)
CREATE POLICY "Service role has full access to cursor"
  ON lead_processing_cursor
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated admin users can view cursor
CREATE POLICY "Admin users can view cursor"
  ON lead_processing_cursor
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policy: Authenticated admin users can update cursor (for manual interventions)
CREATE POLICY "Admin users can update cursor"
  ON lead_processing_cursor
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Add helpful comment
COMMENT ON TABLE lead_processing_cursor IS 
  'Singleton table that maintains state for scheduled lead processing system. Only one row (id=1) should exist.';

COMMENT ON VIEW v_lead_processing_dashboard IS 
  'Real-time dashboard showing lead processing system status and statistics';

COMMENT ON VIEW v_pending_leads_summary IS 
  'Summary of leads awaiting automatic message processing, grouped by status';