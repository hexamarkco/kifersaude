/*
  # Ensure category column exists on whatsapp_quick_replies

  ## Summary
  Adds the `category` column to the `whatsapp_quick_replies` table when
  running the migrations on environments where the column might still be
  missing.
*/

ALTER TABLE whatsapp_quick_replies
  ADD COLUMN IF NOT EXISTS category text;
