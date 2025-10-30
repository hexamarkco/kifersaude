/*
  # Add Custom Follow-up Rules System

  1. New Tables
    - `follow_up_custom_rules`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `status` (text) - Lead status this rule applies to
      - `days_after` (integer) - Days after status change
      - `title` (text) - Reminder title
      - `description` (text) - Reminder description
      - `priority` (text) - Priority level (baixa, media, alta)
      - `active` (boolean) - Whether this rule is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `follow_up_custom_rules` table
    - Add policy for authenticated users to manage their custom rules

  3. Indexes
    - Add index on lead_id for faster lookups
    - Add index on (lead_id, status, active) for efficient rule queries
*/

CREATE TABLE IF NOT EXISTS follow_up_custom_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  days_after integer NOT NULL CHECK (days_after >= 0),
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE follow_up_custom_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view custom rules"
  ON follow_up_custom_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert custom rules"
  ON follow_up_custom_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update custom rules"
  ON follow_up_custom_rules
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete custom rules"
  ON follow_up_custom_rules
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_follow_up_custom_rules_lead_id 
  ON follow_up_custom_rules(lead_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_custom_rules_lead_status_active 
  ON follow_up_custom_rules(lead_id, status, active) 
  WHERE active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_follow_up_custom_rules_updated_at'
  ) THEN
    CREATE FUNCTION update_follow_up_custom_rules_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_follow_up_custom_rules_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_follow_up_custom_rules_updated_at
      BEFORE UPDATE ON follow_up_custom_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_follow_up_custom_rules_updated_at();
  END IF;
END $$;