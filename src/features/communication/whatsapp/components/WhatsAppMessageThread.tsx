import type { MutableRefObject, ReactNode, UIEventHandler } from 'react';
import { ChevronDown, ChevronUp, Loader2, Smile, Star } from 'lucide-react';

import { Button } from '../../../../design-system';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import type { MediaUploadProgress } from '../domain/mediaUploadState';
import type { InboxMessageTimelineItem } from '../domain/inboxMessageTimeline';
import {
  getMessageBubbleClasses,
  getMessageRowClasses,
  hasVisualMediaCaption,
  isBubblelessMediaMessage,
  isGroupChatMessage,
  isMediaSendingMessage,
} from '../domain/inboxPresentation';
import { getVisualMediaBubbleWidth } from '../domain/messageMediaPresentation';
import {
  canDeleteOutboundMessage,
  canEditOutboundMessage,
  canReplyOrForwardMessage,
  isMessageStarred,
} from '../domain/messagePresentation';
import { getMessageReactions, getReactionTooltipText } from '../domain/messageMetadata';
import { formatMessageTime } from '../domain/messageTimeline';
import { DeliveryStatusIndicator, RetryMediaButton, WhatsAppMediaGroupBody } from './WhatsAppInboxList';
import { WhatsAppMessageBody } from './WhatsAppMessageContent';

type MessageElementRefs = MutableRefObject<Record<string, HTMLDivElement | null>>;
type ButtonElementRefs = MutableRefObject<Record<string, HTMLButtonElement | null>>;

export function WhatsAppMessageThread({
  messagesContainerRef,
  messageBubbleRefs,
  reactionAnchorRefs,
  reactionTriggerRefs,
  messageActionTriggerRefs,
  handleMessagesScroll,
  messageLoadErrorNotice,
  hasOlderMessages,
  loadingOlderMessages,
  handleLoadOlderMessages,
  loadingMessages,
  messageLoadError,
  threadReconcileChatId,
  selectedChat,
  messages,
  messageTimelineItems,
  highlightedMessageId,
  mediaUploadProgress,
  retryingMessageId,
  localOutgoingRetryPayloadRef,
  setLightboxMessageId,
  handleCancelMediaUpload,
  openMessageActionMenuMessageId,
  handleToggleMessageActionMenu,
  starringMessageIds,
  handleToggleStarMessage,
  setRetryPendingMessage,
  handleToggleReactionPicker,
  handleOpenMessageActionMenuFromContext,
  handleOpenQuotedMessage,
  handleTranscribeMessage,
  handleSelectInteractiveReply,
  handleOpenSharedContactChat,
  handleSaveSharedContact,
  sharedContactActionKey,
  transcribingMessageId,
}: {
  messagesContainerRef: MutableRefObject<HTMLDivElement | null>;
  messageBubbleRefs: MessageElementRefs;
  reactionAnchorRefs: MessageElementRefs;
  reactionTriggerRefs: ButtonElementRefs;
  messageActionTriggerRefs: ButtonElementRefs;
  handleMessagesScroll: UIEventHandler<HTMLDivElement>;
  messageLoadErrorNotice: ReactNode;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  handleLoadOlderMessages: () => void | Promise<void>;
  loadingMessages: boolean;
  messageLoadError: string | null;
  threadReconcileChatId: string | null;
  selectedChat: CommWhatsAppChat;
  messages: CommWhatsAppMessage[];
  messageTimelineItems: InboxMessageTimelineItem[];
  highlightedMessageId: string | null;
  mediaUploadProgress: MediaUploadProgress | null;
  retryingMessageId: string | null;
  localOutgoingRetryPayloadRef: { current: { has: (messageId: string) => boolean } };
  setLightboxMessageId: (messageId: string | null) => void;
  handleCancelMediaUpload: () => void;
  openMessageActionMenuMessageId: string | null;
  handleToggleMessageActionMenu: (messageId: string) => void;
  starringMessageIds: Set<string>;
  handleToggleStarMessage: (message: CommWhatsAppMessage) => void;
  setRetryPendingMessage: (message: CommWhatsAppMessage) => void;
  handleToggleReactionPicker: (messageId: string) => void;
  handleOpenMessageActionMenuFromContext: (messageId: string, anchor: { x: number; y: number }) => void;
  handleOpenQuotedMessage: (externalMessageId: string) => void;
  handleTranscribeMessage: (message: CommWhatsAppMessage) => void | Promise<void>;
  handleSelectInteractiveReply: (message: CommWhatsAppMessage, option: { id: string | null; title: string | null }) => void;
  handleOpenSharedContactChat: (contact: { name: string | null; phoneNumber: string | null }) => void | Promise<void>;
  handleSaveSharedContact: (contact: { name: string | null; phoneNumber: string | null }) => void | Promise<void>;
  sharedContactActionKey: string | null;
  transcribingMessageId: string | null;
}) {
  return (
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="whatsapp-inbox-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5"
              >
                {messageLoadErrorNotice}
                {(hasOlderMessages || loadingOlderMessages) && (
                  <div className="sticky top-0 z-[1] flex justify-center pb-3">
                    <Button
                      type="button"
                      onClick={() => void handleLoadOlderMessages()}
                      disabled={loadingOlderMessages}
                      variant="secondary"
                      size="sm"
                      className="whatsapp-inbox-load-older"
                    >
                      {loadingOlderMessages ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <ChevronUp className="kds-control-icon" />
                      )}
                      {loadingOlderMessages ? 'Carregando...' : 'Carregar mais'}
                    </Button>
                  </div>
                )}

                {loadingMessages && messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando mensagens...
                  </div>
                ) : !messageLoadError && threadReconcileChatId === selectedChat.id && messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando histórico desta conversa...
                  </div>
                ) : !messageLoadError && messages.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]">
                    Nenhuma mensagem carregada para esta conversa.
                  </div>
                ) : (
                  messageTimelineItems.map((item) => {
                    if (item.type === 'day') {
                      return (
                        <div key={item.key} className="flex w-full justify-center py-1">
                          <div className="whatsapp-inbox-day-divider rounded-full border px-3 py-1 text-[12px] font-semibold shadow-sm">
                            {item.label}
                          </div>
                        </div>
                      );
                    }

                    if (item.type === 'media-group') {
                      const groupMessages = item.messages.filter(Boolean);
                      if (groupMessages.length === 0) {
                        return null;
                      }

                      const lastMessage = groupMessages[groupMessages.length - 1];

                      const groupHighlighted = groupMessages.some((message) => message.id === highlightedMessageId);
                      const groupMediaSendingMessage = groupMessages.find((message) => (
                        message.id === mediaUploadProgress?.attachmentId || message.id === retryingMessageId
                      )) ?? groupMessages.find((message) => isMediaSendingMessage(
                        message,
                        mediaUploadProgress,
                        retryingMessageId === message.id,
                      ));
                      const groupMediaSendingProgress = groupMediaSendingMessage && mediaUploadProgress?.attachmentId === groupMediaSendingMessage.id
                        ? mediaUploadProgress.progress
                        : null;
                      const canCancelGroupMediaUpload = Boolean(
                        groupMediaSendingMessage && mediaUploadProgress?.attachmentId === groupMediaSendingMessage.id,
                      );
                      const mediaGroupMeta = (
                        <div className={`whatsapp-inbox-message-meta mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] font-medium ${lastMessage.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                            <span>{formatMessageTime(lastMessage.message_at)}</span>
                            {lastMessage.direction === 'outbound' && !groupMediaSendingMessage ? <DeliveryStatusIndicator message={lastMessage} /> : null}
                          </span>
                        </div>
                      );

                      return (
                        <div
                          key={item.key}
                          ref={(node) => {
                            for (const groupMessage of groupMessages) {
                              if (node) {
                                messageBubbleRefs.current[groupMessage.id] = node;
                              } else {
                                delete messageBubbleRefs.current[groupMessage.id];
                              }
                            }
                          }}
                          className={`message-bubble-row flex w-full ${getMessageRowClasses(lastMessage.direction)}`}
                        >
                          <div className="relative max-w-[82%] pb-2">
                            {isGroupChatMessage(selectedChat, lastMessage) && lastMessage.direction === 'inbound' && lastMessage.sender_name ? (
                              <p className="mb-1 px-1 text-xs font-semibold text-[var(--brand-primary)]">{lastMessage.sender_name}</p>
                            ) : null}
                            <div className={`whatsapp-inbox-media-message ${groupHighlighted ? 'message-bubble-search-highlight' : ''}`}>
                              <WhatsAppMediaGroupBody
                                messages={groupMessages}
                                onOpenImage={setLightboxMessageId}
                                mediaSendingMessageId={groupMediaSendingMessage?.id}
                                mediaSendingProgress={groupMediaSendingProgress}
                                onCancelMediaUpload={canCancelGroupMediaUpload ? handleCancelMediaUpload : undefined}
                              />
                            </div>
                            {mediaGroupMeta}
                          </div>
                        </div>
                      );
                    }

                    const { message } = item;
                    if (!message) {
                      return null;
                    }

                    const reactions = getMessageReactions(message);
                    const reactionTooltipText = getReactionTooltipText(message);
                    const showEditAction = canEditOutboundMessage(message);
                    const showDeleteAction = canDeleteOutboundMessage(message);
                    const showReplyForwardActions = canReplyOrForwardMessage(message);
                    const mediaSending = isMediaSendingMessage(message, mediaUploadProgress, retryingMessageId === message.id);
                    const mediaSendingProgress = mediaUploadProgress?.attachmentId === message.id ? mediaUploadProgress.progress : null;
                    const isGroupMessage = isGroupChatMessage(selectedChat, message);
                    const messageMetaJustify = message.direction === 'outbound' ? 'justify-end' : 'justify-start';
                    const messageMetaTimeOrder = message.direction === 'outbound' ? 'order-3' : 'order-1';
                    const messageMetaActionsOrder = message.direction === 'outbound' ? 'order-1' : 'order-3';
                      const messageMeta = (
                        <div className={cx(
                        'whatsapp-inbox-message-meta flex w-full flex-wrap items-center gap-1.5 text-[11px] font-medium',
                        reactions.length > 0
                          ? `mt-0 px-1 ${messageMetaJustify}`
                          : isGroupMessage
                          ? `mt-1 px-1 ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`
                          : isBubblelessMediaMessage(message) && !hasVisualMediaCaption(message)
                            ? `mt-1 px-1 ${messageMetaJustify}`
                            : `mt-2 px-1 ${messageMetaJustify}`,
                      )}>
                        <span className={`${messageMetaTimeOrder} inline-flex shrink-0 items-center gap-1 whitespace-nowrap`}>
                          <span>{formatMessageTime(message.message_at)}</span>
                          {message.direction === 'outbound' && !mediaSending ? <DeliveryStatusIndicator message={message} /> : null}
                        </span>
                        {message.direction === 'outbound' || showEditAction || showDeleteAction || showReplyForwardActions ? (
                          <button
                            ref={(node) => {
                              if (node) {
                                messageActionTriggerRefs.current[message.id] = node;
                              } else {
                                delete messageActionTriggerRefs.current[message.id];
                              }
                            }}
                            type="button"
                            onClick={() => handleToggleMessageActionMenu(message.id)}
                            className={cx(
                              `${messageMetaActionsOrder} inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)]`,
                              openMessageActionMenuMessageId === message.id
                                ? 'bg-[var(--bg-hover)] opacity-100'
                                : 'opacity-0 pointer-events-none group-hover/message:opacity-100 group-hover/message:pointer-events-auto group-focus-within/message:opacity-100 group-focus-within/message:pointer-events-auto',
                            )}
                            aria-label="Mais acoes da mensagem"
                            aria-expanded={openMessageActionMenuMessageId === message.id}
                            title="Mais acoes"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition ${openMessageActionMenuMessageId === message.id ? 'rotate-180' : ''}`} />
                          </button>
                        ) : null}
                        {showReplyForwardActions ? (
                          <button
                            type="button"
                            onClick={() => void handleToggleStarMessage(message)}
                            disabled={starringMessageIds.has(message.id)}
                            aria-busy={starringMessageIds.has(message.id)}
                            className={cx(
                              'order-2 inline-flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] disabled:pointer-events-none disabled:opacity-60',
                              isMessageStarred(message)
                                ? 'text-[var(--accent-gold)]'
                                : 'text-[var(--text-secondary)] opacity-0 pointer-events-none group-hover/message:opacity-100 group-hover/message:pointer-events-auto group-focus-within/message:opacity-100 group-focus-within/message:pointer-events-auto',
                            )}
                            aria-label={isMessageStarred(message) ? 'Remover estrela da mensagem' : 'Estrelar mensagem'}
                            title={isMessageStarred(message) ? 'Remover estrela' : 'Estrelar mensagem'}
                          >
                            {starringMessageIds.has(message.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className={cx('h-3.5 w-3.5', isMessageStarred(message) ? 'fill-current' : '')} />}
                        </button>
                        ) : null}
                        {message.direction === 'outbound' && message.delivery_status === 'failed' && retryingMessageId !== message.id && (localOutgoingRetryPayloadRef.current.has(message.id) || Boolean(message.media_id)) ? (
                          <span className="order-4 inline-flex">
                            <RetryMediaButton loading={false} onRetry={() => setRetryPendingMessage(message)} />
                          </span>
                        ) : null}
                        {message.direction === 'outbound' && retryingMessageId === message.id && !mediaSending ? (
                          <span className="order-4 whatsapp-inbox-status-meta whatsapp-inbox-status-meta-pending inline-flex items-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Reenviando</span>
                          </span>
                        ) : null}
                      </div>
                    );

                    return (
                      <div key={item.key} className={`message-bubble-row group/message flex w-full ${getMessageRowClasses(message.direction)}`}>
                        <div
                          ref={(node) => {
                            if (node) {
                              reactionAnchorRefs.current[message.id] = node;
                              messageBubbleRefs.current[message.id] = node;
                            } else {
                              delete reactionAnchorRefs.current[message.id];
                              delete messageBubbleRefs.current[message.id];
                            }
                          }}
                          className="relative max-w-[80%]"
                        >
                          <div className="relative">
                            {message.direction !== 'system' && message.external_message_id ? (
                              <>
                                <button
                                  ref={(node) => {
                                    if (node) {
                                      reactionTriggerRefs.current[message.id] = node;
                                    } else {
                                      delete reactionTriggerRefs.current[message.id];
                                    }
                                  }}
                                  type="button"
                                  onClick={() => handleToggleReactionPicker(message.id)}
                                  className={`absolute top-1/2 z-[3] inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-sm transition ${message.direction === 'outbound' ? '-left-10' : '-right-10'} opacity-0 group-hover/message:opacity-100 hover:bg-[var(--bg-hover)] focus:opacity-100`}
                                  aria-label="Reagir à mensagem"
                                  title="Reagir"
                                >
                                  <Smile className="h-4 w-4" />
                                </button>

                              </>
                            ) : null}

                            {isGroupMessage && message.sender_name ? (
                              <p className="mb-1 px-1 text-xs font-semibold text-[var(--brand-primary)]">{message.sender_name}</p>
                            ) : null}
                            <div
                              className={cx(
                                isBubblelessMediaMessage(message)
                                  ? hasVisualMediaCaption(message)
                                    ? `${getVisualMediaBubbleWidth(message)} max-w-full rounded-[var(--kds-radius-lg)] p-0 shadow-sm ${getMessageBubbleClasses(message.direction)} whatsapp-inbox-media-caption-bubble`
                                    : 'whatsapp-inbox-media-message'
                                  : `rounded-[var(--kds-radius-lg)] px-4 py-3 shadow-sm ${getMessageBubbleClasses(message.direction)}`,
                                highlightedMessageId === message.id ? 'message-bubble-search-highlight' : null,
                              )}
                              onContextMenu={(event) => {
                                if (message.direction !== 'outbound' && !showEditAction && !showDeleteAction && !showReplyForwardActions) {
                                  return;
                                }

                                event.preventDefault();
                                handleOpenMessageActionMenuFromContext(message.id, { x: event.clientX, y: event.clientY });
                              }}
                            >
                              <WhatsAppMessageBody
                                message={message}
                                onOpenImage={setLightboxMessageId}
                                onOpenQuotedMessage={handleOpenQuotedMessage}
                                onTranscribe={(target) => void handleTranscribeMessage(target)}
                                onSelectInteractiveReply={handleSelectInteractiveReply}
                                onOpenSharedContactChat={(contact) => void handleOpenSharedContactChat(contact)}
                                onSaveSharedContact={(contact) => void handleSaveSharedContact(contact)}
                                sharedContactActionKey={sharedContactActionKey}
                                transcribing={transcribingMessageId === message.id}
                                mediaSending={mediaSending}
                                mediaSendingProgress={mediaSendingProgress}
                                onCancelMediaUpload={mediaUploadProgress?.attachmentId === message.id ? handleCancelMediaUpload : undefined}
                              />
                            </div>

                          </div>

                          {reactions.length > 0 ? (
                            <div className="relative mt-1 min-h-[28px]">
                              <div className={cx(
                                'absolute inset-y-0 z-[1] flex max-w-[90%] items-center',
                                message.direction === 'outbound' ? 'left-0' : 'right-0',
                              )}>
                                <div
                                  className="flex max-w-full flex-wrap gap-1"
                                  title={reactionTooltipText || undefined}
                                >
                                  {reactions.map((reaction) => (
                                    <span
                                      key={`${message.id}:${reaction.emoji}`}
                                      className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-md ${reaction.fromMe ? 'border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}
                                    >
                                      <span className="text-sm leading-none">{reaction.emoji}</span>
                                      {reaction.count > 1 ? <span>{reaction.count}</span> : null}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {messageMeta}
                            </div>
                          ) : messageMeta}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

  );
}
