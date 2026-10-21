import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppContactReadAction,
  executeMcpWhatsAppContactWriteAction,
} from '../whatsapp-contact-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const actor = { actor: 'chatgpt:admin@kifer.test', actorId };

describe('MCP WhatsApp contact operations', () => {
  it('lists only the supported contact projection and audits search metadata', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const contactQuery = {
      insert: auditInsert,
    };
    const invoke = vi.fn().mockResolvedValue({
      data: {
        contacts: [{ id: 'cache-1', phone_number: '+5511999991111', display_name: 'Ana', saved: true, provider_token: 'secret' }],
        total: 1,
        hasMore: false,
      },
      error: null,
    });
    const supabase = {
      functions: { invoke },
      from: vi.fn(() => contactQuery),
    } as never;

    const result = await executeMcpWhatsAppContactReadAction({
      supabase,
      toolName: 'kifer_list_whatsapp_saved_contacts',
      arguments: { query: 'Ana', page: 1, page_size: 20 },
      actor,
    });

    expect(result).toMatchObject({ success: true, contacts: [{ id: 'cache-1', phone_number: '+5511999991111', display_name: 'Ana', saved: true }] });
    expect(JSON.stringify(result)).not.toContain('provider_token');
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-contacts', {
      body: { action: 'listContacts', query: 'Ana', page: 1, pageSize: 20 },
      headers: { 'X-Kifer-MCP-Actor-Id': actorId },
    });
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_summary: { query_length: 3, page: 1, page_size: 20 } });
  });

  it('requires confirmation and audits only a phone suffix and display-name length', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const supabase = { from: vi.fn(() => ({ insert: auditInsert })), functions: { invoke } } as never;
    const name = 'Cliente Maria Silva';
    const result = await executeMcpWhatsAppContactWriteAction({
      supabase,
      toolName: 'kifer_save_whatsapp_contact',
      arguments: { phone_number: '+55 11 99999-1234', display_name: name },
      actor,
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFIRMATION_REQUIRED' });
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(auditInsert.mock.calls[0]?.[0])).not.toContain(name);
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_payload: { phone_suffix: '1234', display_name_length: name.length } });
  });

  it('sends an explicitly confirmed contact update through the guarded function', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { contact: { phone_number: '+5511999991234', display_name: 'Maria', saved: true } }, error: null });
    const supabase = { from: vi.fn(() => ({ insert: auditInsert })), functions: { invoke } } as never;
    const result = await executeMcpWhatsAppContactWriteAction({
      supabase,
      toolName: 'kifer_save_whatsapp_contact',
      arguments: { phone_number: '+55 11 99999-1234', display_name: 'Maria', confirm_save: true },
      actor,
    });

    expect(result).toMatchObject({ success: true, contact: { display_name: 'Maria', saved: true } });
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-contacts', {
      body: { action: 'saveContact', phoneNumber: '+55 11 99999-1234', displayName: 'Maria' },
      headers: { 'X-Kifer-MCP-Actor-Id': actorId },
    });
  });
});
