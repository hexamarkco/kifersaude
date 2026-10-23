// @vitest-environment node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'vitest';

const migration = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261023185356_prevent_empty_private_inbox_chats.sql'), 'utf8');

test('retires only empty provider observations and preserves messages, business references and identifiers', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.comm_whatsapp_chats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
        display_name text NOT NULL,
        external_chat_id text NOT NULL DEFAULT '83313809203402@lid',
        phone_digits text DEFAULT '', phone_number text DEFAULT '', saved_contact_name text,
        lead_id uuid, merged_into_chat_id uuid REFERENCES public.comm_whatsapp_chats(id),
        deleted_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
        last_message_at timestamptz, last_message_text text, unread_count integer DEFAULT 0,
        manual_unread boolean DEFAULT false, is_pinned boolean DEFAULT false,
        is_muted boolean DEFAULT false, is_archived boolean DEFAULT false,
        identity_conflict boolean DEFAULT false, auto_link_blocked boolean DEFAULT false,
        status text DEFAULT 'open', autonomous_attendance_status text DEFAULT 'inactive',
        UNIQUE (channel_id, id)
      );
      CREATE TABLE public.comm_whatsapp_chat_identifiers (
        chat_id uuid REFERENCES public.comm_whatsapp_chats(id), channel_id uuid,
        external_chat_id text, source text DEFAULT 'provider_observed', identifier_kind text DEFAULT 'lid',
        FOREIGN KEY (channel_id, chat_id) REFERENCES public.comm_whatsapp_chats(channel_id, id)
      );
      CREATE TABLE public.comm_whatsapp_messages (chat_id uuid REFERENCES public.comm_whatsapp_chats(id));
      CREATE TABLE public.comm_whatsapp_messages_archive (chat_id uuid);
      CREATE TABLE public.ai_call_logs (chat_id uuid);
      CREATE TABLE public.comm_follow_up_audit_log (chat_id text);
      CREATE TABLE public.mcp_comm_whatsapp_action_audit (chat_id uuid);
      CREATE TABLE public.comm_whatsapp_presences (chat_id uuid REFERENCES public.comm_whatsapp_chats(id));
      CREATE TABLE public.comm_whatsapp_enrichment_jobs (chat_id uuid REFERENCES public.comm_whatsapp_chats(id));
      CREATE TABLE public.future_business_reference (chat_id uuid REFERENCES public.comm_whatsapp_chats(id));
      CREATE TABLE public.composite_business_reference (
        channel_id uuid, chat_id uuid,
        FOREIGN KEY (channel_id, chat_id) REFERENCES public.comm_whatsapp_chats(channel_id, id)
      );
    `);
    const preservedOverrides: Record<string, string> = {
      phone: "phone_digits = '5521991994782'",
      saved: "saved_contact_name = 'Fabiola (Super)'",
      lead: 'lead_id = gen_random_uuid()',
      preview: "last_message_text = 'Mensagem'",
      timestamp: 'last_message_at = now()',
      unread: 'unread_count = 1',
      manually_unread: 'manual_unread = true',
      pinned: 'is_pinned = true',
      muted: 'is_muted = true',
      conflict: 'identity_conflict = true',
      blocked: 'auto_link_blocked = true',
      attendance: "autonomous_attendance_status = 'active'",
      pending: "status = 'pending'",
      group: "external_chat_id = '120363407956650899@g.us'",
    };
    const labels = ['empty_fabiola', 'empty_other_name', 'empty_archived', 'messages_without_preview', 'archived_messages',
      'business', 'composite_business', 'merge_target', 'merged_loser', 'unknown_provenance',
      'verified_phone_alias', 'ai_audit', 'follow_up_audit', 'external_follow_up_audit', 'mcp_audit', ...Object.keys(preservedOverrides)];
    for (const [index, label] of labels.entries()) {
      await db.query('INSERT INTO public.comm_whatsapp_chats(display_name, external_chat_id) VALUES ($1, $2)', [label, `${83313809203402 + index}@lid`]);
    }
    await db.exec(`
      INSERT INTO public.comm_whatsapp_chat_identifiers(chat_id, channel_id, external_chat_id)
        SELECT id, channel_id, external_chat_id FROM public.comm_whatsapp_chats WHERE display_name <> 'unknown_provenance';
      INSERT INTO public.comm_whatsapp_chat_identifiers(chat_id, channel_id, external_chat_id, identifier_kind)
        SELECT id, channel_id, '5521991994782@s.whatsapp.net', 'wa_id'
        FROM public.comm_whatsapp_chats WHERE display_name = 'verified_phone_alias';
      INSERT INTO public.comm_whatsapp_messages SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'messages_without_preview';
      INSERT INTO public.comm_whatsapp_messages_archive SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'archived_messages';
      INSERT INTO public.ai_call_logs SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'ai_audit';
      INSERT INTO public.comm_follow_up_audit_log SELECT id::text FROM public.comm_whatsapp_chats WHERE display_name = 'follow_up_audit';
      INSERT INTO public.comm_follow_up_audit_log SELECT external_chat_id FROM public.comm_whatsapp_chats WHERE display_name = 'external_follow_up_audit';
      INSERT INTO public.mcp_comm_whatsapp_action_audit SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'mcp_audit';
      INSERT INTO public.future_business_reference SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'business';
      INSERT INTO public.composite_business_reference SELECT channel_id, id FROM public.comm_whatsapp_chats WHERE display_name = 'composite_business';
      INSERT INTO public.comm_whatsapp_presences SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'empty_fabiola';
      INSERT INTO public.comm_whatsapp_enrichment_jobs SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'empty_fabiola';
      UPDATE public.comm_whatsapp_chats SET is_archived = true WHERE display_name = 'empty_archived';
      UPDATE public.comm_whatsapp_chats SET merged_into_chat_id = (SELECT id FROM public.comm_whatsapp_chats WHERE display_name = 'merge_target')
        WHERE display_name = 'merged_loser';
    `);
    for (const [label, override] of Object.entries(preservedOverrides)) {
      await db.query(`UPDATE public.comm_whatsapp_chats SET ${override} WHERE display_name = $1`, [label]);
    }
    await db.exec(migration);
    const removed = await db.query<{ display_name: string }>(
      'SELECT display_name FROM public.comm_whatsapp_chats WHERE deleted_at IS NOT NULL ORDER BY display_name');
    assert.deepEqual(removed.rows.map((row) => row.display_name), ['empty_archived', 'empty_fabiola', 'empty_other_name']);
    const identifiers = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.comm_whatsapp_chat_identifiers');
    assert.equal(identifiers.rows[0].count, labels.length);
    // Applying the same cleanup again changes nothing and preserves UUIDs.
    await db.exec(migration);
    const chats = await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM public.comm_whatsapp_chats');
    assert.equal(chats.rows[0].count, labels.length);
  } finally {
    await db.close();
  }
}, 30_000);
