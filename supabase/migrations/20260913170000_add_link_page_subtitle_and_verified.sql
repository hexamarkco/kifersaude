/*
  # Add subtitle and verified badge to the /links page profile

  1. Changes
    - `public_link_page_settings.subtitle` (text, nullable) — short tagline
      shown right under the page title, separate from the longer `bio`.
    - `public_link_page_settings.is_verified` (boolean, default false) —
      shows a verified badge over the profile photo on the public page.
*/

ALTER TABLE public_link_page_settings
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
