/*
  # Drop Follow-up Custom Rules Table

  Removes the deprecated follow_up_custom_rules table and all related database objects.
*/

-- Remove trigger and function if they exist before dropping the table
DROP TRIGGER IF EXISTS trigger_update_follow_up_custom_rules_updated_at ON follow_up_custom_rules;
DROP FUNCTION IF EXISTS update_follow_up_custom_rules_updated_at();

-- Drop the table and any dependent objects such as policies and indexes
DROP TABLE IF EXISTS follow_up_custom_rules CASCADE;

