import type {
  ChangeEventHandler,
  ClipboardEventHandler,
  Dispatch,
  KeyboardEventHandler,
  RefObject,
  SetStateAction,
} from 'react';
import { FileAudio, FileText, Images, Loader2, MessageCircle, Mic, Pencil, Plus, Reply, SendHorizontal, SlidersHorizontal, Smile, Sparkles, X } from 'lucide-react';

import { Button, ButtonGroup, IconButton, Popover, PopoverContent, PopoverTrigger } from '../../../../design-system';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import type { MediaUploadProgress } from '../domain/mediaUploadState';
import { getMessageSearchPreviewText } from '../domain/messagePresentation';
import { formatFileSize } from '../domain/messageMediaPresentation';
import type { InboxPendingAttachment } from '../domain/inboxPresentation';
import { WhatsAppVoiceComposer } from './WhatsAppVoiceComposer';

type ComposerAttachmentAction = 'document' | 'media' | 'audio' | 'contact';
type ComposerQuickReplyOption = {
  id: string;
  name: string;
  shortcut: string;
  text: string;
  preview: string;
  searchValue: string;
};

export function WhatsAppComposer({
  fileInputRef,
  attachmentInputAccept,
  handleAttachmentInputChange,
  composerFocused,
  isVoiceComposerMode,
  isComposerExpanded,
  voiceAttachment,
  voiceRecordingState,
  voiceRecordingSeconds,
  voicePreviewPlaying,
  voicePreviewDuration,
  voicePreviewCurrentTime,
  voicePreviewAudioRef,
  sendDisabledReason,
  handleClearAttachment,
  handleToggleVoicePreviewPlayback,
  handleStartVoiceRecording,
  handleSendCurrentVoiceRecording,
  handleCancelVoiceRecording,
  handleStopVoiceRecording,
  replyTargetMessage,
  setReplyTargetMessage,
  documentComposerAttachments,
  selectedDocumentComposerAttachment,
  sending,
  mediaUploadProgress,
  handleToggleMediaDrawer,
  selectedChat,
  mediaDrawerOpen,
  setMediaDrawerOpen,
  composerTextareaRef,
  messageDraft,
  handleComposerChange,
  handleComposerPaste,
  handleComposerKeyDown,
  syncComposerSelection,
  setComposerFocused,
  generatingFollowUp,
  handleComposerSubmit,
  hasSendPayload,
  setSelectedDocumentComposerAttachmentId,
  handleAttachmentMenuAction,
  visualComposerAttachments,
  selectedMediaComposerAttachment,
  setSelectedMediaComposerAttachmentId,
  attachmentMenuOpen,
  setAttachmentMenuOpen,
  mediaDrawerTriggerRef,
  composerAiMenuOpen,
  setComposerAiMenuOpen,
  composerRewriteModalOpen,
  composerRewriteDisabledReason,
  replySuggestionDisabledReason,
  rewritingComposer,
  replySuggestionLoading,
  replySuggestionText,
  replySuggestionError,
  handleOpenComposerRewriteModal,
  handleQuickRewriteComposerText,
  handleApplyReplySuggestion,
  handleDismissReplySuggestion,
  handleGenerateReplySuggestion,
  handleApplyComposerTextFormat,
  quickReplyMenuOpen,
  quickReplyMenuHasResults,
  filteredQuickReplyOptions,
  quickReplyActiveIndex,
  handleOpenQuickReplySettings,
  handleInsertQuickReply,
  quickReplyEmptyStateMessage,
  quickRepliesLoadError,
  setQuickRepliesLoadRetryToken,
}: {
  fileInputRef: RefObject<HTMLInputElement>;
  attachmentInputAccept: string;
  handleAttachmentInputChange: ChangeEventHandler<HTMLInputElement>;
  composerFocused: boolean;
  isVoiceComposerMode: boolean;
  isComposerExpanded: boolean;
  voiceAttachment: InboxPendingAttachment | null;
  voiceRecordingState: 'idle' | 'requesting' | 'recording';
  voiceRecordingSeconds: number;
  voicePreviewPlaying: boolean;
  voicePreviewDuration: number | null;
  voicePreviewCurrentTime: number;
  voicePreviewAudioRef: RefObject<HTMLAudioElement>;
  sendDisabledReason: string | null;
  handleClearAttachment: (attachmentId?: string) => void;
  handleToggleVoicePreviewPlayback: () => void;
  handleStartVoiceRecording: () => void | Promise<void>;
  handleSendCurrentVoiceRecording: () => void;
  handleCancelVoiceRecording: () => void;
  handleStopVoiceRecording: () => void;
  replyTargetMessage: CommWhatsAppMessage | null;
  setReplyTargetMessage: Dispatch<SetStateAction<CommWhatsAppMessage | null>>;
  documentComposerAttachments: InboxPendingAttachment[];
  selectedDocumentComposerAttachment: InboxPendingAttachment | null;
  sending: boolean;
  mediaUploadProgress: MediaUploadProgress | null;
  handleToggleMediaDrawer: () => void;
  selectedChat: CommWhatsAppChat | null;
  mediaDrawerOpen: boolean;
  setMediaDrawerOpen: (open: boolean) => void;
  composerTextareaRef: RefObject<HTMLTextAreaElement>;
  messageDraft: string;
  handleComposerChange: ChangeEventHandler<HTMLTextAreaElement>;
  handleComposerPaste: ClipboardEventHandler<HTMLTextAreaElement>;
  handleComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  syncComposerSelection: (element: HTMLTextAreaElement) => void;
  setComposerFocused: (focused: boolean) => void;
  generatingFollowUp: boolean;
  handleComposerSubmit: () => void | Promise<void>;
  hasSendPayload: boolean;
  setSelectedDocumentComposerAttachmentId: Dispatch<SetStateAction<string | null>>;
  handleAttachmentMenuAction: (action: ComposerAttachmentAction) => void;
  visualComposerAttachments: InboxPendingAttachment[];
  selectedMediaComposerAttachment: InboxPendingAttachment | null;
  setSelectedMediaComposerAttachmentId: Dispatch<SetStateAction<string | null>>;
  attachmentMenuOpen: boolean;
  setAttachmentMenuOpen: (open: boolean) => void;
  mediaDrawerTriggerRef: RefObject<HTMLButtonElement>;
  composerAiMenuOpen: boolean;
  setComposerAiMenuOpen: (open: boolean) => void;
  composerRewriteModalOpen: boolean;
  composerRewriteDisabledReason: string | null;
  replySuggestionDisabledReason: string | null;
  rewritingComposer: boolean;
  replySuggestionLoading: boolean;
  replySuggestionText: string;
  replySuggestionError: string | null;
  handleOpenComposerRewriteModal: () => void;
  handleQuickRewriteComposerText: (mode: 'grammar' | 'adapt_context') => void | Promise<void>;
  handleApplyReplySuggestion: () => void;
  handleDismissReplySuggestion: () => void;
  handleGenerateReplySuggestion: (manual?: boolean) => void | Promise<void>;
  handleApplyComposerTextFormat: (format: 'bold' | 'italic' | 'strike') => void;
  quickReplyMenuOpen: boolean;
  quickReplyMenuHasResults: boolean;
  filteredQuickReplyOptions: ComposerQuickReplyOption[];
  quickReplyActiveIndex: number;
  handleOpenQuickReplySettings: () => void;
  handleInsertQuickReply: (option: ComposerQuickReplyOption) => void;
  quickReplyEmptyStateMessage: string;
  quickRepliesLoadError: boolean;
  setQuickRepliesLoadRetryToken: Dispatch<SetStateAction<number>>;
}) {
  return (
              <div className="whatsapp-inbox-composer-area relative z-10 min-h-0 overflow-visible border-t p-2.5 sm:p-3">
                <div className={`whatsapp-inbox-composer rounded-xl border transition-shadow ${composerFocused ? 'is-focused' : ''} ${isVoiceComposerMode ? 'is-voice-mode px-0 py-0' : `px-3 ${isComposerExpanded ? 'py-2.5' : 'py-1.5'}`}`}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={attachmentInputAccept}
                    className="hidden"
                    onChange={handleAttachmentInputChange}
                  />

                  <WhatsAppVoiceComposer
                    voiceAttachment={voiceAttachment}
                    voiceRecordingState={voiceRecordingState}
                    voiceRecordingSeconds={voiceRecordingSeconds}
                    voicePreviewPlaying={voicePreviewPlaying}
                    voicePreviewDuration={voicePreviewDuration}
                    voicePreviewCurrentTime={voicePreviewCurrentTime}
                    voicePreviewAudioRef={voicePreviewAudioRef}
                    sendDisabledReason={sendDisabledReason}
                    handleClearAttachment={handleClearAttachment}
                    handleToggleVoicePreviewPlayback={handleToggleVoicePreviewPlayback}
                    handleStartVoiceRecording={handleStartVoiceRecording}
                    handleSendCurrentVoiceRecording={handleSendCurrentVoiceRecording}
                    handleCancelVoiceRecording={handleCancelVoiceRecording}
                    handleStopVoiceRecording={handleStopVoiceRecording}
                  />
                  {replyTargetMessage ? (
                    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5">
                      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Respondendo</p>
                        <p className="truncate text-sm text-[var(--text-secondary)]">{getMessageSearchPreviewText(replyTargetMessage)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTargetMessage(null)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)]"
                        aria-label="Cancelar resposta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {documentComposerAttachments.length > 0 && selectedDocumentComposerAttachment ? (() => {
                    const selectedExtension = selectedDocumentComposerAttachment.file.name.split('.').pop()?.toUpperCase() || 'DOC';
                    const selectedIsPdf = selectedDocumentComposerAttachment.file.type === 'application/pdf' || selectedExtension === 'PDF';
                    const selectedUploading = sending && mediaUploadProgress?.attachmentId === selectedDocumentComposerAttachment.id;

                    return (
                      <div className="whatsapp-inbox-document-composer mb-3 overflow-hidden rounded-2xl border">
                        <div className="whatsapp-inbox-document-composer-header flex items-center justify-between gap-3 border-b px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{selectedDocumentComposerAttachment.file.name}</p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatFileSize(selectedDocumentComposerAttachment.file.size) || 'Documento'} · {selectedExtension}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClearAttachment()}
                            className="whatsapp-inbox-media-composer-close inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
                            aria-label="Remover documentos"
                            title="Remover documentos"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="whatsapp-inbox-document-composer-stage relative flex min-h-[min(48vh,30rem)] items-center justify-center p-3 sm:p-4">
                          {selectedIsPdf && selectedDocumentComposerAttachment.previewUrl ? (
                            <iframe
                              src={`${selectedDocumentComposerAttachment.previewUrl}#toolbar=1&navpanes=0`}
                              title={selectedDocumentComposerAttachment.file.name}
                              className="whatsapp-inbox-document-composer-pdf h-[min(46vh,28rem)] w-full rounded-xl border"
                            />
                          ) : (
                            <div className="whatsapp-inbox-document-composer-fallback flex max-w-md flex-col items-center gap-3 rounded-2xl border px-6 py-8 text-center">
                              <div className="whatsapp-inbox-document-composer-extension flex h-16 min-w-16 items-center justify-center rounded-2xl border px-3 text-sm font-bold tracking-[0.08em]">
                                {selectedExtension.slice(0, 4)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">Preview indisponível para este formato</p>
                                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                  O arquivo será enviado normalmente. PDFs podem ser visualizados antes do envio.
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedUploading ? (
                            <div className="absolute bottom-3 left-4 right-4 rounded-full bg-[color-mix(in_srgb,var(--bg-canvas)_60%,transparent)] p-1 backdrop-blur">
                              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                                <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress?.progress ?? 0}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="whatsapp-inbox-document-composer-caption flex items-center gap-2 border-t px-3 py-2.5">
                          <button
                            type="button"
                            onClick={handleToggleMediaDrawer}
                            disabled={!selectedChat}
                            className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${mediaDrawerOpen ? 'is-open' : ''}`}
                            aria-label="Emoji, GIF e figurinha"
                            aria-expanded={mediaDrawerOpen}
                            title="Emoji, GIF e figurinha"
                          >
                            <Smile className="h-5 w-5" />
                          </button>
                          <textarea
                            ref={composerTextareaRef}
                            rows={1}
                            value={messageDraft}
                            onChange={handleComposerChange}
                            onPaste={handleComposerPaste}
                            onKeyDown={handleComposerKeyDown}
                            onClick={(event) => syncComposerSelection(event.currentTarget)}
                            onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                            onSelect={(event) => syncComposerSelection(event.currentTarget)}
                            onFocus={(event) => {
                              setComposerFocused(true);
                              syncComposerSelection(event.currentTarget);
                            }}
                            onBlur={() => setComposerFocused(false)}
                            placeholder="Digite uma mensagem"
                            disabled={generatingFollowUp || sending}
                            className="whatsapp-inbox-composer-input min-h-10 flex-1 resize-none border-none bg-transparent px-0 py-2 text-sm leading-6 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleComposerSubmit}
                            disabled={generatingFollowUp || Boolean(sendDisabledReason) || sending}
                            className="whatsapp-inbox-composer-action is-active inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Enviar documento"
                            title={sendDisabledReason ?? undefined}
                          >
                            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                          </button>
                        </div>

                        <div className="whatsapp-inbox-document-composer-strip flex items-center justify-center gap-2 border-t px-3 py-3">
                          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                            {documentComposerAttachments.map((attachment) => {
                              const extension = attachment.file.name.split('.').pop()?.toUpperCase() || 'DOC';
                              const selected = attachment.id === selectedDocumentComposerAttachment.id;
                              return (
                                <div key={attachment.id} className={`whatsapp-inbox-document-composer-item relative flex h-14 min-w-[12rem] max-w-[16rem] shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-2.5 transition ${selected ? 'is-selected' : ''}`}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDocumentComposerAttachmentId(attachment.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    aria-label="Selecionar documento"
                                  >
                                    <span className="whatsapp-inbox-document-composer-mini-extension flex h-9 min-w-9 items-center justify-center rounded-full border px-1 text-[10px] font-bold tracking-[0.08em]">
                                      {extension.slice(0, 4)}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-xs font-semibold">{attachment.file.name}</span>
                                      <span className="block truncate text-[11px] opacity-70">{formatFileSize(attachment.file.size) || extension}</span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAttachment(attachment.id)}
                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-canvas)] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                                    aria-label="Remover documento"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => handleAttachmentMenuAction('document')}
                              disabled={voiceRecordingState !== 'idle' || generatingFollowUp || sending}
                              className="whatsapp-inbox-media-composer-add inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Adicionar documento"
                              title="Adicionar documento"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  {visualComposerAttachments.length > 0 && selectedMediaComposerAttachment ? (
                    <div className="whatsapp-inbox-media-composer mb-3 overflow-hidden rounded-2xl border">
                      <div className="whatsapp-inbox-media-composer-stage relative flex min-h-[min(48vh,30rem)] items-center justify-center px-4 py-5 sm:px-8">
                        <button
                          type="button"
                          onClick={() => handleClearAttachment()}
                          className="whatsapp-inbox-media-composer-close absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full transition"
                          aria-label="Fechar preview de mídia"
                          title="Remover mídias"
                        >
                          <X className="h-5 w-5" />
                        </button>

                        {selectedMediaComposerAttachment.kind === 'image' && selectedMediaComposerAttachment.previewUrl ? (
                          <img
                            src={selectedMediaComposerAttachment.previewUrl}
                            alt={selectedMediaComposerAttachment.file.name}
                            className="whatsapp-inbox-media-composer-preview max-h-[min(44vh,28rem)] max-w-full object-contain"
                          />
                        ) : selectedMediaComposerAttachment.kind === 'video' && selectedMediaComposerAttachment.previewUrl ? (
                          <video
                            controls
                            preload="metadata"
                            className="whatsapp-inbox-media-composer-preview max-h-[min(44vh,28rem)] max-w-full object-contain"
                          >
                            <source src={selectedMediaComposerAttachment.previewUrl} type={selectedMediaComposerAttachment.file.type || undefined} />
                          </video>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                            <Images className="h-10 w-10" />
                            <span className="text-sm font-semibold">Preview indisponível</span>
                          </div>
                        )}

                        {sending && mediaUploadProgress ? (
                          <div className="absolute bottom-3 left-4 right-4 rounded-full bg-[color-mix(in_srgb,var(--bg-canvas)_60%,transparent)] p-1 backdrop-blur">
                            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                              <div className="whatsapp-inbox-upload-progress h-full rounded-full" style={{ width: `${mediaUploadProgress.progress ?? 0}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="whatsapp-inbox-media-composer-caption flex items-center gap-2 border-t px-3 py-2.5">
                        <button
                          type="button"
                          onClick={handleToggleMediaDrawer}
                          disabled={!selectedChat}
                          className={`whatsapp-inbox-composer-icon inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${mediaDrawerOpen ? 'is-open' : ''}`}
                          aria-label="Emoji, GIF e figurinha"
                          aria-expanded={mediaDrawerOpen}
                          title="Emoji, GIF e figurinha"
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <textarea
                          ref={composerTextareaRef}
                          rows={1}
                          value={messageDraft}
                          onChange={handleComposerChange}
                          onPaste={handleComposerPaste}
                          onKeyDown={handleComposerKeyDown}
                          onClick={(event) => syncComposerSelection(event.currentTarget)}
                          onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                          onSelect={(event) => syncComposerSelection(event.currentTarget)}
                          onFocus={(event) => {
                            setComposerFocused(true);
                            syncComposerSelection(event.currentTarget);
                          }}
                          onBlur={() => setComposerFocused(false)}
                          placeholder="Digite uma mensagem"
                          disabled={generatingFollowUp || sending}
                          className="whatsapp-inbox-composer-input min-h-10 flex-1 resize-none border-none bg-transparent px-0 py-2 text-sm leading-6 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleComposerSubmit}
                          disabled={generatingFollowUp || Boolean(sendDisabledReason) || sending}
                          className="whatsapp-inbox-composer-action is-active inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Enviar mídia"
                          title={sendDisabledReason ?? undefined}
                        >
                          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
                        </button>
                      </div>

                      <div className="whatsapp-inbox-media-composer-strip flex items-center justify-center gap-2 border-t px-3 py-3">
                        <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                          {visualComposerAttachments.map((attachment) => {
                            const selected = attachment.id === selectedMediaComposerAttachment.id;
                            return (
                              <div
                                key={attachment.id}
                                className={`whatsapp-inbox-media-composer-thumb relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition ${selected ? 'is-selected' : ''}`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedMediaComposerAttachmentId(attachment.id)}
                                  className="flex h-full w-full items-center justify-center overflow-hidden"
                                  aria-label={`Selecionar ${attachment.kind === 'image' ? 'imagem' : 'vídeo'}`}
                                >
                                  {attachment.kind === 'image' && attachment.previewUrl ? (
                                    <img src={attachment.previewUrl} alt="" className="h-full w-full object-cover" />
                                  ) : attachment.kind === 'video' && attachment.previewUrl ? (
                                    <video preload="metadata" className="h-full w-full object-cover">
                                      <source src={attachment.previewUrl} type={attachment.file.type || undefined} />
                                    </video>
                                  ) : (
                                    <Images className="h-5 w-5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearAttachment(attachment.id)}
                                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-canvas)] text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
                                  aria-label="Remover mídia"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            disabled={voiceRecordingState !== 'idle' || generatingFollowUp || sending}
                            className="whatsapp-inbox-media-composer-add inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Adicionar mídia"
                            title="Adicionar foto ou vídeo"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {voiceRecordingState === 'recording' || voiceAttachment || visualComposerAttachments.length > 0 || documentComposerAttachments.length > 0 ? null : (
                  <>
                  {(replySuggestionLoading || replySuggestionText || replySuggestionError) && !quickReplyMenuOpen ? (
                    <div className="mb-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                          {replySuggestionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              Sugestão da IA
                            </p>
                            {replySuggestionText ? (
                              <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">Tab para aplicar</span>
                            ) : null}
                          </div>
                          {replySuggestionText ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{replySuggestionText}</p>
                          ) : replySuggestionError ? (
                            <p className="mt-1 text-sm leading-6 text-[var(--danger-text)]">{replySuggestionError}</p>
                          ) : (
                            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Analisando histórico e padrão de atendimento...</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {replySuggestionText ? (
                              <Button type="button" size="sm"  onClick={handleApplyReplySuggestion}>
                                Aplicar
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleGenerateReplySuggestion(true)}
                              disabled={replySuggestionLoading}
                            >
                              {replySuggestionText ? 'Gerar outra' : 'Gerar sugestão'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleDismissReplySuggestion}
                              disabled={replySuggestionLoading && !replySuggestionText}
                            >
                              Ignorar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className={`flex gap-1.5 sm:gap-2 ${isComposerExpanded ? 'items-end' : 'items-center'}`}>
                    <ButtonGroup
                      className={cx('whatsapp-inbox-composer-button-group relative shrink-0', isComposerExpanded ? 'self-end' : 'self-center')}
                      role="group"
                      aria-label="Ações de composição da mensagem"
                    >
                      <Popover open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
                        <PopoverTrigger
                          onClick={() => {
                            setComposerAiMenuOpen(false);
                            setMediaDrawerOpen(false);
                          }}
                        >
                          <IconButton
                            variant="ghost"
                            size="md"
                            disabled={voiceRecordingState !== 'idle' || generatingFollowUp}
                            className={cx('whatsapp-inbox-composer-icon', attachmentMenuOpen && 'is-open')}
                            aria-label="Anexar"
                            aria-expanded={attachmentMenuOpen}
                          >
                            <Plus className={cx('kds-control-icon transition', attachmentMenuOpen && 'rotate-45')} />
                          </IconButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="start"
                          className="whatsapp-inbox-attach-menu min-w-[208px] overflow-hidden rounded-[var(--radius-2xl)] border p-1.5 shadow-xl"
                          aria-label="Anexar arquivo"
                        >
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('document')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--text-secondary)]">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span>Documento</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('media')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              <Images className="h-4 w-4" />
                            </span>
                            <span>Fotos e vídeos</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAttachmentMenuAction('audio')}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              <FileAudio className="h-4 w-4" />
                            </span>
                            <span>Áudio</span>
                          </button>
                        </PopoverContent>
                      </Popover>
                        <IconButton
                          variant="ghost"
                          size="md"
                          ref={mediaDrawerTriggerRef}
                          onClick={handleToggleMediaDrawer}
                          disabled={!selectedChat}
                          className={cx('whatsapp-inbox-composer-icon', mediaDrawerOpen && 'is-open')}
                          aria-label="Emoji, GIF e figurinha"
                          aria-expanded={mediaDrawerOpen}
                          title="Emoji, GIF e figurinha"
                        >
                          <Smile className="kds-control-icon" />
                        </IconButton>

                      <Popover open={composerAiMenuOpen} onOpenChange={setComposerAiMenuOpen}>
                        <PopoverTrigger
                          onClick={() => {
                            setAttachmentMenuOpen(false);
                            setMediaDrawerOpen(false);
                          }}
                        >
                          <IconButton
                            variant="ghost"
                            size="md"
                            disabled={(Boolean(composerRewriteDisabledReason) && Boolean(replySuggestionDisabledReason)) || rewritingComposer}
                            className={cx('whatsapp-inbox-composer-icon', (composerAiMenuOpen || composerRewriteModalOpen || replySuggestionLoading || rewritingComposer || replySuggestionText) && 'is-open')}
                            aria-label={rewritingComposer ? 'Reescrevendo texto com IA' : 'Ações com IA'}
                            aria-expanded={composerAiMenuOpen}
                            aria-busy={rewritingComposer || replySuggestionLoading}
                            title={rewritingComposer ? 'Reescrevendo texto com IA' : 'Ações com IA'}
                          >
                            {replySuggestionLoading || rewritingComposer ? <Loader2 className="kds-control-icon animate-spin" /> : <Sparkles className="kds-control-icon" />}
                          </IconButton>
                        </PopoverTrigger>
                        <PopoverContent
                          side="top"
                          align="start"
                          className="whatsapp-inbox-attach-menu min-w-[216px] overflow-hidden rounded-[var(--radius-2xl)] border p-1.5 shadow-xl"
                          aria-label="Ações de inteligência artificial"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleQuickRewriteComposerText('grammar');
                            }}
                            disabled={Boolean(composerRewriteDisabledReason) || rewritingComposer}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Corrigir texto com IA'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              {rewritingComposer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                            </span>
                            <span>Corrigir texto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleQuickRewriteComposerText('adapt_context');
                            }}
                            disabled={Boolean(composerRewriteDisabledReason) || rewritingComposer}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Adaptar texto ao contexto'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--brand-primary)]">
                              {rewritingComposer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </span>
                            <span>Adaptar ao contexto</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              handleOpenComposerRewriteModal();
                            }}
                            disabled={Boolean(composerRewriteDisabledReason)}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={composerRewriteDisabledReason ?? 'Abrir opções de reescrita'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              <SlidersHorizontal className="h-4 w-4" />
                            </span>
                            <span>Mais opções</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAiMenuOpen(false);
                              void handleGenerateReplySuggestion(true);
                            }}
                            disabled={Boolean(replySuggestionDisabledReason) || replySuggestionLoading}
                            className="whatsapp-inbox-attach-menu-item flex w-full items-center gap-2.5 px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            title={replySuggestionDisabledReason ?? 'Sugerir resposta com IA'}
                          >
                            <span className="whatsapp-inbox-attach-menu-icon text-[var(--accent-gold-hover)]">
                              {replySuggestionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                            </span>
                            <span>Sugerir resposta</span>
                          </button>
                          <div className="my-1 border-t border-[var(--border-subtle)]" />
                          <div className="grid grid-cols-3 gap-1 px-1 pb-1" aria-label="Formatacao do texto">
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('bold');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-7 items-center justify-center rounded-full text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Negrito"
                              title="Negrito"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('italic');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-7 items-center justify-center rounded-full text-xs italic transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Italico"
                              title="Italico"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setComposerAiMenuOpen(false);
                                handleApplyComposerTextFormat('strike');
                              }}
                              disabled={generatingFollowUp}
                              className="whatsapp-inbox-composer-icon inline-flex h-7 items-center justify-center rounded-full text-xs line-through transition disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Riscado"
                              title="Riscado"
                            >
                              S
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </ButtonGroup>

                    <div className={`relative min-w-0 flex-1 ${isComposerExpanded ? 'py-1.5' : 'py-0.5'}`}>
                      {quickReplyMenuOpen && (
                        <div className="absolute right-0 bottom-full left-0 z-[30] mb-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              Mensagens rápidas por atalho
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleOpenQuickReplySettings();
                              }}
                            >
                              Gerenciar
                            </Button>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Mensagens rápidas">
                            {quickReplyMenuHasResults ? (
                              filteredQuickReplyOptions.map((option, index) => {
                                const isActive = index === quickReplyActiveIndex;

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${isActive ? 'bg-[var(--brand-primary-soft)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      handleInsertQuickReply(option);
                                    }}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold">{option.name}</span>
                                        <code className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-gold-hover)]">
                                          /{option.shortcut}
                                        </code>
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                                        {option.preview}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="px-4 py-4 text-sm text-[var(--text-secondary)]">
                                <p className="font-medium">{quickReplyEmptyStateMessage}</p>
                                {quickRepliesLoadError ? (
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                                      Tente novamente ou use <strong>Gerenciar</strong> para conferir as mensagens salvas.
                                    </p>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => setQuickRepliesLoadRetryToken((current) => current + 1)}
                                    >
                                      Tentar novamente
                                    </Button>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                    Use o botão <strong>Gerenciar</strong> para criar e editar suas mensagens rápidas sem sair do inbox.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <textarea
                        ref={composerTextareaRef}
                        rows={1}
                        value={messageDraft}
                        onChange={handleComposerChange}
                        onPaste={handleComposerPaste}
                        onKeyDown={handleComposerKeyDown}
                        onClick={(event) => syncComposerSelection(event.currentTarget)}
                        onKeyUp={(event) => syncComposerSelection(event.currentTarget)}
                        onSelect={(event) => syncComposerSelection(event.currentTarget)}
                        onFocus={(event) => {
                          setComposerFocused(true);
                          syncComposerSelection(event.currentTarget);
                        }}
                        onBlur={() => setComposerFocused(false)}
                        placeholder="Digite uma mensagem"
                        disabled={generatingFollowUp}
                        className="whatsapp-inbox-composer-input block w-full resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 focus:outline-none"
                      />
                    </div>

                    <div className={`flex shrink-0 items-center gap-1 ${isComposerExpanded ? 'items-end pb-0.5' : ''}`}>
                      <button
                        type="button"
                        onClick={handleComposerSubmit}
                        disabled={generatingFollowUp || Boolean(sendDisabledReason) || voiceRecordingState === 'requesting'}
                        className={`whatsapp-inbox-composer-action inline-flex h-10 w-10 items-center justify-center rounded-full transition ${hasSendPayload ? 'is-active' : ''} ${generatingFollowUp || voiceRecordingState === 'requesting' ? 'cursor-wait opacity-70' : ''}`}
                        aria-label={voiceRecordingState === 'requesting' ? 'Solicitando microfone' : hasSendPayload ? 'Enviar mensagem' : 'Gravar áudio'}
                        title={sendDisabledReason ?? undefined}
                      >
                        {voiceRecordingState === 'requesting' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : hasSendPayload ? (
                          <SendHorizontal className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  </>
                  )}
                </div>
              </div>
  );
}
