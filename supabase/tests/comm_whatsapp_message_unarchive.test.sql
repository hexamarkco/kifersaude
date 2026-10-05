-- Execute apenas no banco de testes; fixtures e mensagens sao revertidas.
BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;
SELECT plan(1);

SELECT lives_ok($test$
DO $cases$
DECLARE
  v_channel uuid;
  v_chat uuid;
  v_result record;
  v_state record;
  v_direction text;
  v_muted boolean;
  v_increment boolean;
  v_text text;
  v_at timestamptz;
  v_rpc text;
  v_case integer := 0;
  v_external_id text;
  v_archive_at timestamptz := '2026-09-20 12:00:00+00';
  v_should_archive boolean;
BEGIN
  INSERT INTO public.comm_whatsapp_channels(slug, name, enabled)
  VALUES ('test-unarchive-' || gen_random_uuid(), 'Teste desarquivamento', false)
  RETURNING id INTO v_channel;

  FOREACH v_rpc IN ARRAY ARRAY['comm_whatsapp_persist_message', 'comm_whatsapp_persist_message_internal'] LOOP
    FOREACH v_direction IN ARRAY ARRAY['inbound', 'outbound', 'system'] LOOP
      FOREACH v_muted IN ARRAY ARRAY[false, true] LOOP
        FOREACH v_increment IN ARRAY ARRAY[false, true] LOOP
          FOREACH v_text IN ARRAY ARRAY['Mensagem de teste', '', NULL::text] LOOP
            FOREACH v_at IN ARRAY ARRAY[v_archive_at - interval '1 day', v_archive_at + interval '1 day'] LOOP
              v_case := v_case + 1;
              v_external_id := '5511999' || lpad(v_case::text, 6, '0') || '@s.whatsapp.net';
              INSERT INTO public.comm_whatsapp_chats(
                channel_id, external_chat_id, phone_number, phone_digits, display_name,
                is_archived, archived_at, is_muted, last_message_at, last_message_direction
              ) VALUES (
                v_channel, v_external_id, split_part(v_external_id, '@', 1), split_part(v_external_id, '@', 1),
                'Teste', true, v_archive_at, v_muted, v_archive_at, 'inbound'
              ) RETURNING id INTO v_chat;

              -- 28 argumentos evitam ambiguidade com o overload legado.
              EXECUTE format('SELECT * FROM public.%I($1,$2,NULL,NULL,NULL,$3,$4,$5,$6,$7,$4,$8,$9,$3,NULL,$10,NULL,NULL,$5,NULL,$11,NULL,NULL,NULL,NULL,NULL,NULL,NULL)', v_rpc)
              INTO v_result USING v_channel, v_external_id, v_text, v_direction, v_at, v_increment,
                'test-' || v_case, CASE WHEN v_text IS NULL THEN 'image' ELSE 'text' END,
                'sent', 'test', '{}'::jsonb;

              SELECT * INTO v_state FROM public.comm_whatsapp_chats WHERE id = v_chat;
              v_should_archive := v_direction = 'system' OR (v_direction = 'inbound' AND v_muted);
              IF NOT v_result.inserted OR v_result.chat_id <> v_chat
                 OR v_state.is_archived IS DISTINCT FROM v_should_archive
                 OR v_state.is_muted IS DISTINCT FROM v_muted
                 OR (NOT v_should_archive AND v_state.archived_at IS NOT NULL)
                 OR (v_should_archive AND v_state.archived_at IS DISTINCT FROM v_archive_at) THEN
                RAISE EXCEPTION 'Falha caso %: RPC %, direcao %, mutado %, unread %, texto %, timestamp %',
                  v_case, v_rpc, v_direction, v_muted, v_increment, v_text, v_at;
              END IF;

              UPDATE public.comm_whatsapp_chats SET is_archived = true, archived_at = v_archive_at WHERE id = v_chat;
              -- Mesmo ID externo: eco/status nao constitui uma nova mensagem.
              EXECUTE format('SELECT * FROM public.%I($1,$2,NULL,NULL,NULL,$3,$4,$5,$6,$7,$4,$8,$9,$3,NULL,$10,NULL,NULL,$5,NULL,$11,NULL,NULL,NULL,NULL,NULL,NULL,NULL)', v_rpc)
              INTO v_result USING v_channel, v_external_id, v_text, v_direction, v_at, v_increment,
                'test-' || v_case, CASE WHEN v_text IS NULL THEN 'image' ELSE 'text' END,
                'delivered', 'test', '{}'::jsonb;
              SELECT * INTO v_state FROM public.comm_whatsapp_chats WHERE id = v_chat;
              IF v_result.inserted OR NOT v_state.is_archived OR v_state.archived_at IS DISTINCT FROM v_archive_at THEN
                RAISE EXCEPTION 'Eco/status reabriu o chat no caso %', v_case;
              END IF;
            END LOOP;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$cases$;
$test$, 'Persistencia e wrapper desarquivam por direcao/mute e preservam arquivamento em ecos/status');

SELECT * FROM finish();
ROLLBACK;
