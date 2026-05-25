import { memo, useEffect, useState } from 'react';
import { AlertTriangle, Download, Loader2, UserRound } from 'lucide-react';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';
import { useResolvedMediaUrl } from './useResolvedMediaUrl';
import { WhatsAppAudioPlayerCard } from './WhatsAppAudioPlayerCard';
import {
  formatFileSize, getDeletedMessageInfo,
  getEditedMessageInfo, getMessageContactCardInfo, getMessageLinkPreview,
  getMessageQuoteInfo, getMessageVisibleCaption, getVisiblePreviewText,
  inboxInlineActionClassName, isVideoLikeMessageType, LinkifiedText,
} from './InboxComponentsShared';

type WhatsAppMessageBodyProps = {
  message: CommWhatsAppMessage;
  onOpenImage: (messageId: string) => void;
  onTranscribe: (message: CommWhatsAppMessage) => void;
  onOpenSharedContactChat: (contact: { name: string | null; phoneNumber: string | null }) => void;
  onSaveSharedContact: (contact: { name: string | null; phoneNumber: string | null }) => void;
  sharedContactActionKey: string | null;
  transcribing: boolean;
};

function WhatsAppMessageBodyBase({ message, onOpenImage, onTranscribe, onOpenSharedContactChat, onSaveSharedContact, sharedContactActionKey, transcribing }: WhatsAppMessageBodyProps) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const kind = message.message_type.trim().toLowerCase();
  const caption = getMessageVisibleCaption(message);
  const editInfo = getEditedMessageInfo(message);
  const deletedInfo = getDeletedMessageInfo(message);
  const linkPreview = getMessageLinkPreview(message);
  const quoteInfo = getMessageQuoteInfo(message);
  const contactCardInfo = getMessageContactCardInfo(message);
  const visibleTextContent = getVisiblePreviewText(message.text_content, message.message_type);

  useEffect(() => { setShowOriginalText(false); }, [message.id, editInfo.originalText, message.text_content, message.media_caption]);

  const editInfoNode = editInfo.edited ? (
    <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">
        <span>Editada</span>
        {editInfo.previousText ? (
          <button type="button" onClick={() => setShowOriginalText((current) => !current)} className="h-7 rounded-xl px-2.5 text-[11px] normal-case tracking-normal font-semibold bg-transparent hover:bg-black/5 border border-[var(--panel-border-subtle,#e7dac8)]">
            {showOriginalText ? 'Ocultar alteracoes' : 'Ver antes e depois'}
          </button>
        ) : null}
      </div>
      {showOriginalText && editInfo.previousText ? (
        <div className="mt-2 grid gap-2">
          <div className="rounded-xl border border-[rgba(215,154,143,0.24)] bg-[rgba(122,33,24,0.04)] px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">Antes</p>
            <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text-muted,#876f5c)] line-through opacity-85" text={editInfo.previousText} />
          </div>
          {editInfo.currentText ? (
            <div className="rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">Depois</p>
              <LinkifiedText className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1f2937)]" text={editInfo.currentText} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const linkPreviewContent = linkPreview ? (
    <>
      {linkPreview.previewImage ? (
        <div className="overflow-hidden border-b border-[var(--panel-border-subtle,#e7dac8)] bg-black/10">
          <img src={linkPreview.previewImage} alt={linkPreview.title || linkPreview.domain || 'Preview do link'} className="max-h-[220px] w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="space-y-1.5 px-3 py-3">
        {linkPreview.title ? <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--panel-text,#1f2937)]">{linkPreview.title}</p> : null}
        {linkPreview.description ? <p className="line-clamp-3 text-sm leading-5 text-[var(--panel-text-muted,#6b7280)]">{linkPreview.description}</p> : null}
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--panel-text-muted,#8a735f)]">{linkPreview.domain || 'Link'}</p>
      </div>
    </>
  ) : null;

  const linkPreviewNode = linkPreviewContent ? (
    linkPreview?.url ? (
      <a href={linkPreview.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[rgba(255,248,240,0.05)] transition hover:border-[rgba(212,192,167,0.56)]">{linkPreviewContent}</a>
    ) : (
      <div className="overflow-hidden rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[rgba(255,248,240,0.05)]">{linkPreviewContent}</div>
    )
  ) : null;

  const quotePreviewNode = quoteInfo ? (
    <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-black/10 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-current/50 opacity-70" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Resposta</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 opacity-85">{quoteInfo.previewText}</p>
        </div>
      </div>
    </div>
  ) : null;

  const visibleContactItems = contactCardInfo?.items.slice(0, 3) ?? [];
  const hiddenContactCount = contactCardInfo ? Math.max(0, contactCardInfo.count - visibleContactItems.length) : 0;

  const contactCardNode = contactCardInfo ? (
    <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[rgba(255,248,240,0.05)] px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)]"><UserRound className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">
            {contactCardInfo.kind === 'contact' ? 'Contato compartilhado' : contactCardInfo.count > 0 ? `${contactCardInfo.count} contatos compartilhados` : 'Contatos compartilhados'}
          </p>
          {visibleContactItems.length > 0 ? (
            <div className="space-y-2">
              {visibleContactItems.map((item, index) => (
                <div key={`${item.name ?? 'contact'}:${item.phoneNumber ?? index}`} className="rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-[var(--panel-text,#1f2937)]">{item.name || 'Contato sem nome'}</p>
                  {item.phoneNumber ? <p className="mt-1 text-xs text-[var(--panel-text-muted,#6b7280)]">{item.phoneNumber}</p> : null}
                  {item.phoneNumber ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onOpenSharedContactChat(item)} disabled={sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`} className={inboxInlineActionClassName}>
                        {sharedContactActionKey === `open:${item.phoneNumber}` ? 'Abrindo...' : 'Abrir chat'}
                      </button>
                      <button type="button" onClick={() => onSaveSharedContact(item)} disabled={!item.name || sharedContactActionKey === `open:${item.phoneNumber}` || sharedContactActionKey === `save:${item.phoneNumber}`} className={inboxInlineActionClassName} title={item.name ? 'Salvar contato' : 'Contato sem nome para salvar'}>
                        {sharedContactActionKey === `save:${item.phoneNumber}` ? 'Salvando...' : 'Salvar contato'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">{message.text_content || '[Contato]'}</p>
          )}
          {hiddenContactCount > 0 ? <p className="text-xs text-[var(--panel-text-muted,#6b7280)]">+{hiddenContactCount} contato(s)</p> : null}
        </div>
      </div>
    </div>
  ) : null;

  if (deletedInfo.deleted) {
    const deletedByLabel = deletedInfo.deletedBy === 'self' ? 'Você apagou esta mensagem no WhatsApp.' : deletedInfo.deletedBy === 'contact' ? 'O contato apagou esta mensagem no WhatsApp.' : 'Mensagem apagada no WhatsApp.';
    return (
      <div className="rounded-2xl border border-[rgba(215,154,143,0.45)] bg-[rgba(122,33,24,0.08)] px-3 py-3 text-[var(--panel-accent-red-text,#b4534a)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]"><AlertTriangle className="h-3.5 w-3.5" /><span>Mensagem apagada</span></div>
        <p className="mt-2 text-xs text-[var(--panel-text-muted,#876f5c)]">{deletedByLabel}</p>
        <LinkifiedText className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text-soft,#5b4635)] line-through opacity-85" text={deletedInfo.preservedText} />
      </div>
    );
  }

  if (kind === 'image' || kind === 'sticker') {
    const isSticker = kind === 'sticker';
    const mediaLabel = isSticker ? 'Figurinha' : 'Imagem';
    const unavailableLabel = isSticker ? 'Figurinha indisponível' : 'Imagem indisponível';
    const loadingLabel = isSticker ? 'Carregando figurinha...' : 'Carregando imagem...';
    const altLabel = message.media_file_name || (isSticker ? 'Figurinha enviada' : 'Imagem enviada');

    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {mediaUrl ? (
          <button type="button" onClick={() => onOpenImage(message.id)} className={isSticker ? 'block w-fit max-w-[180px] overflow-hidden rounded-2xl border border-transparent bg-transparent text-left transition hover:border-current/15' : 'whatsapp-inbox-image-card block w-full overflow-hidden rounded-2xl border text-left'}>
            <img src={mediaUrl} alt={altLabel} className={isSticker ? 'max-h-[180px] max-w-[180px] object-contain' : 'max-h-[280px] w-full object-cover'} loading="lazy" />
            {!isSticker ? (
              <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="truncate font-medium">{message.media_file_name || mediaLabel}</span>
                <span className="shrink-0 opacity-80">Toque para ampliar</span>
              </div>
            ) : null}
          </button>
        ) : (
          <div className={isSticker ? 'flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 px-3 text-center text-sm opacity-80' : 'flex h-40 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80'}>
            {loading ? loadingLabel : error || unavailableLabel}
          </div>
        )}
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (isVideoLikeMessageType(kind)) {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <div className="whatsapp-inbox-image-card overflow-hidden rounded-2xl border">
          {mediaUrl ? (
            <video controls preload="metadata" className="max-h-[320px] w-full bg-black object-contain"><source src={mediaUrl} type={message.media_mime_type || undefined} /></video>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-current/20 bg-black/5 text-sm opacity-80">{loading ? 'Carregando vídeo...' : error || 'Vídeo indisponível'}</div>
          )}
          <div className="whatsapp-inbox-image-card-footer flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="truncate font-medium">{message.media_file_name || 'Video'}</span>
            <span className="shrink-0 opacity-80">{formatFileSize(message.media_size_bytes) || 'Midia'}</span>
          </div>
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'document') {
    const extension = message.media_file_name?.split('.').pop()?.toUpperCase() || 'DOC';
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <div className="whatsapp-inbox-document-card flex items-center gap-3 rounded-2xl border px-3 py-3">
          <div className="whatsapp-inbox-document-thumb flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xs font-semibold tracking-[0.08em]">{extension.slice(0, 4)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{message.media_file_name || 'Documento'}</p>
            <p className="text-xs opacity-75">{formatFileSize(message.media_size_bytes) || 'Documento anexo'}</p>
          </div>
          <div className="flex items-center gap-2">
            {mediaUrl ? (
              <>
                <a href={mediaUrl} target="_blank" rel="noreferrer" className={inboxInlineActionClassName}>Abrir</a>
                <a href={mediaUrl} download={message.media_file_name || 'documento'} className={inboxInlineActionClassName}><Download className="h-3.5 w-3.5" /> Baixar</a>
              </>
            ) : (
              <span className="text-xs opacity-75">{loading ? 'Carregando...' : error || 'Sem arquivo'}</span>
            )}
          </div>
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'audio' || kind === 'voice') {
    const transcriptionStatus = message.transcription_status || 'idle';
    const canTranscribe = Boolean(message.media_id || message.media_url);
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        <WhatsAppAudioPlayerCard kind={kind} mediaUrl={mediaUrl} mediaMimeType={message.media_mime_type} fileName={message.media_file_name} durationSeconds={message.media_duration_seconds} loading={loading} error={error} />
        <div className="space-y-2">
          {transcriptionStatus === 'completed' && message.transcription_text?.trim() ? (
            <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">Transcrição</p>
                {message.transcription_provider ? <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--panel-text-subtle,#9a8573)]">{message.transcription_provider}</span> : null}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1f2937)]">{message.transcription_text}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {transcriptionStatus === 'processing' || transcribing ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1.5 text-[11px] font-semibold text-[var(--panel-text-soft,#5b4635)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Transcrevendo...
              </span>
            ) : canTranscribe ? (
              <button type="button" onClick={() => onTranscribe(message)} className="inline-flex items-center justify-center rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1.5 text-[11px] font-semibold text-[var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-accent-soft,#f4e2cc)] transition">
                {transcriptionStatus === 'failed' ? 'Tentar novamente' : message.transcription_text?.trim() ? 'Retranscrever' : 'Transcrever'}
              </button>
            ) : null}
            {transcriptionStatus === 'failed' && message.transcription_error ? <span className="text-xs text-[var(--panel-accent-red-text,#d9776b)]">{message.transcription_error}</span> : null}
          </div>
        </div>
        {caption ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={caption} /> : null}
        {editInfoNode}
      </div>
    );
  }

  if (kind === 'contact' || kind === 'contact_list') {
    return (
      <div className="space-y-3">
        {quotePreviewNode}
        {contactCardNode || <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={message.text_content || '[Contato]'} />}
        {editInfoNode}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotePreviewNode}
      {linkPreviewNode}
      {visibleTextContent ? <LinkifiedText className="whitespace-pre-wrap break-words text-sm leading-6" text={visibleTextContent} /> : null}
      {editInfoNode}
    </div>
  );
}

export const WhatsAppMessageBody = memo(WhatsAppMessageBodyBase);
