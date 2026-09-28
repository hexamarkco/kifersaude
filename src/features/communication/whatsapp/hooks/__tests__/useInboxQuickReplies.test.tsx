import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { IntegrationSetting } from '../../../../config';
import type { WhatsAppQuickReply } from '../../domain/quickReplies';
import { useInboxQuickReplies } from '../useInboxQuickReplies';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mockReturnValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  get: vi.fn() as unknown as MockFunction,
  create: vi.fn() as unknown as MockFunction,
  update: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../../../config', () => ({
  configService: {
    getIntegrationSetting: mocks.get,
    createIntegrationSetting: mocks.create,
    updateIntegrationSetting: mocks.update,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

let actions: ReturnType<typeof useInboxQuickReplies>;

const Harness = () => {
  const [dismissed, setDismissed] = useState<string | null>('0:atalho');
  actions = useInboxQuickReplies({ setDismissedQuickReplyKey: setDismissed });

  return (
    <>
      <output data-testid="snapshot">{JSON.stringify({
        quickReplies: actions.quickReplies,
        loadError: actions.loadError,
        settingsOpen: actions.settingsOpen,
        saving: actions.saving,
        dismissed,
      })}</output>
      <button data-testid="retry" onClick={actions.retryLoad}>Retry</button>
      <button data-testid="open" onClick={actions.openSettings}>Open</button>
      <button data-testid="close" onClick={actions.closeSettings}>Close</button>
    </>
  );
};

const quickReply = (overrides: Partial<WhatsAppQuickReply> = {}): WhatsAppQuickReply => ({
  id: 'reply-1',
  name: 'Saudação',
  shortcut: 'saudacao',
  text: 'Olá, tudo bem?',
  created_at: null,
  updated_at: null,
  ...overrides,
});

const integration = (id: string, quickReplies: WhatsAppQuickReply[]): IntegrationSetting => ({
  id,
  slug: 'whatsapp_quick_replies',
  name: 'Mensagens rápidas do WhatsApp',
  description: null,
  settings: { quickReplies },
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const readSnapshot = (container: HTMLElement) => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as {
    quickReplies: WhatsAppQuickReply[];
    loadError: boolean;
    settingsOpen: boolean;
    saving: boolean;
    dismissed: string | null;
  };
};

const click = (container: HTMLElement, testId: string) => {
  const button = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(button);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const resetMocks = () => {
  mocks.get.mockReset();
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.get.mockResolvedValue(null);
  mocks.create.mockResolvedValue({ data: null, error: null });
  mocks.update.mockResolvedValue({ data: null, error: null });
};

test('ignora uma carga antiga depois do retry e aplica a resposta mais recente', async () => {
  resetMocks();
  let resolveFirst!: (value: IntegrationSetting | null) => void;
  const firstLoad = new Promise<IntegrationSetting | null>((resolve) => {
    resolveFirst = resolve;
  });
  mocks.get.mockReturnValueOnce(firstLoad).mockResolvedValueOnce(integration('new', [quickReply({ text: 'Atualizada' })]));
  const view = render(<Harness />);

  click(view.container, 'retry');
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(readSnapshot(view.container).quickReplies[0]?.text, 'Atualizada');

  await act(async () => {
    resolveFirst(integration('old', [quickReply({ text: 'Obsoleta' })]));
    await firstLoad;
  });
  assert.equal(readSnapshot(view.container).quickReplies[0]?.text, 'Atualizada');
  assert.equal(mocks.get.mock.calls.length, 2);
  view.unmount();
});

test('registra erro de leitura e permite tentar novamente', async () => {
  resetMocks();
  mocks.get.mockRejectedValueOnce(new Error('indisponível')).mockResolvedValueOnce(integration('retry', [quickReply()]));
  const view = render(<Harness />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(readSnapshot(view.container).loadError, true);
  assert.deepEqual(readSnapshot(view.container).quickReplies, []);

  click(view.container, 'retry');
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.equal(readSnapshot(view.container).loadError, false);
  assert.equal(readSnapshot(view.container).quickReplies[0]?.id, 'reply-1');
  view.unmount();
});

test('cria e depois atualiza a configuração, normaliza os atalhos e limpa o item dispensado', async () => {
  resetMocks();
  mocks.create.mockResolvedValue({ data: integration('created', [quickReply({ shortcut: 'novo' })]), error: null });
  mocks.update.mockResolvedValue({ data: integration('created', [quickReply({ text: 'Texto salvo' })]), error: null });
  const view = render(<Harness />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  click(view.container, 'open');
  assert.equal(readSnapshot(view.container).settingsOpen, true);
  await act(async () => actions.saveQuickReplies([quickReply({ shortcut: ' Novo ' })]));
  assert.equal(mocks.create.mock.calls.length, 1);
  const createPayload = mocks.create.mock.calls[0]?.[0] as {
    slug: string;
    settings: { quickReplies: WhatsAppQuickReply[] };
  };
  assert.equal(createPayload.slug, 'whatsapp_quick_replies');
  assert.equal(createPayload.settings.quickReplies[0]?.shortcut, 'novo');
  assert.equal(readSnapshot(view.container).settingsOpen, false);
  assert.equal(readSnapshot(view.container).dismissed, null);
  assert.equal(mocks.toastSuccess.mock.calls.length, 1);

  await act(async () => actions.saveQuickReplies([quickReply({ text: 'Alterada' })]));
  assert.equal(mocks.update.mock.calls[0]?.[0], 'created');
  assert.equal(readSnapshot(view.container).quickReplies[0]?.text, 'Texto salvo');
  view.unmount();
});

test('fechar as configurações invalida um salvamento pendente', async () => {
  resetMocks();
  mocks.get.mockResolvedValue(integration('existing', [quickReply()]));
  let resolveSave!: (value: { data: IntegrationSetting; error: null }) => void;
  mocks.update.mockReturnValue(new Promise((resolve) => {
    resolveSave = resolve;
  }));
  const view = render(<Harness />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  click(view.container, 'open');
  let savePromise!: Promise<void>;
  await act(async () => {
    savePromise = actions.saveQuickReplies([quickReply({ text: 'Não aplicar' })]);
  });
  assert.equal(readSnapshot(view.container).saving, true);
  click(view.container, 'close');
  resolveSave({ data: integration('existing', [quickReply({ text: 'Não aplicar' })]), error: null });
  await act(async () => savePromise);

  assert.equal(readSnapshot(view.container).saving, false);
  assert.equal(readSnapshot(view.container).settingsOpen, false);
  assert.equal(readSnapshot(view.container).quickReplies[0]?.text, 'Olá, tudo bem?');
  assert.equal(mocks.toastSuccess.mock.calls.length, 0);
  view.unmount();
});

test('mantém o modal aberto e mostra erro quando o salvamento falha', async () => {
  resetMocks();
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    mocks.get.mockResolvedValue(integration('existing', [quickReply()]));
    mocks.update.mockResolvedValue({ data: null, error: new Error('Falha ao salvar') });
    const view = render(<Harness />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    click(view.container, 'open');
    await act(async () => actions.saveQuickReplies([quickReply({ text: 'Alterada' })]));

    assert.equal(readSnapshot(view.container).settingsOpen, true);
    assert.equal(readSnapshot(view.container).saving, false);
    assert.equal(readSnapshot(view.container).quickReplies[0]?.text, 'Olá, tudo bem?');
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Falha ao salvar']);
    view.unmount();
  } finally {
    console.error = originalConsoleError;
  }
});
