// @vitest-environment node
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const chat = '00000000-0000-0000-0000-000000000001';
const id = (number: number) => '00000000-0000-0000-0000-' + String(number).padStart(12, '0');
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;'
    + 'CREATE TABLE public.comm_whatsapp_messages('
    + 'id uuid PRIMARY KEY, chat_id uuid NOT NULL, direction text NOT NULL,'
    + 'message_type text NOT NULL, text_content text, media_caption text,'
    + 'transcription_text text, media_id text, media_url text,'
    + 'created_at timestamptz NOT NULL);',
  );
  await db.exec(readFileSync(resolve(
    'supabase/migrations/20261117180000_ignore_technical_whatsapp_events_autonomous.sql',
  ), 'utf8'));
}, 30_000);

afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec('TRUNCATE public.comm_whatsapp_messages;'); });

const insert = async (number: number, kind: string, body: string | null, opts: {
  direction?: string; caption?: string | null; transcription?: string | null;
  mediaUrl?: string | null; createdAt?: string;
} = {}) => {
  await db.query(
    'INSERT INTO public.comm_whatsapp_messages('
    + 'id,chat_id,direction,message_type,text_content,media_caption,transcription_text,media_url,created_at'
    + ') VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
    id(number), chat, opts.direction ?? 'inbound', kind, body,
    opts.caption ?? null, opts.transcription ?? null, opts.mediaUrl ?? null,
    opts.createdAt ?? new Date(Date.parse('2026-11-17T16:40:00Z') + number * 1_000).toISOString(),
  ]);
};
const latest = async (): Promise<string | null> => (
  (await db.query<{ id: string | null }>(
    'SELECT public.latest_ai_autonomous_inbound($1) AS id', [chat],
  )).rows[0].id
);

test('ignores the exact Edna action and all mapped technical message types', async () => {
  const technical = [
    ['action', '[Ação]'], ['action', '[Reação]'], ['action', '[Atualização de mídia]'],
    ['action', '[Voto em enquete]'], ['unknown', '[Mensagem]'],
    ['unknown', '[Payload inválido]'], ['album', '[Álbum]'],
    ['text', '[Mensagem sem texto]'], ['text', '[Mensagem]'],
    ['reaction', '[Reação]'], ['receipt', 'read'], ['ack', 'ack'],
    ['notification', 'sync'], ['status', 'delivered'], ['protocol', 'protocol'],
    ['system', '[Sistema]'], ['call', '[Chamada]'], ['pin', '[Fixada]'],
    ['story', '[Status]'],
  ] as const;
  for (let index = 0; index < technical.length; index++) {
    await insert(index + 1, technical[index][0], technical[index][1]);
    expect(await latest(), technical[index].join(' ')).toBeNull();
  }
});

test('real customer reply remains most recent despite later action and outgoing messages', async () => {
  await insert(1, 'action', '[Ação]', { createdAt: '2026-11-17T16:40:35.119Z' });
  await insert(2, 'text', 'Me conta, quantas pessoas seriam e qual a idade de cada uma?', {
    direction: 'outbound', createdAt: '2026-11-17T16:41:04.154Z',
  });
  await insert(3, 'text', 'Boa tarde gostaria de saber como funciona, só pra mim', {
    createdAt: '2026-11-17T16:41:06.600Z',
  });
  await insert(4, 'reaction', '[Reação]', { createdAt: '2026-11-17T16:41:07.000Z' });
  expect(await latest()).toBe(id(3));
});

test('genuine selected buttons, media and captions are still eligible turns', async () => {
  await insert(1, 'action', 'Sim, só para mim');
  expect(await latest()).toBe(id(1));
  await insert(2, 'image', '[Imagem]', { mediaUrl: 'https://example.com/imagem.jpg' });
  expect(await latest()).toBe(id(2));
  await insert(3, 'album', '[Álbum]', { caption: 'Esses são os documentos' });
  expect(await latest()).toBe(id(3));
  await insert(4, 'voice', '[Audio]', { transcription: 'Quero um orçamento' });
  expect(await latest()).toBe(id(4));
  await insert(5, 'unknown', 'Boa tarde, gostaria de saber mais');
  expect(await latest()).toBe(id(5));
});
