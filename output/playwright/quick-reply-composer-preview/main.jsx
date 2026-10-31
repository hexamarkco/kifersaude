import React, { createRef, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Text } from '../../../src/design-system';
import { WhatsAppComposer } from '../../../src/features/communication/whatsapp/components/WhatsAppComposer';
import WhatsAppQuickRepliesModal from '../../../src/features/communication/whatsapp/components/WhatsAppQuickRepliesModal';
import { useInboxComposerSubmission } from '../../../src/features/communication/whatsapp/hooks/useInboxComposerSubmission';
import { useInboxQuickReplyComposer } from '../../../src/features/communication/whatsapp/hooks/useInboxQuickReplyComposer';
import '../../../src/index.css';

const noOp = () => undefined;
const options = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    shortcut: 'ola',
    text: 'Olá! Como posso ajudar você hoje?',
    created_at: null,
    updated_at: null,
  },
  {
    id: 'follow-up',
    name: 'Retorno comercial',
    shortcut: 'retorno',
    text: 'Oi! Passando para saber se conseguiu avaliar as opções que conversamos.',
    created_at: null,
    updated_at: null,
  },
  {
    id: 'documents',
    name: 'Documentos necessários',
    shortcut: 'documentos',
    text: 'Para continuar, envie por favor o nome completo dos beneficiários.',
    created_at: null,
    updated_at: null,
  },
];

function QuickReplyComposerPreview() {
  const params = new URLSearchParams(window.location.search);
  const [messageDraft, setMessageDraft] = useState(`/${params.get('term') ?? ''}`);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedKey, setDismissedKey] = useState(null);
  const [quickReplies, setQuickReplies] = useState(options);
  const [quickReplySettingsOpen, setQuickReplySettingsOpen] = useState(false);
  const theme = params.get('theme') === 'light' ? 'theme-light' : 'theme-dark';
  const loadError = params.get('error') === '1';
  const visibleQuickReplies = params.get('empty') === '1' || loadError ? [] : quickReplies;
  const composerTextareaRef = createRef();
  const quickReplyComposer = useInboxQuickReplyComposer({
    quickReplies: visibleQuickReplies,
    quickRepliesLoadError: loadError,
    selectedChat: null,
    selectedChatForPresentation: null,
    leadPanel: null,
    connectedUserName: null,
    messageDraft,
    composerSelection: { start: messageDraft.length, end: messageDraft.length },
    composerFocused: true,
    setQuickReplyActiveIndex: setActiveIndex,
    dismissedQuickReplyKey: dismissedKey,
    setDismissedQuickReplyKey: setDismissedKey,
  });
  const autoSendVoiceRef = useRef(false);
  const insertQuickReply = (option) => {
    setMessageDraft(option.text);
    setDismissedKey(null);
    setActiveIndex(0);
  };
  const submission = useInboxComposerSubmission({
    generatingFollowUp: false,
    voiceRecordingState: 'idle',
    voiceAttachment: null,
    hasSendPayload: false,
    quickReplyMenuOpen: quickReplyComposer.quickReplyMenuOpen,
    quickReplyMenuHasResults: quickReplyComposer.quickReplyMenuHasResults,
    filteredQuickReplyOptions: quickReplyComposer.filteredQuickReplyOptions,
    quickReplyActiveIndex: activeIndex,
    activeQuickReplyKey: quickReplyComposer.activeQuickReplyKey,
    replySuggestionText: '',
    replySuggestionLoading: false,
    autoSendVoiceRef,
    setQuickReplyActiveIndex: setActiveIndex,
    setDismissedQuickReplyKey: setDismissedKey,
    handleInsertQuickReply: insertQuickReply,
    handleApplyReplySuggestion: noOp,
    handleSendMessage: noOp,
    handleStartVoiceRecording: noOp,
    handleStopVoiceRecording: noOp,
  });

  const props = {
    fileInputRef: createRef(),
    attachmentInputAccept: '*/*',
    handleAttachmentInputChange: noOp,
    composerFocused: true,
    isVoiceComposerMode: false,
    isComposerExpanded: false,
    voiceAttachment: null,
    voiceRecordingState: 'idle',
    voiceRecordingSeconds: 0,
    voicePreviewPlaying: false,
    voicePreviewDuration: null,
    voicePreviewCurrentTime: 0,
    voicePreviewAudioRef: createRef(),
    sendDisabledReason: null,
    handleClearAttachment: noOp,
    handleToggleVoicePreviewPlayback: noOp,
    handleStartVoiceRecording: noOp,
    handleSendCurrentVoiceRecording: noOp,
    handleCancelVoiceRecording: noOp,
    handleStopVoiceRecording: noOp,
    replyTargetMessage: null,
    setReplyTargetMessage: noOp,
    documentComposerAttachments: [],
    selectedDocumentComposerAttachment: null,
    sending: false,
    mediaUploadProgress: null,
    handleToggleMediaDrawer: noOp,
    selectedChat: null,
    mediaDrawerOpen: false,
    setMediaDrawerOpen: noOp,
    composerTextareaRef,
    messageDraft,
    handleComposerChange: (event) => setMessageDraft(event.currentTarget.value),
    handleComposerPaste: noOp,
    handleComposerKeyDown: submission.handleComposerKeyDown,
    syncComposerSelection: noOp,
    setComposerFocused: noOp,
    generatingFollowUp: false,
    handleComposerSubmit: submission.handleComposerSubmit,
    hasSendPayload: false,
    setSelectedDocumentComposerAttachmentId: noOp,
    handleAttachmentMenuAction: noOp,
    visualComposerAttachments: [],
    selectedMediaComposerAttachment: null,
    setSelectedMediaComposerAttachmentId: noOp,
    attachmentMenuOpen: false,
    setAttachmentMenuOpen: noOp,
    mediaDrawerTriggerRef: createRef(),
    composerAiMenuOpen: false,
    setComposerAiMenuOpen: noOp,
    composerRewriteModalOpen: false,
    composerRewriteDisabledReason: null,
    replySuggestionDisabledReason: null,
    rewritingComposer: false,
    replySuggestionLoading: false,
    replySuggestionText: '',
    replySuggestionError: null,
    handleOpenComposerRewriteModal: noOp,
    handleQuickRewriteComposerText: noOp,
    handleApplyReplySuggestion: noOp,
    handleDismissReplySuggestion: noOp,
    handleGenerateReplySuggestion: noOp,
    handleApplyComposerTextFormat: noOp,
    quickReplyMenuOpen: quickReplyComposer.quickReplyMenuOpen,
    quickReplyMenuHasResults: quickReplyComposer.quickReplyMenuHasResults,
    filteredQuickReplyOptions: quickReplyComposer.filteredQuickReplyOptions,
    quickReplyActiveIndex: activeIndex,
    handleOpenQuickReplySettings: () => setQuickReplySettingsOpen(true),
    handleInsertQuickReply: insertQuickReply,
    quickReplyEmptyStateMessage: quickReplyComposer.quickReplyEmptyStateMessage,
    quickRepliesLoadError: loadError,
    onRetryQuickRepliesLoad: noOp,
  };

  return (
    <main className={`painel-theme kifer-ds comm-terracotta ${theme} flex min-h-dvh flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]`}>
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <Text size="xs" tone="brand" weight="semibold" className="uppercase tracking-[0.14em]">Kifer Saúde · Comunicação</Text>
          <h1 className="kds-page-title mt-1">WhatsApp Inbox</h1>
        </div>
        <span className="hidden text-sm text-[var(--text-muted)] sm:inline">Conversa de demonstração</span>
      </header>
      <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:p-5">
          <div className="max-w-[80%] self-start rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2.5 text-sm">Olá! Quero saber mais sobre as opções disponíveis.</div>
          <div className="max-w-[80%] self-end rounded-[var(--radius-control)] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-2.5 text-sm">Claro. Posso ajudar com as informações do plano.</div>
        </div>
        <WhatsAppComposer {...props} />
      </section>
      <WhatsAppQuickRepliesModal
        isOpen={quickReplySettingsOpen}
        quickReplies={visibleQuickReplies}
        saving={false}
        onClose={() => setQuickReplySettingsOpen(false)}
        onSave={(nextQuickReplies) => {
          setQuickReplies(nextQuickReplies);
          setQuickReplySettingsOpen(false);
        }}
      />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<QuickReplyComposerPreview />);
