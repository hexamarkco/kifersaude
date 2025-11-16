import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import type { WhatsappChat, WhatsappMessage } from '../../types/whatsapp';
import WhatsappPage from '../WhatsappPage';

const supabaseMocks = vi.hoisted(() => {
  const supabaseChannelMock = vi.fn(() => {
    const channel: any = {};
    channel.on = vi.fn().mockImplementation(() => channel);
    channel.subscribe = vi.fn().mockReturnValue(channel);
    return channel;
  });

  const supabaseRemoveChannelMock = vi.fn();

  const createQueryBuilder = () => {
    const resolvedValue = { data: [], error: null };
    const resolvedPromise = Promise.resolve(resolvedValue);

    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.upsert = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.returns = vi.fn(() => builder);
    builder.single = vi.fn().mockResolvedValue(resolvedValue);
    builder.then = (resolve: any, reject?: any) => resolvedPromise.then(resolve, reject);
    builder.catch = (reject: any) => resolvedPromise.catch(reject);

    return builder;
  };

  const supabaseFromMock = vi.fn(() => createQueryBuilder());

  return { supabaseChannelMock, supabaseRemoveChannelMock, supabaseFromMock };
});

vi.mock('../../components/StatusDropdown', () => ({
  default: () => null,
}));

vi.mock('../../components/ChatLeadDetailsDrawer', () => ({
  default: () => null,
}));

vi.mock('../../components/AudioMessageBubble', () => ({
  AudioMessageBubble: () => null,
}));

vi.mock('../../components/LiveAudioVisualizer', () => ({
  LiveAudioVisualizer: () => null,
}));

vi.mock('../../contexts/ConfigContext', () => ({
  useConfig: () => ({
    loading: false,
    leadStatuses: [],
    leadOrigins: [],
    options: {
      lead_tipo_contratacao: [],
      lead_responsavel: [],
      contract_status: [],
      contract_modalidade: [],
      contract_abrangencia: [],
      contract_acomodacao: [],
      contract_carencia: [],
    },
    profilePermissions: [],
    refreshLeadStatuses: vi.fn(),
    refreshLeadOrigins: vi.fn(),
    refreshCategory: vi.fn(),
    refreshProfilePermissions: vi.fn(),
    getRoleModulePermission: () => ({ can_view: true, can_edit: true }),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: supabaseMocks.supabaseChannelMock,
    removeChannel: supabaseMocks.supabaseRemoveChannelMock,
    from: supabaseMocks.supabaseFromMock,
  },
}));

const { supabaseChannelMock, supabaseRemoveChannelMock, supabaseFromMock } = supabaseMocks;

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn<
  [RequestInfo | URL, RequestInit | undefined],
  Promise<{ ok: boolean; json: () => Promise<unknown>; text: () => Promise<string> }>
>();

const waitFor = async (callback: () => void, timeout = 1500, interval = 20) => {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      try {
        callback();
        resolve();
      } catch (error) {
        if (Date.now() - start > timeout) {
          reject(error);
          return;
        }
        setTimeout(check, interval);
      }
    };
    check();
  });
};

const createJsonResponse = (data: unknown) => ({
  ok: true,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const setNativeInputValue = (element: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Unable to set input value natively');
  }
  valueSetter.call(element, value);
};

const chat: WhatsappChat = {
  id: 'chat-1',
  phone: '+5511999999999',
  chat_name: 'Cliente Exemplo',
  last_message_at: '2024-01-01T12:00:00.000Z',
  last_message_preview: 'Primeira mensagem',
  is_group: false,
  sender_photo: null,
  is_archived: false,
  is_pinned: false,
  display_name: 'Cliente Exemplo',
  crm_lead: null,
  crm_contracts: [],
  crm_financial_summary: null,
  sla_metrics: null,
};

const baseMessages: WhatsappMessage[] = [
  {
    id: 'msg-1',
    chat_id: 'chat-1',
    message_id: 'message-1',
    from_me: false,
    status: 'delivered',
    text: 'Primeira mensagem',
    moment: '2024-01-01T12:00:00.000Z',
    raw_payload: null,
  },
  {
    id: 'msg-2',
    chat_id: 'chat-1',
    message_id: 'message-2',
    from_me: true,
    status: 'sent',
    text: 'Segunda resposta importante',
    moment: '2024-01-01T12:05:00.000Z',
    raw_payload: null,
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  supabaseChannelMock.mockClear();
  supabaseRemoveChannelMock.mockClear();
  supabaseFromMock.mockClear();

  (globalThis as any).fetch = fetchMock;

  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL = 'https://example.com/functions/v1';
  import.meta.env.VITE_SUPABASE_URL = 'https://example.com';

  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/whatsapp-webhook/chats')) {
      return createJsonResponse({ chats: [chat] });
    }

    if (url.includes('/messages')) {
      return createJsonResponse({ messages: baseMessages });
    }

    return createJsonResponse({ success: true });
  });
});

afterAll(() => {
  (globalThis as any).fetch = originalFetch;
});

describe('WhatsappPage message search', () => {
  it('filters messages based on the search term and highlights matches', async () => {
    const view = render(<WhatsappPage />);
    const { container } = view;

    await waitFor(() => {
      expect(container.querySelector('[data-testid="whatsapp-messages"]')).not.toBeNull();
    });

    const messageContainer = container.querySelector('[data-testid="whatsapp-messages"]') as HTMLElement;

    await waitFor(() => {
      const messages = messageContainer.querySelectorAll('[data-testid="whatsapp-message"]');
      expect(messages).toHaveLength(2);
      expect(messages[0].textContent).toContain('Primeira mensagem');
      expect(messages[1].textContent).toContain('Segunda resposta importante');
    });

    await waitFor(() => {
      if (!container.querySelector('button[aria-label="Abrir menu de ações do chat"]')) {
        throw new Error('Menu de ações indisponível');
      }
    });
    const actionsButton = container.querySelector(
      'button[aria-label="Abrir menu de ações do chat"]',
    ) as HTMLButtonElement;

    act(() => {
      actionsButton.click();
    });

    await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
      );
      const target = candidates.find(button =>
        button.textContent?.toLowerCase().includes('pesquisar no chat'),
      );
      if (!target) {
        throw new Error('Ação de pesquisa não encontrada');
      }
    });
    const openSearchButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
    ).find(button => button.textContent?.toLowerCase().includes('pesquisar no chat')) as HTMLButtonElement;

    act(() => {
      openSearchButton.click();
    });

    const searchInput = (await screen.findByPlaceholderText(
      'Pesquisar mensagens',
    )) as HTMLInputElement;

    act(() => {
      setNativeInputValue(searchInput, 'importante');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      const highlights = Array.from(messageContainer.querySelectorAll('mark'));
      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights.some(element => element.textContent?.toLowerCase() === 'importante')).toBe(
        true,
      );
    });

    view.unmount();
  });

  it('restores the full message list after clearing the search', async () => {
    const view = render(<WhatsappPage />);
    const { container } = view;

    await waitFor(() => {
      expect(container.querySelector('[data-testid="whatsapp-messages"]')).not.toBeNull();
    });

    const messageContainer = container.querySelector('[data-testid="whatsapp-messages"]') as HTMLElement;

    await waitFor(() => {
      const messages = messageContainer.querySelectorAll('[data-testid="whatsapp-message"]');
      expect(messages).toHaveLength(2);
      expect(messages[0].textContent).toContain('Primeira mensagem');
      expect(messages[1].textContent).toContain('Segunda resposta importante');
    });

    await waitFor(() => {
      if (!container.querySelector('button[aria-label="Abrir menu de ações do chat"]')) {
        throw new Error('Menu de ações indisponível');
      }
    });
    const actionsButton = container.querySelector(
      'button[aria-label="Abrir menu de ações do chat"]',
    ) as HTMLButtonElement;

    act(() => {
      actionsButton.click();
    });

    await waitFor(() => {
      const candidates = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
      );
      const target = candidates.find(button =>
        button.textContent?.toLowerCase().includes('pesquisar no chat'),
      );
      if (!target) {
        throw new Error('Ação de pesquisa não encontrada');
      }
    });
    const openSearchButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'),
    ).find(button => button.textContent?.toLowerCase().includes('pesquisar no chat')) as HTMLButtonElement;

    act(() => {
      openSearchButton.click();
    });

    const searchInput = (await screen.findByPlaceholderText(
      'Pesquisar mensagens',
    )) as HTMLInputElement;

    act(() => {
      setNativeInputValue(searchInput, 'resposta');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await waitFor(() => {
      const highlight = messageContainer.querySelector('mark');
      expect(highlight?.textContent?.toLowerCase()).toBe('resposta');
    });

    const clearButton = container.querySelector(
      'button[aria-label="Limpar busca de mensagens"]',
    ) as HTMLButtonElement | null;
    expect(clearButton).not.toBeNull();

    act(() => {
      clearButton?.click();
    });

    await waitFor(() => {
      const messages = messageContainer.querySelectorAll('[data-testid="whatsapp-message"]');
      expect(messages).toHaveLength(2);
      expect(messages[0].textContent).toContain('Primeira mensagem');
      expect(messages[1].textContent).toContain('Segunda resposta importante');
      expect(messageContainer.querySelector('mark')).toBeNull();
    });

    view.unmount();
  });
});
