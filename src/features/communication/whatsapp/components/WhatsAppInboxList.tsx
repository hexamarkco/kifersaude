import { AlertCircle, AlertTriangle, Archive, BellOff, Check, CheckCheck, ChevronDown, Clock3, Loader2, Pin, Play, SendHorizontal, Users, Volume2 } from 'lucide-react';

import { Button, Checkbox } from '../../../../design-system';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppMessageSearchResult } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import {
  getChatPreviewIconType,
  getMessageSearchPreviewText,
  getVisiblePreviewText,
  isVideoLikeMessageType,
} from '../domain/messagePresentation';
import {
  getSafeChatDisplayName,
} from '../domain/chatPresentation';
import { formatMessageTime } from '../domain/messageTimeline';
import { formatDurationLabel, formatFileSize } from '../domain/messageMediaPresentation';
import ChatPreviewIcon from './ChatPreviewIcon';
import { MediaSendingOverlay } from './WhatsAppMessageContent';
import { useResolvedMediaUrl } from '../hooks/useResolvedMediaUrl';
import WhatsAppPresenceIndicator from './WhatsAppPresenceIndicator';

type PointerAnchor = {
  x: number;
  y: number;
};

const getDeliveryStatusMetaFromValues = (deliveryStatus?: string | null, messageType?: string | null) => {
  const status = String(deliveryStatus ?? '').trim().toLowerCase();

  switch (status) {
    case 'pending':
    case 'queued':
    case 'sending':
      return { icon: Clock3, label: 'Enviando', tone: 'pending' as const };
    case 'sent':
    case 'received':
      return { icon: Check, label: 'Enviado', tone: 'sent' as const };
    case 'delivered':
      return { icon: CheckCheck, label: 'Entregue', tone: 'delivered' as const };
    case 'read':
    case 'seen':
    case 'viewed':
      return { icon: CheckCheck, label: 'Vista', tone: 'read' as const };
    case 'played':
      return {
        icon: Volume2,
        label: messageType === 'voice' ? 'Ouvida' : 'Reproduzida',
        tone: 'played' as const,
      };
    case 'failed':
    case 'error':
      return { icon: AlertCircle, label: 'Falhou', tone: 'failed' as const };
    case 'deleted':
      return { icon: AlertTriangle, label: 'Apagada', tone: 'deleted' as const };
    default:
      return { icon: Clock3, label: 'Enviando', tone: 'pending' as const };
  }
};

const getDeliveryStatusMeta = (message: CommWhatsAppMessage) => getDeliveryStatusMetaFromValues(message.delivery_status, message.message_type);

export function DeliveryStatusIndicator({ message }: { message: CommWhatsAppMessage }) {
  const meta = getDeliveryStatusMeta(message);
  const Icon = meta.icon;

  return (
    <span
      className={`whatsapp-inbox-status-meta whatsapp-inbox-status-meta-${meta.tone} inline-flex shrink-0 items-center whitespace-nowrap`}
      title={meta.label}
      aria-label={`Status: ${meta.label}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
export function RetryMediaButton({
  loading,
  onRetry,
}: {
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onRetry}
      disabled={loading}
      variant="soft"
      size="sm"
      className="whatsapp-inbox-retry-button"
    >
      {loading ? <Loader2 className="animate-spin" /> : <SendHorizontal className="kds-control-icon" />}
      Reenviar
    </Button>
  );
}

export function InboxFilterChip({
  active,
  label,
  onClick,
  compact = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      variant={active ? 'soft' : 'secondary'}
      size="sm"
      className={compact ? 'text-[11px]' : 'text-xs'}
    >
      {label}
    </Button>
  );
}

export function InboxFilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {options.map((option) => (
          <InboxFilterChip key={option.value} active={value === option.value} label={option.label} onClick={() => onChange(option.value)} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function InboxMultiFilterGroup({
  label,
  values,
  options,
  onChange,
  compact = false,
  variant = 'chips',
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (value: string[]) => void;
  compact?: boolean;
  variant?: 'chips' | 'list';
}) {
  const normalizedValues = values.map((value) => value.toLowerCase());

  const toggleValue = (value: string) => {
    const normalized = value.toLowerCase();
    const next = normalizedValues.includes(normalized)
      ? values.filter((item) => item.toLowerCase() !== normalized)
      : [...values, value];
    onChange(next);
  };

  if (variant === 'list') {
    return (
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
          {values.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-primary)] transition hover:text-[var(--brand-primary-hover)]"
            >
              Limpar
            </button>
          ) : null}
        </div>
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-1">
          {options.map((option) => {
            const selected = normalizedValues.includes(option.value.toLowerCase());
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
              >
                <Checkbox checked={selected} onChange={() => toggleValue(option.value)} />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
          {options.length === 0 ? <p className="px-2 py-3 text-xs text-[var(--text-muted)]">Nenhuma opção disponível</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        <InboxFilterChip active={values.length === 0} label="Todos" onClick={() => onChange([])} compact={compact} />
        {options.map((option) => (
          <InboxFilterChip
            key={option.value}
            active={normalizedValues.includes(option.value.toLowerCase())}
            label={option.label}
            onClick={() => toggleValue(option.value)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export function WhatsAppGalleryMediaTile({
  message,
  onOpenImage,
  className,
  overlayLabel,
  mediaSending = false,
  mediaSendingProgress = null,
  onCancelMediaUpload,
}: {
  message: CommWhatsAppMessage;
  onOpenImage: (messageId: string) => void;
  className?: string;
  overlayLabel?: string;
  mediaSending?: boolean;
  mediaSendingProgress?: number | null;
  onCancelMediaUpload?: () => void;
}) {
  const { mediaUrl, loading, error } = useResolvedMediaUrl(message);
  const normalizedKind = isVideoLikeMessageType(message.message_type) ? 'video' : 'image';
  const baseClassName = `relative block overflow-hidden rounded-[var(--kds-radius-lg)] bg-[var(--bg-inset)] ${className ?? ''}`.trim();

  if (normalizedKind === 'image') {
    return (
      <div className={baseClassName}>
        {mediaUrl ? (
          <button
            type="button"
            onClick={() => onOpenImage(message.id)}
            className="relative block h-full w-full overflow-hidden"
          >
            <img src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="h-full w-full object-cover" loading="lazy" />
            {overlayLabel ? (
              <span className="absolute inset-0 flex items-center justify-center bg-[var(--overlay)] text-base font-semibold text-[var(--text-on-brand)]">
                {overlayLabel}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            {loading ? 'Carregando imagem...' : error || 'Imagem indisponivel'}
          </div>
        )}
        {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
      </div>
    );
  }

  const secondaryLabel = message.media_duration_seconds && message.media_duration_seconds > 0
    ? formatDurationLabel(Math.round(message.media_duration_seconds))
    : formatFileSize(message.media_size_bytes) || 'Video';

  return (
    <div className={baseClassName}>
      {mediaUrl ? (
        <button type="button" onClick={() => onOpenImage(message.id)} className="relative block h-full w-full overflow-hidden">
          <video muted playsInline preload="metadata" className="h-full w-full object-cover">
            <source src={mediaUrl} type={message.media_mime_type || undefined} />
          </video>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[var(--overlay)] px-3 py-2 text-xs font-medium text-[var(--text-on-brand)]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="truncate">{secondaryLabel}</span>
            </span>
            {overlayLabel ? <span className="text-sm font-semibold">{overlayLabel}</span> : null}
          </div>
        </button>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
          {loading ? 'Carregando video...' : error || 'Video indisponivel'}
        </div>
      )}
      {mediaSending ? <MediaSendingOverlay progress={mediaSendingProgress} onCancel={onCancelMediaUpload} /> : null}
    </div>
  );
}

export function WhatsAppMediaGroupBody({
  messages,
  onOpenImage,
  mediaSendingMessageId,
  mediaSendingProgress = null,
  onCancelMediaUpload,
}: {
  messages: CommWhatsAppMessage[];
  onOpenImage: (messageId: string) => void;
  mediaSendingMessageId?: string | null;
  mediaSendingProgress?: number | null;
  onCancelMediaUpload?: () => void;
}) {
  const visibleMessages = messages.slice(0, 4);
  const hiddenCount = Math.max(0, messages.length - visibleMessages.length);

  return (
    <div className="grid w-[13.75rem] max-w-full grid-cols-2 gap-1.5">
      {visibleMessages.map((message, index) => {
        const isWideHero = messages.length === 3 && index === 0;
        const overlayLabel = hiddenCount > 0 && index === visibleMessages.length - 1 ? `+${hiddenCount}` : undefined;

        return (
          <WhatsAppGalleryMediaTile
            key={message.id}
            message={message}
            onOpenImage={onOpenImage}
            className={isWideHero ? 'col-span-2 aspect-[16/9]' : 'aspect-square'}
            overlayLabel={overlayLabel}
            mediaSending={message.id === mediaSendingMessageId}
            mediaSendingProgress={message.id === mediaSendingMessageId ? mediaSendingProgress : null}
            onCancelMediaUpload={message.id === mediaSendingMessageId ? onCancelMediaUpload : undefined}
          />
        );
      })}
    </div>
  );
}

export function InboxChatListItem({
  chat,
  selected,
  connectedUserName,
  draftPreview,
  favorito,
  onSelect,
  menuOpen,
  menuBusy,
  onToggleMenu,
  onOpenContextMenu,
  menuTriggerRef,
}: {
  chat: CommWhatsAppChat;
  selected: boolean;
  connectedUserName: string | null;
  favorito?: boolean;
  draftPreview: string;
  onSelect: (chatId: string) => void;
  menuOpen: boolean;
  menuBusy: boolean;
  onToggleMenu: (chatId: string) => void;
  onOpenContextMenu: (chatId: string, anchor: PointerAnchor) => void;
  menuTriggerRef: (node: HTMLButtonElement | null) => void;
}) {
  const rawLastMessageText = String(chat.last_message_text ?? '').trim();
  const visibleLastMessageText = getVisiblePreviewText(chat.last_message_text);
  const previewIconType = getChatPreviewIconType(visibleLastMessageText);
  const outboundPreviewStatusMeta = chat.last_message_direction === 'outbound'
    ? getDeliveryStatusMetaFromValues(chat.last_message_delivery_status)
    : null;
  const OutboundPreviewStatusIcon = outboundPreviewStatusMeta?.icon;
  const hasUnreadBadge = chat.unread_count > 0 || chat.manual_unread;

  return (
    <div
      className={`group/chat relative whatsapp-inbox-chat-card border-b transition ${selected ? 'is-active' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu(chat.id, { x: event.clientX, y: event.clientY });
      }}
    >
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <LeadFavoriteBadge favorito={favorito} />
                <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--text-primary)]">
                  {chat.is_group ? <Users className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-label="Grupo" /> : null}
                  {getSafeChatDisplayName(chat, connectedUserName)}
                </p>
                <WhatsAppPresenceIndicator chat={chat} compact />
                {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" /> : null}
                {chat.is_archived ? <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
                {chat.is_muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start">
              <span className="whatsapp-inbox-chat-meta text-[11px] font-medium leading-none">{formatMessageTime(chat.last_message_at)}</span>
            </div>
          </div>
          <p className={`mt-px truncate text-sm text-[var(--text-secondary)] ${hasUnreadBadge ? 'pr-12' : ''}`}>
            {draftPreview ? (
              <>
                <span className="mr-1 font-semibold text-[var(--danger-text)]">Rascunho:</span>
                <span>{draftPreview}</span>
              </>
            ) : visibleLastMessageText ? (
              <>
                {OutboundPreviewStatusIcon && outboundPreviewStatusMeta ? (
                  <span className={`mr-1 inline-flex align-middle whatsapp-inbox-preview-status whatsapp-inbox-preview-status-${outboundPreviewStatusMeta.tone}`} title={outboundPreviewStatusMeta.label} aria-label={outboundPreviewStatusMeta.label}>
                    <OutboundPreviewStatusIcon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                {previewIconType ? (
                  <ChatPreviewIcon type={previewIconType} />
                ) : (
                  <span>{visibleLastMessageText}</span>
                )}
              </>
            ) : rawLastMessageText ? 'Mensagem' : 'Sem mensagens ainda'}
          </p>
          {hasUnreadBadge ? (
            <span className="whatsapp-inbox-unread-badge absolute right-4 top-1/2 inline-flex min-h-5 min-w-6 -translate-y-1/2 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {chat.unread_count > 0 ? chat.unread_count : '•'}
            </span>
          ) : null}
        </button>
      </div>

      <button
        ref={menuTriggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu(chat.id);
        }}
        className={cx(
          'absolute right-3 top-2.5 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
          menuOpen ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] opacity-100' : 'opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100',
          selected ? 'opacity-100' : '',
        )}
        aria-label="Abrir menu da conversa"
        aria-expanded={menuOpen}
        disabled={menuBusy}
      >
        {menuBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />}
      </button>
    </div>
  );
}

export function InboxMessageSearchListItem({
  result,
  selected,
  connectedUserName,
  favorito,
  onSelect,
}: {
  result: CommWhatsAppMessageSearchResult;
  selected: boolean;
  connectedUserName?: string | null;
  favorito?: boolean;
  onSelect: (chatId: string) => void;
}) {
  const messagePreviewText = getMessageSearchPreviewText(result.message);
  const messagePreviewIconType = getChatPreviewIconType(messagePreviewText);

  if (!messagePreviewText) {
    return null;
  }

  return (
    <div className={`relative border-b transition ${selected ? 'is-active' : ''}`}>
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(result.chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="whatsapp-inbox-heading flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-primary)]">
                <LeadFavoriteBadge favorito={favorito} />
                {getSafeChatDisplayName(result.chat, connectedUserName)}
              </p>
              {messagePreviewText ? (
                <p className="mt-px truncate text-sm text-[var(--text-secondary)]">
                  {messagePreviewIconType ? (
                    <ChatPreviewIcon type={messagePreviewIconType} />
                  ) : (
                    messagePreviewText
                  )}
                </p>
              ) : null}
            </div>
            <span className="whatsapp-inbox-chat-meta shrink-0 pt-0.5 text-[11px] font-medium leading-none">
              {formatMessageTime(result.message.message_at)}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
