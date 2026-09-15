-- Oportunidades representam ciclos de venda/núcleos comerciais; leads continuam
-- sendo pessoas de contato e podem participar de ciclos distintos ao mesmo tempo.
-- A unicidade é por oportunidade + vínculo ativo. Remoções são soft-delete para
-- preservar histórico de participação e nunca apagam leads ou oportunidades.

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  primary_contact_lead_id uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  responsavel text REFERENCES public.lead_responsaveis(value) ON UPDATE RESTRICT ON DELETE RESTRICT,
  origem text REFERENCES public.lead_origens(nome) ON UPDATE RESTRICT ON DELETE RESTRICT,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT opportunities_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT opportunities_status_valid CHECK (status IN ('open', 'qualified', 'proposal', 'won', 'lost')),
  CONSTRAINT opportunities_notes_length CHECK (notes IS NULL OR char_length(notes) <= 8000),
  CONSTRAINT opportunities_archive_timestamp CHECK (archived = (archived_at IS NOT NULL))
);

CREATE TABLE public.opportunity_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  member_role text NOT NULL DEFAULT 'member',
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT opportunity_leads_role_length CHECK (char_length(btrim(member_role)) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX opportunity_leads_one_active_membership_idx
  ON public.opportunity_leads (opportunity_id, lead_id)
  WHERE removed_at IS NULL;
CREATE INDEX opportunity_leads_active_lead_idx
  ON public.opportunity_leads (lead_id, opportunity_id)
  WHERE removed_at IS NULL;
CREATE INDEX opportunity_leads_history_idx
  ON public.opportunity_leads (opportunity_id, added_at DESC);
CREATE INDEX opportunities_active_updated_idx
  ON public.opportunities (updated_at DESC, id)
  WHERE archived = false;
CREATE INDEX opportunities_primary_contact_idx
  ON public.opportunities (primary_contact_lead_id)
  WHERE primary_contact_lead_id IS NOT NULL;

-- RLS plus zero client grants: MCP access goes only through narrow RPCs.
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.opportunities, public.opportunity_leads FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.mcp_opportunity_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'archived', 'lead_added', 'lead_removed', 'primary_contact_changed')),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  related_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_opportunity_audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX mcp_opportunity_audit_opportunity_created_idx
  ON public.mcp_opportunity_audit_log (opportunity_id, created_at DESC);
CREATE INDEX mcp_opportunity_audit_actor_created_idx
  ON public.mcp_opportunity_audit_log (actor_id, created_at DESC);
ALTER TABLE public.mcp_opportunity_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_opportunity_audit_log FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.mcp_opportunity_requests (
  actor_id uuid NOT NULL,
  client_request_id text NOT NULL,
  request_signature text NOT NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, client_request_id),
  CONSTRAINT mcp_opportunity_request_id_length CHECK (client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$')
);
ALTER TABLE public.mcp_opportunity_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_opportunity_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mcp_opportunity_assert_active_admin(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  -- Match chatgpt-mcp/oauth.ts ensureActiveAdmin on every call; the service-role
  -- credential only transports the actor id and does not grant CRM authorization.
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles AS up
    WHERE up.id = p_actor_user_id
      AND up.role = 'admin'
      AND NULLIF(btrim(up.email), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MCP_ADMIN_REQUIRED';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_opportunity_audit(
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_changed_fields text[] DEFAULT ARRAY[]::text[],
  p_related_lead_id uuid DEFAULT NULL,
  p_client_request_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  INSERT INTO public.mcp_opportunity_audit_log (
    opportunity_id, actor_id, action, changed_fields, related_lead_id,
    client_request_id, metadata
  ) VALUES (
    p_opportunity_id, p_actor_user_id, p_action,
    COALESCE(p_changed_fields, ARRAY[]::text[]), p_related_lead_id,
    p_client_request_id, COALESCE(p_metadata, '{}'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_opportunity_snapshot(
  p_opportunity_id uuid,
  p_include_members boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_snapshot jsonb;
  v_members jsonb;
  v_member_count bigint;
  v_historical_member_count bigint;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'status', o.status,
    'primary_contact_lead_id', o.primary_contact_lead_id,
    'responsavel', o.responsavel,
    'origem', o.origem,
    'notes', o.notes,
    'archived', o.archived,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'archived_at', o.archived_at
  )
  INTO v_snapshot
  FROM public.opportunities AS o
  WHERE o.id = p_opportunity_id;

  IF v_snapshot IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_include_members THEN
    SELECT count(*) FILTER (WHERE ol.removed_at IS NULL),
           count(*) FILTER (WHERE ol.removed_at IS NOT NULL)
      INTO v_member_count, v_historical_member_count
      FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = p_opportunity_id;

    SELECT COALESCE(jsonb_agg(member_row ORDER BY member_row->>'added_at', member_row->>'lead_id'), '[]'::jsonb)
      INTO v_members
      FROM (
        SELECT jsonb_build_object(
          'lead_id', l.id,
          'name', l.nome_completo,
          'phone', l.telefone,
          'email', l.email,
          'status', l.status,
          'responsavel', l.responsavel,
          'member_role', ol.member_role,
          'added_at', ol.added_at,
          'is_primary_contact', (l.id = o.primary_contact_lead_id)
        ) AS member_row
          FROM public.opportunity_leads AS ol
          JOIN public.leads AS l ON l.id = ol.lead_id
          JOIN public.opportunities AS o ON o.id = ol.opportunity_id
         WHERE ol.opportunity_id = p_opportunity_id
           AND ol.removed_at IS NULL
         ORDER BY ol.added_at, ol.lead_id
         LIMIT 50
      ) AS members;

    v_snapshot := v_snapshot || jsonb_build_object(
      'members', COALESCE(v_members, '[]'::jsonb),
      'member_count', COALESCE(v_member_count, 0),
      'members_truncated', COALESCE(v_member_count, 0) > 50,
      'historical_member_count', COALESCE(v_historical_member_count, 0)
    );
  END IF;

  RETURN v_snapshot;
END;
$function$;

-- Deferred checks permit creating an opportunity, linking its initial contact,
-- and setting that contact in one transaction while rejecting orphan primaries.
CREATE OR REPLACE FUNCTION public.mcp_opportunity_assert_primary_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_opportunity_id uuid;
  v_primary_lead_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'opportunities' THEN
    v_opportunity_id := COALESCE(NEW.id, OLD.id);
    v_primary_lead_id := NEW.primary_contact_lead_id;
  ELSE
    v_opportunity_id := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
    SELECT o.primary_contact_lead_id
      INTO v_primary_lead_id
      FROM public.opportunities AS o
     WHERE o.id = v_opportunity_id;
  END IF;

  IF v_primary_lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = v_opportunity_id
       AND ol.lead_id = v_primary_lead_id
       AND ol.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'OPPORTUNITY_PRIMARY_CONTACT_MUST_BE_ACTIVE_MEMBER';
  END IF;

  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER opportunities_primary_membership_check
AFTER INSERT OR UPDATE OF primary_contact_lead_id ON public.opportunities
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.mcp_opportunity_assert_primary_membership();

CREATE CONSTRAINT TRIGGER opportunity_leads_primary_membership_check
AFTER INSERT OR UPDATE OF opportunity_id, lead_id, removed_at ON public.opportunity_leads
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.mcp_opportunity_assert_primary_membership();

REVOKE ALL ON FUNCTION public.mcp_opportunity_assert_active_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_opportunity_audit(uuid, uuid, text, text[], uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_opportunity_snapshot(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_opportunity_assert_primary_membership() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mcp_create_opportunity(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_name text,
  p_status text DEFAULT 'open',
  p_responsavel text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_member_lead_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_primary_contact_lead_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_status text := COALESCE(p_status, 'open');
  v_responsavel text := NULLIF(btrim(p_responsavel), '');
  v_origem text := NULLIF(btrim(p_origem), '');
  v_member_lead_ids uuid[];
  v_lead_id uuid;
  v_signature_payload jsonb;
  v_signature text;
  v_existing_signature text;
  v_existing_opportunity_id uuid;
  v_reserved boolean := false;
  v_opportunity_id uuid;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);

  IF p_client_request_id IS NULL OR p_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'client_request_id deve ter de 1 a 128 caracteres alfanuméricos, : _ ou -.'));
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 160 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'name deve ter de 1 a 160 caracteres.'));
  END IF;
  IF v_status NOT IN ('open', 'qualified', 'proposal', 'won', 'lost') THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_STATUS', 'message', 'status deve ser open, qualified, proposal, won ou lost.'));
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 8000 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'notes excede o limite de 8000 caracteres.'));
  END IF;
  IF COALESCE(cardinality(p_member_lead_ids), 0) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'Informe no máximo 50 leads na criação.'));
  END IF;
  IF p_member_lead_ids IS NOT NULL AND array_position(p_member_lead_ids, NULL) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'member_lead_ids não aceita valores nulos.'));
  END IF;

  SELECT COALESCE(array_agg(ids.lead_id ORDER BY ids.lead_id), ARRAY[]::uuid[])
    INTO v_member_lead_ids
    FROM (
      SELECT DISTINCT input.lead_id
        FROM unnest(COALESCE(p_member_lead_ids, ARRAY[]::uuid[])) AS input(lead_id)
       WHERE input.lead_id IS NOT NULL
    ) AS ids;
  IF p_primary_contact_lead_id IS NOT NULL
     AND NOT (p_primary_contact_lead_id = ANY(v_member_lead_ids)) THEN
    v_member_lead_ids := array_append(v_member_lead_ids, p_primary_contact_lead_id);
    SELECT COALESCE(array_agg(member_id ORDER BY member_id), ARRAY[]::uuid[])
      INTO v_member_lead_ids
      FROM unnest(v_member_lead_ids) AS input(member_id);
  END IF;
  IF cardinality(v_member_lead_ids) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'A oportunidade aceita no máximo 50 leads iniciais.'));
  END IF;

  v_signature_payload := jsonb_build_object(
    'name', v_name,
    'status', v_status,
    'responsavel', v_responsavel,
    'origem', v_origem,
    'notes', p_notes,
    'member_lead_ids', to_jsonb(v_member_lead_ids),
    'primary_contact_lead_id', p_primary_contact_lead_id
  );
  v_signature := encode(pg_catalog.sha256(convert_to(v_signature_payload::text, 'UTF8')), 'hex');

  -- Fast path for retries, before checking mutable catalog/lead state.
  SELECT request_signature, opportunity_id
    INTO v_existing_signature, v_existing_opportunity_id
    FROM public.mcp_opportunity_requests
   WHERE actor_id = p_actor_user_id
     AND client_request_id = p_client_request_id;
  IF FOUND THEN
    IF v_existing_signature <> v_signature THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'client_request_id já foi usado com parâmetros diferentes.'));
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'client_request_id', p_client_request_id,
      'opportunity', public.mcp_opportunity_snapshot(v_existing_opportunity_id, false));
  END IF;

  IF v_responsavel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lead_responsaveis AS r WHERE r.value = v_responsavel AND r.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_RESPONSAVEL', 'message', 'responsavel deve corresponder a um responsável ativo do CRM.'));
  END IF;
  IF v_origem IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lead_origens AS o WHERE o.nome = v_origem AND o.ativo = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_ORIGEM', 'message', 'origem deve corresponder a uma origem ativa do CRM.'));
  END IF;
  FOREACH v_lead_id IN ARRAY v_member_lead_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.leads AS l WHERE l.id = v_lead_id AND COALESCE(l.arquivado, false) = false) THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'LEAD_NOT_FOUND_OR_ARCHIVED', 'message', 'Todos os leads informados devem existir e estar ativos.'));
    END IF;
  END LOOP;

  INSERT INTO public.mcp_opportunity_requests (actor_id, client_request_id, request_signature, opportunity_id)
  VALUES (p_actor_user_id, p_client_request_id, v_signature, NULL)
  ON CONFLICT (actor_id, client_request_id) DO NOTHING
  RETURNING true INTO v_reserved;

  IF NOT COALESCE(v_reserved, false) THEN
    SELECT request_signature, opportunity_id
      INTO v_existing_signature, v_existing_opportunity_id
      FROM public.mcp_opportunity_requests
     WHERE actor_id = p_actor_user_id
       AND client_request_id = p_client_request_id
     FOR UPDATE;
    IF v_existing_signature <> v_signature THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'client_request_id já foi usado com parâmetros diferentes.'));
    END IF;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'client_request_id', p_client_request_id,
      'opportunity', public.mcp_opportunity_snapshot(v_existing_opportunity_id, false));
  END IF;

  v_opportunity_id := gen_random_uuid();
  INSERT INTO public.opportunities (
    id, name, status, responsavel, origem, notes, primary_contact_lead_id,
    created_by, updated_by
  ) VALUES (
    v_opportunity_id, v_name, v_status, v_responsavel, v_origem, p_notes, NULL,
    p_actor_user_id, p_actor_user_id
  );

  FOREACH v_lead_id IN ARRAY v_member_lead_ids LOOP
    INSERT INTO public.opportunity_leads (opportunity_id, lead_id, member_role, added_by)
    VALUES (v_opportunity_id, v_lead_id, 'member', p_actor_user_id);
  END LOOP;

  UPDATE public.opportunities
     SET primary_contact_lead_id = p_primary_contact_lead_id,
         updated_at = clock_timestamp(),
         updated_by = p_actor_user_id
   WHERE id = v_opportunity_id;

  PERFORM public.mcp_opportunity_audit(
    v_opportunity_id, p_actor_user_id, 'created',
    ARRAY['name', 'status', 'responsavel', 'origem', 'notes', 'members', 'primary_contact_lead_id'],
    p_primary_contact_lead_id, p_client_request_id,
    jsonb_build_object('member_lead_ids', to_jsonb(v_member_lead_ids), 'status', v_status)
  );

  UPDATE public.mcp_opportunity_requests
     SET opportunity_id = v_opportunity_id
   WHERE actor_id = p_actor_user_id
     AND client_request_id = p_client_request_id;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'client_request_id', p_client_request_id,
    'opportunity', public.mcp_opportunity_snapshot(v_opportunity_id, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_get_opportunity(
  p_actor_user_id uuid,
  p_opportunity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_opportunity jsonb;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  v_opportunity := public.mcp_opportunity_snapshot(p_opportunity_id, false);
  IF v_opportunity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  RETURN jsonb_build_object('success', true, 'opportunity', v_opportunity);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_get_opportunity_360(
  p_actor_user_id uuid,
  p_opportunity_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_opportunity jsonb;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  v_opportunity := public.mcp_opportunity_snapshot(p_opportunity_id, true);
  IF v_opportunity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  RETURN jsonb_build_object('success', true, 'opportunity', v_opportunity);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_update_opportunity(
  p_actor_user_id uuid,
  p_opportunity_id uuid,
  p_expected_updated_at timestamptz,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.opportunities%ROWTYPE;
  v_name text;
  v_status text;
  v_responsavel text;
  v_origem text;
  v_notes text;
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'expected_updated_at é obrigatório.'));
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'Informe um objeto patch com ao menos um campo.'));
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_patch) AS supplied(field_name)
     WHERE supplied.field_name NOT IN ('name', 'status', 'responsavel', 'origem', 'notes')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'O patch contém campos não suportados.'));
  END IF;

  SELECT * INTO v_current
    FROM public.opportunities AS o
   WHERE o.id = p_opportunity_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'STALE_WRITE', 'message', 'A oportunidade foi alterada desde a leitura; recarregue antes de atualizar.',
      'current_updated_at', v_current.updated_at
    ));
  END IF;
  IF v_current.archived THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'OPPORTUNITY_ARCHIVED', 'message', 'Oportunidades arquivadas não podem ser alteradas.'));
  END IF;

  v_name := v_current.name;
  v_status := v_current.status;
  v_responsavel := v_current.responsavel;
  v_origem := v_current.origem;
  v_notes := v_current.notes;

  IF p_patch ? 'name' THEN
    IF jsonb_typeof(p_patch->'name') <> 'string' THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'name não pode ser nulo.'));
    END IF;
    v_name := btrim(COALESCE(p_patch->>'name', ''));
    IF char_length(v_name) NOT BETWEEN 1 AND 160 THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'name deve ter de 1 a 160 caracteres.'));
    END IF;
  END IF;
  IF p_patch ? 'status' THEN
    IF jsonb_typeof(p_patch->'status') <> 'string' THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_STATUS', 'message', 'status deve ser um dos valores permitidos.'));
    END IF;
    v_status := p_patch->>'status';
    IF v_status IS NULL OR v_status NOT IN ('open', 'qualified', 'proposal', 'won', 'lost') THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_STATUS', 'message', 'status deve ser open, qualified, proposal, won ou lost.'));
    END IF;
  END IF;
  IF p_patch ? 'responsavel' THEN
    IF jsonb_typeof(p_patch->'responsavel') NOT IN ('string', 'null') THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_RESPONSAVEL', 'message', 'responsavel deve ser texto ou nulo.'));
    END IF;
    v_responsavel := NULLIF(btrim(p_patch->>'responsavel'), '');
    IF v_responsavel IS DISTINCT FROM v_current.responsavel
       AND v_responsavel IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.lead_responsaveis AS r WHERE r.value = v_responsavel AND r.ativo = true) THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_RESPONSAVEL', 'message', 'responsavel deve corresponder a um responsável ativo do CRM.'));
    END IF;
  END IF;
  IF p_patch ? 'origem' THEN
    IF jsonb_typeof(p_patch->'origem') NOT IN ('string', 'null') THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_ORIGEM', 'message', 'origem deve ser texto ou nulo.'));
    END IF;
    v_origem := NULLIF(btrim(p_patch->>'origem'), '');
    IF v_origem IS DISTINCT FROM v_current.origem
       AND v_origem IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.lead_origens AS o WHERE o.nome = v_origem AND o.ativo = true) THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_ORIGEM', 'message', 'origem deve corresponder a uma origem ativa do CRM.'));
    END IF;
  END IF;
  IF p_patch ? 'notes' THEN
    IF jsonb_typeof(p_patch->'notes') NOT IN ('string', 'null') THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'notes deve ser texto ou nulo.'));
    END IF;
    v_notes := p_patch->>'notes';
    IF v_notes IS NOT NULL AND char_length(v_notes) > 8000 THEN
      RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'notes excede o limite de 8000 caracteres.'));
    END IF;
  END IF;

  IF v_name IS DISTINCT FROM v_current.name THEN v_changed_fields := array_append(v_changed_fields, 'name'); END IF;
  IF v_status IS DISTINCT FROM v_current.status THEN v_changed_fields := array_append(v_changed_fields, 'status'); END IF;
  IF v_responsavel IS DISTINCT FROM v_current.responsavel THEN v_changed_fields := array_append(v_changed_fields, 'responsavel'); END IF;
  IF v_origem IS DISTINCT FROM v_current.origem THEN v_changed_fields := array_append(v_changed_fields, 'origem'); END IF;
  IF v_notes IS DISTINCT FROM v_current.notes THEN v_changed_fields := array_append(v_changed_fields, 'notes'); END IF;

  IF cardinality(v_changed_fields) = 0 THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
  END IF;

  UPDATE public.opportunities
     SET name = v_name,
         status = v_status,
         responsavel = v_responsavel,
         origem = v_origem,
         notes = v_notes,
         updated_at = clock_timestamp(),
         updated_by = p_actor_user_id
   WHERE id = p_opportunity_id;

  PERFORM public.mcp_opportunity_audit(
    p_opportunity_id, p_actor_user_id, 'updated', v_changed_fields, NULL, NULL,
    jsonb_build_object('status', v_status)
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false,
    'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_archive_opportunity(
  p_actor_user_id uuid,
  p_opportunity_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.opportunities%ROWTYPE;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'expected_updated_at é obrigatório.'));
  END IF;
  SELECT * INTO v_current
    FROM public.opportunities AS o
   WHERE o.id = p_opportunity_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  IF v_current.archived THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'STALE_WRITE', 'message', 'A oportunidade foi alterada desde a leitura; recarregue antes de arquivar.',
      'current_updated_at', v_current.updated_at
    ));
  END IF;

  UPDATE public.opportunities
     SET archived = true,
         archived_at = clock_timestamp(),
         archived_by = p_actor_user_id,
         updated_at = clock_timestamp(),
         updated_by = p_actor_user_id
   WHERE id = p_opportunity_id;

  PERFORM public.mcp_opportunity_audit(
    p_opportunity_id, p_actor_user_id, 'archived', ARRAY['archived'], NULL, NULL, '{}'::jsonb
  );
  RETURN jsonb_build_object('success', true, 'duplicate', false,
    'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_add_lead_to_opportunity(
  p_actor_user_id uuid,
  p_opportunity_id uuid,
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_member_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.opportunities%ROWTYPE;
  v_member_role text := btrim(COALESCE(p_member_role, 'member'));
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'expected_updated_at é obrigatório.'));
  END IF;
  IF p_lead_id IS NULL OR char_length(v_member_role) NOT BETWEEN 1 AND 64 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'lead_id e member_role válido são obrigatórios.'));
  END IF;

  SELECT * INTO v_current
    FROM public.opportunities AS o
   WHERE o.id = p_opportunity_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  IF v_current.archived THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'OPPORTUNITY_ARCHIVED', 'message', 'Não é possível adicionar membros a uma oportunidade arquivada.'));
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = p_opportunity_id
       AND ol.lead_id = p_lead_id
       AND ol.removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
  END IF;
  IF (
    SELECT count(*) FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = p_opportunity_id
       AND ol.removed_at IS NULL
  ) >= 50 THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'OPPORTUNITY_MEMBER_LIMIT', 'message', 'Uma oportunidade pode conter no máximo 50 leads ativos.'
    ));
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'STALE_WRITE', 'message', 'A oportunidade foi alterada desde a leitura; recarregue antes de adicionar o lead.',
      'current_updated_at', v_current.updated_at
    ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.leads AS l
     WHERE l.id = p_lead_id
       AND COALESCE(l.arquivado, false) = false
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'LEAD_NOT_FOUND_OR_ARCHIVED', 'message', 'O lead deve existir e estar ativo.'));
  END IF;

  INSERT INTO public.opportunity_leads (opportunity_id, lead_id, member_role, added_by)
  VALUES (p_opportunity_id, p_lead_id, v_member_role, p_actor_user_id);
  UPDATE public.opportunities
     SET updated_at = clock_timestamp(), updated_by = p_actor_user_id
   WHERE id = p_opportunity_id;
  PERFORM public.mcp_opportunity_audit(
    p_opportunity_id, p_actor_user_id, 'lead_added', ARRAY['members'], p_lead_id, NULL,
    jsonb_build_object('member_role', v_member_role)
  );
  RETURN jsonb_build_object('success', true, 'duplicate', false,
    'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_remove_lead_from_opportunity(
  p_actor_user_id uuid,
  p_opportunity_id uuid,
  p_lead_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.opportunities%ROWTYPE;
  v_member_role text;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'expected_updated_at é obrigatório.'));
  END IF;
  IF p_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'lead_id é obrigatório.'));
  END IF;

  SELECT * INTO v_current
    FROM public.opportunities AS o
   WHERE o.id = p_opportunity_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  IF v_current.archived THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'OPPORTUNITY_ARCHIVED', 'message', 'Não é possível remover membros de uma oportunidade arquivada.'));
  END IF;
  SELECT ol.member_role INTO v_member_role
    FROM public.opportunity_leads AS ol
   WHERE ol.opportunity_id = p_opportunity_id
     AND ol.lead_id = p_lead_id
     AND ol.removed_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.opportunity_leads AS ol WHERE ol.opportunity_id = p_opportunity_id AND ol.lead_id = p_lead_id) THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true,
        'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
    END IF;
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'LEAD_NOT_ASSOCIATED', 'message', 'O lead não está associado a esta oportunidade.'));
  END IF;
  IF v_current.primary_contact_lead_id = p_lead_id THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'PRIMARY_CONTACT_REQUIRED', 'message', 'Defina outro contato principal ou limpe o contato principal antes de remover este lead.'));
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'STALE_WRITE', 'message', 'A oportunidade foi alterada desde a leitura; recarregue antes de remover o lead.',
      'current_updated_at', v_current.updated_at
    ));
  END IF;

  UPDATE public.opportunity_leads
     SET removed_at = clock_timestamp(), removed_by = p_actor_user_id
   WHERE opportunity_id = p_opportunity_id
     AND lead_id = p_lead_id
     AND removed_at IS NULL;
  UPDATE public.opportunities
     SET updated_at = clock_timestamp(), updated_by = p_actor_user_id
   WHERE id = p_opportunity_id;
  PERFORM public.mcp_opportunity_audit(
    p_opportunity_id, p_actor_user_id, 'lead_removed', ARRAY['members'], p_lead_id, NULL,
    jsonb_build_object('member_role', v_member_role)
  );
  RETURN jsonb_build_object('success', true, 'duplicate', false,
    'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_set_opportunity_primary_contact(
  p_actor_user_id uuid,
  p_opportunity_id uuid,
  p_primary_contact_lead_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_current public.opportunities%ROWTYPE;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INPUT', 'message', 'expected_updated_at é obrigatório.'));
  END IF;
  SELECT * INTO v_current
    FROM public.opportunities AS o
   WHERE o.id = p_opportunity_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Oportunidade não encontrada.'));
  END IF;
  IF v_current.archived THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'OPPORTUNITY_ARCHIVED', 'message', 'Oportunidades arquivadas não podem ser alteradas.'));
  END IF;
  IF v_current.primary_contact_lead_id IS NOT DISTINCT FROM p_primary_contact_lead_id THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true,
      'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
  END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'STALE_WRITE', 'message', 'A oportunidade foi alterada desde a leitura; recarregue antes de trocar o contato principal.',
      'current_updated_at', v_current.updated_at
    ));
  END IF;
  IF p_primary_contact_lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = p_opportunity_id
       AND ol.lead_id = p_primary_contact_lead_id
       AND ol.removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'LEAD_NOT_ASSOCIATED', 'message', 'O contato principal deve ser um membro ativo da oportunidade.'));
  END IF;

  UPDATE public.opportunities
     SET primary_contact_lead_id = p_primary_contact_lead_id,
         updated_at = clock_timestamp(),
         updated_by = p_actor_user_id
   WHERE id = p_opportunity_id;
  PERFORM public.mcp_opportunity_audit(
    p_opportunity_id, p_actor_user_id, 'primary_contact_changed',
    ARRAY['primary_contact_lead_id'], p_primary_contact_lead_id, NULL,
    jsonb_build_object('previous_lead_id', v_current.primary_contact_lead_id)
  );
  RETURN jsonb_build_object('success', true, 'duplicate', false,
    'opportunity', public.mcp_opportunity_snapshot(p_opportunity_id, false));
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_create_opportunity(uuid, text, text, text, text, text, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_get_opportunity(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_get_opportunity_360(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_update_opportunity(uuid, uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_archive_opportunity(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_add_lead_to_opportunity(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_remove_lead_from_opportunity(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_set_opportunity_primary_contact(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mcp_create_opportunity(uuid, text, text, text, text, text, text, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_get_opportunity(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_get_opportunity_360(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_update_opportunity(uuid, uuid, timestamptz, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_archive_opportunity(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_add_lead_to_opportunity(uuid, uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_remove_lead_from_opportunity(uuid, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_set_opportunity_primary_contact(uuid, uuid, uuid, timestamptz) TO service_role;
