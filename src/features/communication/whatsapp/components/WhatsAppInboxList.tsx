import { Text, FieldLabel, Image, Video } from '../../../../design-system';
import { ActionSurface, IconButton } from '../../../../design-system';
import { AlertCircle, AlertTriangle, Archive, BellOff, Check, CheckCheck, ChevronDown, Clock3, Loader2, Pin, Play, SendHorizontal, Users, Volume2 } from 'lucide-react';

import { Button, Checkbox, OperationalStatusBadge } from '../../../../design-system';
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
      return { icon: Clock3, label: 'Enviando', tone: 'pending' as const };
    case 'sending':
      return { icon: Clock3, label: 'Aguardando confirmação', tone: 'pending' as const };
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
      <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</Text>
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
          <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</Text>
          {values.length > 0 ? (
            <Button variant="ghost"
              type="button"
              onClick={() => onChange([])}
              className="font-semibold uppercase tracking-[0.08em] transition"
            >
              Limpar
            </Button>
          ) : null}
        </div>
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] p-1">
          {options.map((option) => {
            const selected = normalizedValues.includes(option.value.toLowerCase());
            return (
              <FieldLabel
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
              >
                <Checkbox checked={selected} onChange={() => toggleValue(option.value)} />
                <span className="truncate">{option.label}</span>
              </FieldLabel>
            );
          })}
          {options.length === 0 ? <Text className="px-2 py-3 text-xs text-[var(--text-muted)]">Nenhuma opção disponível</Text> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</Text>
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
          <ActionSurface variant="plain" padding="none"
            type="button"
            onClick={() => onOpenImage(message.id)}
            className="relative block h-full w-full overflow-hidden"
          >
            <Image src={mediaUrl} alt={message.media_file_name || 'Imagem enviada'} className="h-full w-full object-cover" loading="lazy" />
            {overlayLabel ? (
              <span className="absolute inset-0 flex items-center justify-center bg-[var(--overlay)] text-base font-semibold text-[var(--text-on-brand)]">
                {overlayLabel}
              </span>
            ) : null}
          </ActionSurface>
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
        <ActionSurface variant="plain" padding="none" type="button" onClick={() => onOpenImage(message.id)} className="relative block h-full w-full overflow-hidden">
          <Video muted playsInline preload="metadata" className="h-full w-full object-cover">
            <source src={mediaUrl} type={message.media_mime_type || undefined} />
          </Video>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-[var(--overlay)] px-3 py-2 text-xs font-medium text-[var(--text-on-brand)]">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="truncate">{secondaryLabel}</span>
            </span>
            {overlayLabel ? <span className="text-sm font-semibold">{overlayLabel}</span> : null}
          </div>
        </ActionSurface>
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
  leadStatusColor,
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
  leadStatusColor?: string | null;
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
        <ActionSurface variant="plain" padding="none" type="button" onClick={() => onSelect(chat.id)} className="whatsapp-inbox-chat-select min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <LeadFavoriteBadge favorito={favorito} />
                <Text className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--text-primary)]">
                  {chat.is_group ? <Users className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-label="Grupo" /> : null}
                  {getSafeChatDisplayName(chat, connectedUserName)}
                </Text>
                {!chat.is_group && chat.lead_id && chat.lead_status?.trim() ? (
                  <OperationalStatusBadge statusColor={leadStatusColor ?? 'var(--text-muted)'} className="whatsapp-inbox-chat-lead-status" title={`Status do lead: ${chat.lead_status}`} aria-label={`Status do lead: ${chat.lead_status}`}>
                    <span className="min-w-0 truncate">{chat.lead_status}</span>
                  </OperationalStatusBadge>
                ) : null}
                {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" /> : null}
                {chat.is_archived ? <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
                {chat.is_muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" /> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start pr-12 sm:pr-8">
              <span className="whatsapp-inbox-chat-meta text-[11px] font-medium leading-none">{formatMessageTime(chat.last_message_at)}</span>
            </div>
          </div>
          <Text className={`mt-px truncate text-sm text-[var(--text-secondary)] ${hasUnreadBadge ? 'pr-12' : ''}`}>
            <WhatsAppPresenceIndicator chat={chat} fallback={draftPreview ? (
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
            ) : rawLastMessageText ? 'Mensagem' : 'Sem mensagens ainda'} />
          </Text>
          {hasUnreadBadge ? (
            <span className="whatsapp-inbox-unread-badge absolute right-4 top-1/2 inline-flex min-h-5 min-w-6 -translate-y-1/2 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {chat.unread_count > 0 ? chat.unread_count : '•'}
            </span>
          ) : null}
        </ActionSurface>
      </div>

      <IconButton variant="ghost" size="sm"
        ref={menuTriggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleMenu(chat.id);
        }}
        className={cx(
          "absolute right-3 top-2.5 z-[2] inline-flex w-6 items-center justify-center transition",
          menuOpen ? "opacity-100" : "opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100",
          selected ? "opacity-100" : "",
        )}
        aria-label="Abrir menu da conversa"
        aria-expanded={menuOpen}
        disabled={menuBusy}
      >
        {menuBusy ? <Loader2 className="animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />}
      </IconButton>
    </div>
  );
}

export function InboxMessageSearchListItem({
  result,
  leadStatusColor,
  selected,
  connectedUserName,
  favorito,
  onSelect,
}: {
  result: CommWhatsAppMessageSearchResult;
  leadStatusColor?: string | null;
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
        <ActionSurface variant="plain" padding="none" type="button" onClick={() => onSelect(result.chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <LeadFavoriteBadge favorito={favorito} />
                <Text className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--text-primary)]">
                  {getSafeChatDisplayName(result.chat, connectedUserName)}
                </Text>
                {!result.chat.is_group && result.chat.lead_id && result.chat.lead_status?.trim() ? (
                  <OperationalStatusBadge statusColor={leadStatusColor ?? 'var(--text-muted)'} className="whatsapp-inbox-chat-lead-status" title={`Status do lead: ${result.chat.lead_status}`} aria-label={`Status do lead: ${result.chat.lead_status}`}>
                    <span className="min-w-0 truncate">{result.chat.lead_status}</span>
                  </OperationalStatusBadge>
                ) : null}
              </div>
              {messagePreviewText ? (
                <Text className="mt-px truncate text-sm text-[var(--text-secondary)]">
                  {messagePreviewIconType ? (
                    <ChatPreviewIcon type={messagePreviewIconType} />
                  ) : (
                    messagePreviewText
                  )}
                </Text>
              ) : null}
            </div>
            <span className="whatsapp-inbox-chat-meta shrink-0 pt-0.5 text-[11px] font-medium leading-none">
              {formatMessageTime(result.message.message_at)}
            </span>
          </div>
        </ActionSurface>
      </div>
    </div>
  );
}
