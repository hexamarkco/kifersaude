import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import WhatsAppHistoryTab from './WhatsAppHistoryTab';
import { vi } from 'vitest';

vi.mock('./StatusDropdown', () => ({
  default: () => null,
}));

vi.mock('./LeadDetails', () => ({
  default: () => null,
}));

vi.mock('./LeadForm', () => ({
  default: () => null,
}));

vi.mock('./LeadDetailsPanel', () => ({
  default: () => null,
}));

vi.mock('./ReminderSchedulerModal', () => ({
  default: () => null,
}));

vi.mock('../contexts/ConfigContext', () => ({
  useConfig: () => ({
    leadStatuses: [],
    options: { lead_responsavel: [] },
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isObserver: false,
  }),
}));

const createQueryResult = () => Promise.resolve({ data: [], error: null });

const createQueryBuilder = () => {
  const builder: any = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    maybeSingle: vi.fn(() => createQueryResult()),
    single: vi.fn(() => createQueryResult()),
    select: vi.fn(() => builder),
    update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => Promise.resolve({ error: null })),
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    then: (resolve: any, reject: any) => createQueryResult().then(resolve, reject),
  };

  return builder;
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => createQueryBuilder()),
    channel: vi.fn(() => {
      const channelInstance: any = {
        on: vi.fn(() => channelInstance),
        subscribe: vi.fn(() => Promise.resolve(channelInstance)),
        unsubscribe: vi.fn(() => Promise.resolve()),
      };
      return channelInstance;
    }),
  },
}));

vi.mock('../lib/gptService', () => ({
  gptService: {
    generateChatReplySuggestions: vi.fn(() => Promise.resolve({ suggestions: [] })),
    rewriteMessage: vi.fn(() => Promise.resolve({ message: '' })),
  },
}));

vi.mock('../lib/whatsappQuickRepliesService', () => ({
  listWhatsAppQuickReplies: vi.fn(() => Promise.resolve([])),
  createWhatsAppQuickReply: vi.fn(() => Promise.resolve(null)),
  updateWhatsAppQuickReply: vi.fn(() => Promise.resolve(null)),
  deleteWhatsAppQuickReply: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../lib/zapiService', () => ({
  zapiService: {
    fetchContacts: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    subscribeToTypingPresence: vi.fn(() => vi.fn()),
    getChatPresence: vi.fn(() => Promise.resolve({ success: true, data: null })),
    getChatMetadata: vi.fn(() => Promise.resolve({ success: true, data: null })),
    getGroupMetadata: vi.fn(() => Promise.resolve({ success: true, data: null })),
    sendTextMessage: vi.fn(() => Promise.resolve({ success: true })),
    sendLocationMessage: vi.fn(() => Promise.resolve({ success: true })),
    sendMediaMessage: vi.fn(() => Promise.resolve({ success: true })),
    fetchAndSaveHistory: vi.fn(() => Promise.resolve({ success: true })),
    sendReaction: vi.fn(() => Promise.resolve({ success: true })),
    forwardMessage: vi.fn(() => Promise.resolve({ success: true })),
    setChatArchiveStatus: vi.fn(() => Promise.resolve({ success: true })),
    modifyChatStatus: vi.fn(() => Promise.resolve({ success: true })),
    markMessageAsRead: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('WhatsAppHistoryTab attachments via drag and paste', () => {
  const renderComponent = () =>
    render(
      <WhatsAppHistoryTab
        externalChatRequest={{ phone: '+5511987654321' } as any}
        onConsumeExternalChatRequest={vi.fn()}
      />,
    );

  it('adds dropped images to the attachments list', async () => {
    renderComponent();

    const composer = await screen.findByPlaceholderText('Escreva uma mensagem...');
    const file = new File(['image-content'], 'photo.png', { type: 'image/png' });
    const dataTransfer = {
      files: [file],
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file,
        },
      ],
    };

    fireEvent.dragOver(composer, { dataTransfer });
    fireEvent.drop(composer, { dataTransfer });

    const attachment = await screen.findByText('photo.png');
    expect(attachment).toBeTruthy();
  });

  it('adds pasted documents to the attachments list', async () => {
    renderComponent();

    const composer = await screen.findByPlaceholderText('Escreva uma mensagem...');
    const file = new File(['pdf-content'], 'contract.pdf', { type: 'application/pdf' });
    const clipboardData = {
      files: [file],
      items: [
        {
          kind: 'file',
          type: file.type,
          getAsFile: () => file,
        },
      ],
    };

    fireEvent.paste(composer, { clipboardData });

    const attachment = await screen.findByText('contract.pdf');
    expect(attachment).toBeTruthy();
  });

  it('does not block pasting plain text into the composer', async () => {
    renderComponent();

    const composer = await screen.findByPlaceholderText('Escreva uma mensagem...');

    const pasteEvent = createEvent.paste(composer, {
      clipboardData: {
        types: ['text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'Mensagem colada' : ''),
        files: [],
        items: [],
      },
    });

    fireEvent(composer, pasteEvent);

    expect(pasteEvent.defaultPrevented).toBe(false);
  });
});
