/*
  # Ensure leads.canal exists for WhatsApp campaign RPCs

  The transactional campaign RPCs depend on the `leads.canal` field when
  filtering and creating targets. Some environments still miss that column,
  which breaks campaign creation even though the frontend has a fallback.
*/

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS canal text;
