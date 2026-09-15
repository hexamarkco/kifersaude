CREATE OR REPLACE FUNCTION public.mcp_get_opportunities_for_leads(
  p_actor_user_id uuid,
  p_lead_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_lead_ids uuid[];
  v_total_opportunities bigint;
  v_opportunity_count integer := 0;
  v_opportunity public.opportunities%ROWTYPE;
  v_members jsonb;
  v_related_lead_ids uuid[];
  v_member_lead_ids uuid[];
  v_member_count bigint;
  v_opportunities jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.mcp_opportunity_assert_active_admin(p_actor_user_id);

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 OR cardinality(p_lead_ids) > 100
     OR array_position(p_lead_ids, NULL) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object(
      'code', 'INVALID_INPUT', 'message', 'Informe de 1 a 100 UUIDs de lead, sem valores nulos.'
    ));
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lead_id), ARRAY[]::uuid[])
    INTO v_lead_ids
    FROM unnest(p_lead_ids) AS input(lead_id);

  SELECT count(DISTINCT o.id)
    INTO v_total_opportunities
    FROM public.opportunities AS o
    JOIN public.opportunity_leads AS ol ON ol.opportunity_id = o.id AND ol.removed_at IS NULL
   WHERE ol.lead_id = ANY(v_lead_ids);

  FOR v_opportunity IN
    SELECT o.*
      FROM public.opportunities AS o
     WHERE EXISTS (
       SELECT 1
         FROM public.opportunity_leads AS ol
        WHERE ol.opportunity_id = o.id
          AND ol.lead_id = ANY(v_lead_ids)
          AND ol.removed_at IS NULL
     )
     ORDER BY o.updated_at DESC, o.id
     LIMIT 20
  LOOP
    SELECT count(*)
      INTO v_member_count
      FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = v_opportunity.id
       AND ol.removed_at IS NULL;

    SELECT COALESCE(jsonb_agg(member_row ORDER BY is_primary_contact DESC, lead_id), '[]'::jsonb)
      INTO v_members
      FROM (
        SELECT jsonb_build_object(
                 'lead_id', l.id,
                 'name', l.nome_completo,
                 'status', l.status,
                 'member_role', ol.member_role,
                 'is_primary_contact', l.id = v_opportunity.primary_contact_lead_id
               ) AS member_row,
               (l.id = v_opportunity.primary_contact_lead_id) AS is_primary_contact,
               l.id AS lead_id
          FROM public.opportunity_leads AS ol
          JOIN public.leads AS l ON l.id = ol.lead_id
         WHERE ol.opportunity_id = v_opportunity.id
           AND ol.removed_at IS NULL
         ORDER BY ol.added_at, ol.lead_id
         LIMIT 12
      ) AS active_members;

    SELECT COALESCE(array_agg(DISTINCT ol.lead_id), ARRAY[]::uuid[])
      INTO v_related_lead_ids
      FROM public.opportunity_leads AS ol
     WHERE ol.opportunity_id = v_opportunity.id
       AND ol.lead_id = ANY(v_lead_ids)
       AND ol.removed_at IS NULL;

    SELECT COALESCE(array_agg(active_member.lead_id ORDER BY active_member.added_at, active_member.lead_id), ARRAY[]::uuid[])
      INTO v_member_lead_ids
      FROM (
        SELECT ol.lead_id, ol.added_at
          FROM public.opportunity_leads AS ol
         WHERE ol.opportunity_id = v_opportunity.id
           AND ol.removed_at IS NULL
         ORDER BY ol.added_at, ol.lead_id
         LIMIT 50
      ) AS active_member;

    v_opportunities := v_opportunities || jsonb_build_array(jsonb_build_object(
      'id', v_opportunity.id,
      'name', v_opportunity.name,
      'status', v_opportunity.status,
      'archived', v_opportunity.archived,
      'primary_contact_lead_id', v_opportunity.primary_contact_lead_id,
      'related_lead_ids', COALESCE(v_related_lead_ids, ARRAY[]::uuid[]),
      'member_lead_ids', COALESCE(v_member_lead_ids, ARRAY[]::uuid[]),
      'members', COALESCE(v_members, '[]'::jsonb),
      'member_count', v_member_count,
      'members_truncated', v_member_count > 12,
      'updated_at', v_opportunity.updated_at
    ));
    v_opportunity_count := v_opportunity_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'opportunities', v_opportunities,
    'total_opportunities', COALESCE(v_total_opportunities, 0),
    'opportunities_truncated', COALESCE(v_total_opportunities, 0) > v_opportunity_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_get_opportunities_for_leads(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_opportunities_for_leads(uuid, uuid[]) TO service_role;
