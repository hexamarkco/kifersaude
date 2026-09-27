import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  clearMediaUploadProgressForChat,
  setMediaUploadProgressForChat,
  updateMediaUploadProgressForChat,
  type MediaUploadProgress,
} from '../mediaUploadState';

const createProgress = (overrides: Partial<MediaUploadProgress> = {}): MediaUploadProgress => ({
  chatId: 'chat-1',
  attachmentId: 'attachment-1',
  currentIndex: 1,
  total: 1,
  progress: 0,
  fileName: 'arquivo.pdf',
  ...overrides,
});

test('keeps simultaneous upload progress isolated by chat', () => {
  const chatOneProgress = createProgress();
  const chatTwoProgress = createProgress({
    chatId: 'chat-2',
    attachmentId: 'attachment-2',
    fileName: 'imagem.png',
  });

  const state = setMediaUploadProgressForChat(
    setMediaUploadProgressForChat({}, chatOneProgress),
    chatTwoProgress,
  );
  const updated = updateMediaUploadProgressForChat(state, 'chat-2', 'attachment-2', 68);

  assert.equal(updated['chat-1']?.progress, 0);
  assert.equal(updated['chat-2']?.progress, 68);
});

test('does not let a stale upload callback change a newer attachment', () => {
  const current = setMediaUploadProgressForChat({}, createProgress({ attachmentId: 'new-attachment', progress: 12 }));

  const result = updateMediaUploadProgressForChat(current, 'chat-1', 'old-attachment', 94);

  assert.equal(result, current);
  assert.equal(result['chat-1']?.progress, 12);
});

test('clears only the requested chat and protects a newer upload from stale cleanup', () => {
  const state = setMediaUploadProgressForChat(
    setMediaUploadProgressForChat({}, createProgress()),
    createProgress({ chatId: 'chat-2', attachmentId: 'attachment-2' }),
  );

  const afterWrongCleanup = clearMediaUploadProgressForChat(state, 'chat-1', 'old-attachment');
  assert.equal(afterWrongCleanup, state);

  const afterChatCleanup = clearMediaUploadProgressForChat(afterWrongCleanup, 'chat-1', 'attachment-1');
  assert.equal(afterChatCleanup['chat-1'], undefined);
  assert.equal(afterChatCleanup['chat-2']?.attachmentId, 'attachment-2');
});
