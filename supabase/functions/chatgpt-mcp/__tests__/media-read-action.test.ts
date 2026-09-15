import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppMediaReadAction,
  MCP_WHATSAPP_MEDIA_READ_TOOL,
} from '../media-read-action';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const chatId = '42c47f2e-c306-493f-8d7d-c08495017974';
const messageId = 'd6353fe2-773c-44cb-8da3-f7a5f0843f3b';
const mediaId = 'whapi-media_123-abc=';
const signedUrl = `https://project.supabase.co/storage/v1/object/sign/comm-whatsapp-media/${mediaId}?token=short-lived`;

const makeQuery = (response: { data: unknown; error: unknown }) => {
  type Query = {
    select(columns: string): Query;
    eq(column: string, value: string): Query;
    maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  };
  let query: Query;
  query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
  return query;
};

const makeSupabase = (options: {
  chat?: unknown;
  chatError?: unknown;
  message?: unknown;
  messageError?: unknown;
  signed?: unknown;
  signError?: unknown;
} = {}) => {
  const chatQuery = makeQuery({ data: options.chat ?? { id: chatId, deleted_at: null, merged_into_chat_id: null }, error: options.chatError ?? null });
  const messageQuery = makeQuery({
    data: options.message ?? {
      id: messageId,
      chat_id: chatId,
      direction: 'inbound',
      message_type: 'image',
      media_id: mediaId,
      media_mime_type: 'image/jpeg',
      media_url: 'https://permanent-provider.example/raw',
    },
    error: options.messageError ?? null,
  });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: options.signed ?? { signedUrl }, error: options.signError ?? null });
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  const from = vi.fn((table: string) => table === 'comm_whatsapp_chats' ? chatQuery : messageQuery);
  return { client: { from, storage: { from: storageFrom } } as never, from, chatQuery, messageQuery, storageFrom, createSignedUrl };
};

const execute = (supabase: never, args: Record<string, unknown> = { chat_id: chatId, message_id: messageId }) =>
  executeMcpWhatsAppMediaReadAction({
    supabase,
    toolName: MCP_WHATSAPP_MEDIA_READ_TOOL.name,
    arguments: args,
    actor: { actorId },
  });

describe('MCP WhatsApp media read action', () => {
  it('accepts only a message reference and signs the cached private object briefly', async () => {
    const { client, from, storageFrom, createSignedUrl } = makeSupabase();
    const result = await execute(client);

    expect(from).toHaveBeenNthCalledWith(1, 'comm_whatsapp_chats');
    expect(from).toHaveBeenNthCalledWith(2, 'comm_whatsapp_messages');
    expect(createSignedUrl).toHaveBeenCalledWith(mediaId, 120);
    expect(storageFrom).toHaveBeenCalledWith('comm-whatsapp-media');
    expect(result).toMatchObject({
      success: true,
      media: {
        message_id: messageId,
        message_type: 'image',
        mime_type: 'image/jpeg',
        signed_url: signedUrl,
        signed_url_expires_in: 120,
      },
    });
    expect(JSON.stringify(result)).not.toContain('permanent-provider.example');
  });

  it('rejects invalid IDs, extra fields, and invalid actors before database access', async () => {
    const cases = [
      { actor: { actorId: 'not-a-uuid' }, args: { chat_id: chatId, message_id: messageId } },
      { actor: { actorId }, args: { chat_id: 'not-a-uuid', message_id: messageId } },
      { actor: { actorId }, args: { chat_id: chatId, message_id: messageId, media_id: mediaId } },
    ];
    for (const input of cases) {
      const { client, from, createSignedUrl } = makeSupabase();
      const result = await executeMcpWhatsAppMediaReadAction({
        supabase: client,
        toolName: MCP_WHATSAPP_MEDIA_READ_TOOL.name,
        arguments: input.args,
        actor: input.actor,
      });
      expect(result?.success).toBe(false);
      expect(from).not.toHaveBeenCalled();
      expect(createSignedUrl).not.toHaveBeenCalled();
    }
  });

  it('requires an active canonical chat and a received media message belonging to that chat', async () => {
    const cases = [
      { chat: { id: chatId, deleted_at: '2026-09-15T12:00:00Z', merged_into_chat_id: null } },
      { chat: { id: chatId, deleted_at: null, merged_into_chat_id: 'c3e99ca5-9470-46c7-bf9b-50b4e971e950' } },
      { message: { id: messageId, chat_id: 'c3e99ca5-9470-46c7-bf9b-50b4e971e950', direction: 'inbound', message_type: 'image', media_id: mediaId } },
      { message: { id: messageId, chat_id: chatId, direction: 'outbound', message_type: 'image', media_id: mediaId } },
      { message: { id: messageId, chat_id: chatId, direction: 'inbound', message_type: 'text', media_id: mediaId } },
      { message: { id: messageId, chat_id: chatId, direction: 'inbound', message_type: 'image', media_id: '../other-object' } },
      { message: { id: messageId, chat_id: chatId, direction: 'inbound', message_type: 'image', media_id: '..' } },
    ];
    for (const options of cases) {
      const { client, createSignedUrl } = makeSupabase(options);
      const result = await execute(client);
      expect(result?.success).toBe(false);
      expect(createSignedUrl).not.toHaveBeenCalled();
    }
  });

  it('does not return a signed URL from another storage route or over HTTP', async () => {
    const cases = [
      { signed: { signedUrl: 'https://project.supabase.co/storage/v1/object/sign/public-bucket/path?token=x' } },
      { signed: { signedUrl: 'http://project.supabase.co/storage/v1/object/sign/comm-whatsapp-media/path?token=x' } },
      { signed: { signedUrl: `https://project.supabase.co/storage/v1/object/sign/comm-whatsapp-media/${mediaId}` } },
    ];
    for (const options of cases) {
      const { client } = makeSupabase(options);
      const result = await execute(client);
      expect(result).toMatchObject({ success: false, error_code: 'INTERNAL_ERROR' });
    }
  });

  it('returns not-found when media is not present in the private cache', async () => {
    const { client } = makeSupabase({ signError: { message: 'not found' } });
    const result = await execute(client);
    expect(result).toMatchObject({ success: false, error_code: 'MEDIA_NOT_FOUND' });
  });
});
