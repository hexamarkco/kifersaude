// @vitest-environment node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'vitest';

const sqlFile = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const functionSql = (file: string, name: string) => {
  const source = sqlFile(file);
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.ok(start >= 0, `Production function ${name} must exist`);
  return source.slice(start, source.indexOf('$$;', start) + 3);
};
const identityMigration = '20260912129000_harden_comm_whatsapp_identity_model.sql';
const channel = '00000000-0000-0000-0000-000000000001';
const otherChannel = '00000000-0000-0000-0000-000000000002';
const phone = '5521979005603@s.whatsapp.net';
const lid = '4372276707388@lid';

test('reproduces the split preview and prevents replays from moving messages to unverified chats', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
      CREATE TABLE public.comm_whatsapp_chats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id uuid NOT NULL, external_chat_id text NOT NULL,
        phone_number text DEFAULT '', phone_digits text DEFAULT '', display_name text, push_name text,
        merged_into_chat_id uuid REFERENCES public.comm_whatsapp_chats(id),
        last_message_text text, last_message_at timestamptz, last_message_direction text,
        unread_count integer DEFAULT 0, is_archived boolean DEFAULT false, archived_at timestamptz,
        is_muted boolean DEFAULT false, muted_at timestamptz, updated_at timestamptz DEFAULT now(),
        UNIQUE(channel_id,external_chat_id)
      );
      CREATE TABLE public.comm_whatsapp_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id uuid REFERENCES public.comm_whatsapp_chats(id),
        channel_id uuid, external_message_id text, direction text, message_type text, delivery_status text,
        text_content text, message_at timestamptz, created_by uuid, source text, sender_name text,
        sender_phone text, status_updated_at timestamptz, error_message text, metadata jsonb,
        media_id text, media_url text, media_mime_type text, media_file_name text, media_size_bytes bigint,
        media_duration_seconds integer, media_caption text, UNIQUE(channel_id,external_message_id)
      );
      CREATE TABLE public.comm_whatsapp_chat_identifiers (
        channel_id uuid, chat_id uuid, external_chat_id text, is_verified boolean DEFAULT false
      );
      -- Side effects unrelated to message ownership are isolated; persistence,
      -- normalization and canonical routing below use the production SQL.
      CREATE FUNCTION public.current_user_can_view_comm_whatsapp() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION public.comm_whatsapp_format_phone_label(text) RETURNS text LANGUAGE sql AS $$ SELECT $1 $$;
      CREATE FUNCTION public.comm_whatsapp_refresh_chat_identity(uuid) RETURNS SETOF public.comm_whatsapp_chats
        LANGUAGE sql AS $$ SELECT * FROM public.comm_whatsapp_chats WHERE id=$1 $$;
      CREATE FUNCTION public.comm_whatsapp_try_auto_link_chat(uuid,text,text) RETURNS void LANGUAGE sql AS $$ SELECT NULL::void $$;
      CREATE FUNCTION public.comm_whatsapp_register_chat_identifier(uuid,uuid,text,text,boolean,jsonb) RETURNS void
        LANGUAGE sql AS $$ INSERT INTO public.comm_whatsapp_chat_identifiers VALUES ($1,$2,$3,$5) $$;
    `);
    const productionFunctions: Array<[string, string]> = [
      ['20260910100000_add_comm_whatsapp_inbox_mvp.sql', 'normalize_comm_whatsapp_phone'],
      ['20260912123000_support_comm_whatsapp_lid_chat_ids.sql', 'normalize_comm_whatsapp_chat_id'],
      ['20260911411000_ignore_comm_whatsapp_technical_previews.sql', 'comm_whatsapp_is_hidden_preview_text'],
      ['20260911411000_ignore_comm_whatsapp_technical_previews.sql', 'comm_whatsapp_message_preview_text'],
      ['20260911385000_fix_comm_whatsapp_status_preview_unread_consistency.sql', 'comm_whatsapp_status_rank'],
      ['20260911414000_harden_comm_whatsapp_message_status_resolution.sql', 'comm_whatsapp_should_apply_status'],
      [identityMigration, 'comm_whatsapp_resolve_chat_uuid'],
      [identityMigration, 'comm_whatsapp_resolve_canonical_chat_uuid'],
    ];
    for (const [file, name] of productionFunctions) await db.exec(functionSql(file, name));
    await db.exec(functionSql('20260911430000_harden_comm_whatsapp_persist_message_state.sql', 'comm_whatsapp_persist_message')
      .replace('FUNCTION public.comm_whatsapp_persist_message(', 'FUNCTION public.comm_whatsapp_persist_message_internal('));
    await db.exec(functionSql(identityMigration, 'comm_whatsapp_persist_message'));

    const persist = async (externalChatId: string, messageId: string | null, channelId = channel) => {
      const result = await db.query<{ chat_id: string; message_id: string; inserted: boolean }>(`
        SELECT * FROM public.comm_whatsapp_persist_message(
          p_channel_id => $1::uuid, p_external_chat_id => $2, p_phone_number => NULL,
          p_display_name => 'G', p_push_name => NULL, p_last_message_text => 'Você é de qual empresa ?',
          p_last_message_direction => 'inbound', p_last_message_at => '2026-09-01T20:47:30Z', p_increment_unread => true,
          p_external_message_id => $3, p_direction => 'inbound', p_message_type => 'text', p_delivery_status => 'received',
          p_text_content => 'Você é de qual empresa ?', p_created_by => NULL, p_source => 'mobile',
          p_sender_name => NULL, p_sender_phone => '5521979005603', p_status_updated_at => NULL, p_error_message => NULL,
          p_metadata => jsonb_build_object('chat_id',$2::text))`, [channelId, externalChatId, messageId]);
      return result.rows[0];
    };

    // Characterization: the previous production implementation moves the exact
    // same provider message to a LID, leaving the phone chat preview stranded.
    const original = await persist(phone, 'existing-message');
    const moved = await persist(lid, 'existing-message');
    assert.notEqual(moved.chat_id, original.chat_id);
    assert.equal(moved.message_id, original.message_id);
    const stranded = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.comm_whatsapp_messages WHERE chat_id=$1', [original.chat_id]);
    assert.equal(stranded.rows[0].count, 0);
    await db.exec('TRUNCATE public.comm_whatsapp_messages, public.comm_whatsapp_chat_identifiers, public.comm_whatsapp_chats CASCADE');
    await db.exec(sqlFile('20261023190542_preserve_whatsapp_message_owner_on_reimport.sql'));

    const first = await persist(phone, 'existing-message');
    await db.query('UPDATE public.comm_whatsapp_chats SET is_archived=true, archived_at=now() WHERE id=$1', [first.chat_id]);
    const replay = await persist(lid, 'existing-message');
    assert.equal(replay.chat_id, first.chat_id);
    assert.equal(replay.message_id, first.message_id);
    assert.equal(replay.inserted, false);
    const owner = await db.query<{ unread_count: number; is_archived: boolean; phone_digits: string }>('SELECT unread_count,is_archived,phone_digits FROM public.comm_whatsapp_chats WHERE id=$1', [first.chat_id]);
    assert.deepEqual(owner.rows[0], { unread_count: 1, is_archived: true, phone_digits: '5521979005603' });
    const observed = await db.query<{ observed: string }>("SELECT metadata->>'reimport_observed_chat_id' AS observed FROM public.comm_whatsapp_messages WHERE id=$1", [first.message_id]);
    assert.equal(observed.rows[0].observed, lid);
    const alias = await db.query('SELECT * FROM public.comm_whatsapp_chat_identifiers WHERE external_chat_id=$1', [lid]);
    assert.equal(alias.rows.length, 0, 'one message is not proof of a contact alias');

    const privateMessage = await persist(lid, 'new-private-message');
    assert.notEqual(privateMessage.chat_id, first.chat_id, 'new unverified private messages are preserved separately');
    assert.equal(privateMessage.inserted, true);
    assert.equal((await persist(lid, 'existing-message')).chat_id, first.chat_id, 'an existing LID cannot steal the replay');
    const other = await persist(lid, 'existing-message', otherChannel);
    assert.notEqual(other.chat_id, first.chat_id, 'provider ids are scoped by channel');
    assert.equal(other.inserted, true);

    // A previously merged owner follows the real canonical UUID.
    const winner = await persist('5521988887777@s.whatsapp.net', 'winner-message');
    await db.query('UPDATE public.comm_whatsapp_chats SET merged_into_chat_id=$1 WHERE id=$2', [winner.chat_id, first.chat_id]);
    assert.equal((await persist(lid, 'existing-message')).chat_id, winner.chat_id);
  } finally {
    await db.close();
  }
}, 30_000);
