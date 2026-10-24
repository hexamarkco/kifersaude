BEGIN;

CREATE INDEX IF NOT EXISTS idx_reminders_pending_lead_date
  ON public.reminders (lead_id, data_lembrete)
  WHERE lido = false AND cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_pending_contract_date
  ON public.reminders (contract_id, data_lembrete)
  WHERE lido = false AND cancelled_at IS NULL;

-- VOLATILE is deliberate: AFTER triggers must see reminders changed by the
-- current command. Completion is lido=true even for legacy rows without a
-- completion timestamp. Overdue reminders remain pending.
CREATE OR REPLACE FUNCTION public.get_lead_pending_reminder_date(p_lead_id uuid)
RETURNS timestamptz
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT min(candidate.due_at)
  FROM (
    SELECT min(r.data_lembrete) AS due_at
    FROM public.reminders AS r
    WHERE r.lead_id = p_lead_id AND r.lido = false AND r.cancelled_at IS NULL
    UNION ALL
    SELECT min(r.data_lembrete)
    FROM public.contracts AS c
    JOIN public.reminders AS r ON r.contract_id = c.id
    WHERE c.lead_id = p_lead_id AND r.lido = false AND r.cancelled_at IS NULL
  ) AS candidate;
$function$;
REVOKE ALL ON FUNCTION public.get_lead_pending_reminder_date(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_pending_reminder_date(uuid) TO authenticated, service_role;

-- Internal cache maintenance only; these privileged functions cannot be
-- called through the Data API. Reminder/contract writes retain their RLS.
CREATE OR REPLACE FUNCTION public._refresh_lead_pending_reminder_dates(p_lead_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM id FROM public.leads WHERE id = ANY(p_lead_ids) ORDER BY id FOR UPDATE;
  UPDATE public.leads AS l
  SET proximo_retorno = public.get_lead_pending_reminder_date(l.id)
  WHERE l.id = ANY(p_lead_ids)
    AND l.proximo_retorno IS DISTINCT FROM public.get_lead_pending_reminder_date(l.id);
END;
$function$;
REVOKE ALL ON FUNCTION public._refresh_lead_pending_reminder_dates(uuid[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._sync_lead_pending_reminder_dates()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_lead_ids uuid[] := ARRAY[]::uuid[];
  v_contract_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_lead_ids := array_append(v_lead_ids, OLD.lead_id);
    IF TG_TABLE_NAME = 'reminders' THEN
      v_contract_ids := array_append(v_contract_ids, OLD.contract_id);
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_lead_ids := array_append(v_lead_ids, NEW.lead_id);
    IF TG_TABLE_NAME = 'reminders' THEN
      v_contract_ids := array_append(v_contract_ids, NEW.contract_id);
    END IF;
  END IF;
  v_lead_ids := v_lead_ids || ARRAY(
    SELECT lead_id FROM public.contracts WHERE id = ANY(v_contract_ids)
  );
  PERFORM public._refresh_lead_pending_reminder_dates(v_lead_ids);
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._sync_lead_pending_reminder_dates() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER sync_lead_pending_reminder_dates
AFTER INSERT OR UPDATE OF lead_id, contract_id, data_lembrete, lido, cancelled_at OR DELETE
ON public.reminders FOR EACH ROW EXECUTE FUNCTION public._sync_lead_pending_reminder_dates();
CREATE TRIGGER sync_contract_lead_pending_reminder_dates
AFTER UPDATE OF lead_id OR DELETE
ON public.contracts FOR EACH ROW EXECUTE FUNCTION public._sync_lead_pending_reminder_dates();

CREATE OR REPLACE FUNCTION public._derive_lead_pending_reminder_date()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.proximo_retorno := public.get_lead_pending_reminder_date(NEW.id);
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._derive_lead_pending_reminder_date() FROM PUBLIC, anon, authenticated, service_role;

-- Legacy writers may still try to store a future-only or arbitrary date.
-- Keep this projection derived from the agenda regardless of the caller.
CREATE TRIGGER derive_lead_pending_reminder_date
BEFORE INSERT OR UPDATE OF proximo_retorno ON public.leads
FOR EACH ROW EXECUTE FUNCTION public._derive_lead_pending_reminder_date();

DO $backfill$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(l.id) INTO v_ids
  FROM public.leads AS l
  WHERE l.proximo_retorno IS DISTINCT FROM public.get_lead_pending_reminder_date(l.id);
  PERFORM public._refresh_lead_pending_reminder_dates(v_ids);
END;
$backfill$;

COMMENT ON COLUMN public.leads.proximo_retorno IS
  'Derived from the earliest pending (lido=false, not cancelled) reminder for this lead or its contracts, including overdue reminders. NULL when no pending reminder exists.';
NOTIFY pgrst, 'reload schema';
COMMIT;
