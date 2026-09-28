import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import type { CommWhatsAppMessage } from '../domain/types';
import { getOwnReactionEmoji } from '../domain/messageMetadata';
import { KeyedActionLock } from '../components/keyedActionLock';
import { toast } from '../../../../lib/toast';

type MessageReactionActionsOptions = {
  selectedChatExternalId: string | null | undefined;
  patchMessageLocally: (messageId: string, patch: Partial<CommWhatsAppMessage>) => void;
  setOpenReactionPickerMessageId: Dispatch<SetStateAction<string | null>>;
  setOpenMessageActionMenuMessageId: Dispatch<SetStateAction<string | null>>;
};

export const useInboxMessageReactionActions = ({
  selectedChatExternalId,
  patchMessageLocally,
  setOpenReactionPickerMessageId,
  setOpenMessageActionMenuMessageId,
}: MessageReactionActionsOptions) => {
  const [reactingMessageIds, setReactingMessageIds] = useState<Set<string>>(new Set());
  const reactingMessageLockRef = useRef(new KeyedActionLock());
  const [starringMessageIds, setStarringMessageIds] = useState<Set<string>>(new Set());
  const starringMessageLockRef = useRef(new KeyedActionLock());

  const patchMessageReactionLocally = useCallback((message: CommWhatsAppMessage, emoji: string | null) => {
    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown>
      : {};
    const reactions = Array.isArray(metadata.reactions)
      ? metadata.reactions.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
      : [];
    const withoutOwnReaction = reactions.filter((item) => (
      String(item.actor_key ?? '').trim() !== 'self' && item.from_me !== true
    ));
    const nextReactions = emoji
      ? [
          ...withoutOwnReaction,
          {
            actor_key: 'self',
            emoji,
            from_me: true,
            from: null,
            from_name: 'Você',
            reacted_at: new Date().toISOString(),
            target_external_message_id: message.external_message_id ?? null,
          },
        ]
      : withoutOwnReaction;

    patchMessageLocally(message.id, {
      metadata: {
        ...metadata,
        reactions: nextReactions,
        last_reaction_at: new Date().toISOString(),
      },
    });
  }, [patchMessageLocally]);

  const handleToggleReactionPicker = useCallback((messageId: string) => {
    setOpenMessageActionMenuMessageId(null);
    setOpenReactionPickerMessageId((current) => (current === messageId ? null : messageId));
  }, [setOpenMessageActionMenuMessageId, setOpenReactionPickerMessageId]);

  const handleReactToMessage = useCallback(async (message: CommWhatsAppMessage, emoji: string) => {
    if (!message.external_message_id || !reactingMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setReactingMessageIds((current) => new Set(current).add(message.id));

    const chatId = String(message.metadata?.chat_id ?? selectedChatExternalId ?? '').trim();
    if (!chatId) {
      reactingMessageLockRef.current.release(message.id);
      setReactingMessageIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
      toast.error('Não foi possível identificar a conversa desta mensagem.');
      return;
    }

    const currentOwnReaction = getOwnReactionEmoji(message);
    const nextEmoji = currentOwnReaction === emoji ? null : emoji;

    setOpenReactionPickerMessageId(null);
    patchMessageReactionLocally(message, nextEmoji);

    try {
      await whatsappMessagesRepository.react({
        chatId,
        messageId: message.external_message_id,
        emoji: nextEmoji,
      });
    } catch (error) {
      patchMessageReactionLocally(message, currentOwnReaction);
      console.error('[WhatsAppInbox] erro ao reagir à mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reagir à mensagem.');
    } finally {
      reactingMessageLockRef.current.release(message.id);
      setReactingMessageIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }, [patchMessageReactionLocally, selectedChatExternalId, setOpenReactionPickerMessageId]);

  const handleToggleStarMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (!message.external_message_id || !starringMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setStarringMessageIds((current) => new Set(current).add(message.id));

    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown>
      : {};
    const currentStarred = metadata.starred === true;
    const nextStarred = !currentStarred;

    patchMessageLocally(message.id, {
      metadata: {
        ...metadata,
        starred: nextStarred,
        starred_at: new Date().toISOString(),
      },
    });

    try {
      await whatsappMessagesRepository.star(message.id, nextStarred);
    } catch (error) {
      patchMessageLocally(message.id, {
        metadata: {
          ...metadata,
          starred: currentStarred,
          starred_at: metadata.starred_at,
        },
      });
      console.error('[WhatsAppInbox] erro ao atualizar estrela da mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a estrela da mensagem.');
    } finally {
      starringMessageLockRef.current.release(message.id);
      setStarringMessageIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  }, [patchMessageLocally]);

  return {
    reactingMessageIds,
    starringMessageIds,
    handleToggleReactionPicker,
    handleReactToMessage,
    handleToggleStarMessage,
  };
};
