import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { useInboxChatMediaOpener } from '../useInboxChatMediaOpener';

const mocks = vi.hoisted(() => ({
  resolveCalls: [] as unknown[],
  releaseCalls: [] as string[],
  toastErrors: [] as string[],
  objectUrl: null as string | null,
  resolveError: null as unknown,
}));

vi.mock('../../data', () => ({
  whatsappMediaRepository: {
    resolveObjectUrl: async (params: unknown) => {
      mocks.resolveCalls.push(params);
      if (mocks.resolveError) throw mocks.resolveError;
      return mocks.objectUrl;
    },
    releaseObjectUrl: (mediaId: string) => {
      mocks.releaseCalls.push(mediaId);
    },
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: (message: string) => mocks.toastErrors.push(message) },
}));

type Controller = ReturnType<typeof useInboxChatMediaOpener>;

const Harness = ({ capture }: { capture: (controller: Controller) => void }) => {
  capture(useInboxChatMediaOpener());
  return null;
};

const createMessage = (mediaId: string | null): CommWhatsAppMessage => ({
  media_id: mediaId,
  media_url: 'https://media.example.test/file',
} as unknown as CommWhatsAppMessage);

const resetMocks = () => {
  mocks.resolveCalls.length = 0;
  mocks.releaseCalls.length = 0;
  mocks.toastErrors.length = 0;
  mocks.objectUrl = null;
  mocks.resolveError = null;
};

test('abre a URL temporária em nova aba e libera somente depois que ela carrega', async () => {
  resetMocks();
  mocks.objectUrl = 'blob:media-1';
  const openedUrls: unknown[][] = [];
  const open = vi.spyOn(window, 'open');
  open.mockImplementation((...args) => {
    openedUrls.push(args);
    return null;
  });
  vi.useFakeTimers();
  const captured: Controller[] = [];
  const view = render(<Harness capture={(controller) => captured.push(controller)} />);

  try {
    const controller = captured[0];
    if (!controller) throw new Error('Chat media opener was not captured.');

    await act(async () => { await controller.handleOpenChatFile(createMessage(' media-1 ')); });

    assert.deepEqual(mocks.resolveCalls, [{ mediaId: ' media-1 ', mediaUrl: 'https://media.example.test/file' }]);
    assert.deepEqual(openedUrls, [['blob:media-1', '_blank', 'noopener,noreferrer']]);
    assert.deepEqual(mocks.releaseCalls, []);

    await vi.advanceTimersByTimeAsync(59_999);
    assert.deepEqual(mocks.releaseCalls, []);
    await vi.advanceTimersByTimeAsync(1);
    assert.deepEqual(mocks.releaseCalls, ['media-1']);
  } finally {
    view.unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});

test('libera mídia indisponível e informa o usuário sem abrir uma aba', async () => {
  resetMocks();
  const open = vi.spyOn(window, 'open');
  const captured: Controller[] = [];
  const view = render(<Harness capture={(controller) => captured.push(controller)} />);

  try {
    const controller = captured[0];
    if (!controller) throw new Error('Chat media opener was not captured.');
    await act(async () => { await controller.handleOpenChatFile(createMessage(' media-2 ')); });

    assert.deepEqual(mocks.releaseCalls, ['media-2']);
    assert.deepEqual(mocks.toastErrors, ['Arquivo indisponível no momento.']);
    assert.equal(open.mock.calls.length, 0);
  } finally {
    view.unmount();
    vi.restoreAllMocks();
  }
});

test('libera mídia quando a resolução falha e mantém a mensagem de erro existente', async () => {
  resetMocks();
  mocks.resolveError = new Error('falha de rede');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const captured: Controller[] = [];
  const view = render(<Harness capture={(controller) => captured.push(controller)} />);

  try {
    const controller = captured[0];
    if (!controller) throw new Error('Chat media opener was not captured.');
    await act(async () => { await controller.handleOpenChatFile(createMessage('media-3')); });

    assert.deepEqual(mocks.releaseCalls, ['media-3']);
    assert.deepEqual(mocks.toastErrors, ['Não foi possível abrir este arquivo.']);
  } finally {
    view.unmount();
    vi.restoreAllMocks();
  }
});
