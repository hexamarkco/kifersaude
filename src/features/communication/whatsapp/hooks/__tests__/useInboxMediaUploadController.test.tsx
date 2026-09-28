import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { MediaUploadProgress } from '../../domain/mediaUploadState';
import { useInboxMediaUploadController } from '../useInboxMediaUploadController';

type Controller = ReturnType<typeof useInboxMediaUploadController>;

type Control = { selectChat: (chatId: string | null) => void };

const Harness = ({
  initialSelectedChatId,
  control,
  capture,
}: {
  initialSelectedChatId: string | null;
  control: Control;
  capture: (controller: Controller) => void;
}) => {
  const [selectedChatId, setSelectedChatId] = useState(initialSelectedChatId);
  control.selectChat = setSelectedChatId;
  const selectedChatIdRef = useRef(selectedChatId);
  selectedChatIdRef.current = selectedChatId;
  const controller = useInboxMediaUploadController({ selectedChatId, selectedChatIdRef });
  capture(controller);
  return null;
};

const createProgress = (chatId: string, attachmentId: string, progress: number | null): MediaUploadProgress => ({
  chatId,
  attachmentId,
  currentIndex: 1,
  total: 1,
  progress,
  fileName: `${attachmentId}.pdf`,
});

test('mantém progresso isolado por conversa e ignora atualizações ou limpezas obsoletas', () => {
  let controller!: Controller;
  const control: Control = { selectChat: () => undefined };
  const view = render(<Harness initialSelectedChatId="chat-1" control={control} capture={(value) => { controller = value; }} />);

  act(() => {
    controller.setMediaUploadProgress(createProgress('chat-1', 'attachment-1', 10));
    controller.setMediaUploadProgress(createProgress('chat-2', 'attachment-2', 20));
  });
  assert.equal(controller.mediaUploadProgress?.progress, 10);

  act(() => control.selectChat('chat-2'));
  assert.equal(controller.mediaUploadProgress?.progress, 20);

  act(() => {
    controller.updateMediaUploadProgress('chat-1', 'stale-attachment', 90);
    controller.clearMediaUploadProgress('chat-1', 'stale-attachment');
  });
  assert.equal(controller.mediaUploadProgress?.progress, 20);

  act(() => control.selectChat('chat-1'));
  assert.equal(controller.mediaUploadProgress?.progress, 10);
  act(() => controller.clearMediaUploadProgress('chat-1', 'attachment-1'));
  assert.equal(controller.mediaUploadProgress, null);
  view.unmount();
});

test('cancela o upload da conversa ativa e oferece cancelamento completo para cleanup', () => {
  let controller!: Controller;
  const control: Control = { selectChat: () => undefined };
  const view = render(<Harness initialSelectedChatId="chat-1" control={control} capture={(value) => { controller = value; }} />);
  const chatOneUpload = new AbortController();
  const chatTwoUpload = new AbortController();
  const abortChatOne = vi.spyOn(chatOneUpload, 'abort');
  const abortChatTwo = vi.spyOn(chatTwoUpload, 'abort');
  controller.mediaUploadAbortControllersRef.current.set('chat-1', chatOneUpload);
  controller.mediaUploadAbortControllersRef.current.set('chat-2', chatTwoUpload);

  act(() => controller.cancelSelectedMediaUpload());
  assert.equal(abortChatOne.mock.calls.length, 1);
  assert.equal(abortChatTwo.mock.calls.length, 0);

  act(() => control.selectChat('chat-2'));
  act(() => controller.cancelSelectedMediaUpload());
  assert.equal(abortChatTwo.mock.calls.length, 1);

  view.unmount();
  assert.equal(abortChatOne.mock.calls.length, 2);
  assert.equal(abortChatTwo.mock.calls.length, 2);
  assert.equal(controller.mediaUploadAbortControllersRef.current.size, 0);
});
