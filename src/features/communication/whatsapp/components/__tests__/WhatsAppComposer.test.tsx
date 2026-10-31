import assert from 'node:assert/strict';
import { createRef, type ComponentProps, type SetStateAction } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { WhatsAppComposer } from '../WhatsAppComposer';

const ignore = () => undefined;
const ignoreStateUpdate = <T,>(_value: SetStateAction<T>) => undefined;

const createComposerProps = (): ComponentProps<typeof WhatsAppComposer> => ({
  fileInputRef: createRef<HTMLInputElement>(),
  attachmentInputAccept: '',
  handleAttachmentInputChange: ignore,
  composerFocused: true,
  isVoiceComposerMode: false,
  isComposerExpanded: false,
  voiceAttachment: null,
  voiceRecordingState: 'idle',
  voiceRecordingSeconds: 0,
  voicePreviewPlaying: false,
  voicePreviewDuration: null,
  voicePreviewCurrentTime: 0,
  voicePreviewAudioRef: createRef<HTMLAudioElement>(),
  sendDisabledReason: null,
  handleClearAttachment: ignore,
  handleToggleVoicePreviewPlayback: ignore,
  handleStartVoiceRecording: ignore,
  handleSendCurrentVoiceRecording: ignore,
  handleCancelVoiceRecording: ignore,
  handleStopVoiceRecording: ignore,
  replyTargetMessage: null,
  setReplyTargetMessage: ignoreStateUpdate<CommWhatsAppMessage | null>,
  documentComposerAttachments: [],
  selectedDocumentComposerAttachment: null,
  sending: false,
  mediaUploadProgress: null,
  handleToggleMediaDrawer: ignore,
  selectedChat: null,
  mediaDrawerOpen: false,
  setMediaDrawerOpen: ignore,
  composerTextareaRef: createRef<HTMLTextAreaElement>(),
  messageDraft: '/ola',
  handleComposerChange: ignore,
  handleComposerPaste: ignore,
  handleComposerKeyDown: ignore,
  syncComposerSelection: ignore,
  setComposerFocused: ignore,
  generatingFollowUp: false,
  handleComposerSubmit: ignore,
  hasSendPayload: false,
  setSelectedDocumentComposerAttachmentId: ignoreStateUpdate<string | null>,
  handleAttachmentMenuAction: ignore,
  visualComposerAttachments: [],
  selectedMediaComposerAttachment: null,
  setSelectedMediaComposerAttachmentId: ignoreStateUpdate<string | null>,
  attachmentMenuOpen: false,
  setAttachmentMenuOpen: ignore,
  mediaDrawerTriggerRef: createRef<HTMLButtonElement>(),
  composerAiMenuOpen: false,
  setComposerAiMenuOpen: ignore,
  composerRewriteModalOpen: false,
  composerRewriteDisabledReason: null,
  replySuggestionDisabledReason: null,
  rewritingComposer: false,
  replySuggestionLoading: false,
  replySuggestionText: '',
  replySuggestionError: null,
  handleOpenComposerRewriteModal: ignore,
  handleQuickRewriteComposerText: ignore,
  handleApplyReplySuggestion: ignore,
  handleDismissReplySuggestion: ignore,
  handleGenerateReplySuggestion: ignore,
  handleApplyComposerTextFormat: ignore,
  quickReplyMenuOpen: true,
  quickReplyMenuHasResults: true,
  filteredQuickReplyOptions: [{
    id: 'reply-hello',
    name: 'Boas-vindas',
    shortcut: 'ola',
    text: 'Olá! Como posso ajudar?',
    preview: 'Olá! Como posso ajudar?',
    searchValue: 'ola boas-vindas',
  }],
  quickReplyActiveIndex: 0,
  handleOpenQuickReplySettings: ignore,
  handleInsertQuickReply: ignore,
  quickReplyEmptyStateMessage: 'Nenhuma mensagem rápida cadastrada ainda.',
  quickRepliesLoadError: false,
  onRetryQuickRepliesLoad: ignore,
});

test('associa o campo de composição à opção ativa das mensagens rápidas', () => {
  const { container, unmount } = render(<WhatsAppComposer {...createComposerProps()} />);
  const composer = container.querySelector('[role="combobox"]');
  const listbox = container.querySelector('[role="listbox"]');
  const option = container.querySelector('[role="option"]');

  assert.ok(composer);
  assert.ok(listbox);
  assert.ok(option);
  assert.equal(composer.getAttribute('aria-expanded'), 'true');
  assert.equal(composer.getAttribute('aria-controls'), listbox.id);
  assert.equal(composer.getAttribute('aria-activedescendant'), option.id);
  assert.equal(composer.getAttribute('aria-autocomplete'), 'list');
  assert.equal(option.getAttribute('aria-selected'), 'true');
  assert.equal(option.textContent?.includes('/ola'), true);

  unmount();
});

test('remove as referências de estado quando não há sugestões abertas', () => {
  const props = createComposerProps();
  props.quickReplyMenuOpen = false;
  const { container, unmount } = render(<WhatsAppComposer {...props} />);
  const composer = container.querySelector('[role="combobox"]');

  assert.ok(composer);
  assert.equal(composer.getAttribute('aria-expanded'), 'false');
  assert.equal(composer.hasAttribute('aria-controls'), false);
  assert.equal(composer.hasAttribute('aria-activedescendant'), false);

  unmount();
});
