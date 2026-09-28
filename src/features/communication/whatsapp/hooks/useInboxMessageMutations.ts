import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { whatsappMessagesRepository } from '../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';
import {
  buildDeletedMessageSummary,
  getDeletedMessageMarker,
} from '../domain/messageMetadata';
import {
  canDeleteOutboundMessage,
  canEditOutboundMessage,
  getMessageEditableText,
} from '../domain/messagePresentation';
import { getMessageTimestampMs } from '../domain/messageTimeline';
import { KeyedActionLock } from '../components/keyedActionLock';
import { toast } from '../../../../lib/toast';

type InboxMessageMutationsOptions = {
  selectedChatId: string | null;
  patchMessageLocally: (messageId: string, patch: Partial<CommWhatsAppMessage>) => void;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
  closeMessageActionMenu: () => void;
};

export const useInboxMessageMutations = ({
  selectedChatId,
  patchMessageLocally,
  setChats,
  closeMessageActionMenu,
}: InboxMessageMutationsOptions) => {
  const [editingMessage, setEditingMessage] = useState<CommWhatsAppMessage | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [savingMessageEdit, setSavingMessageEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);
  const deletingMessageLockRef = useRef(new KeyedActionLock());
  const transcriptionMessageLockRef = useRef(new KeyedActionLock());
  const editingMessageLockRef = useRef(new KeyedActionLock());

  useEffect(() => {
    setEditingMessage(null);
    setEditingMessageDraft('');
  }, [selectedChatId]);

  const handleOpenEditMessageModal = useCallback((message: CommWhatsAppMessage) => {
    if (!canEditOutboundMessage(message)) {
      toast.error('Esta mensagem não pode ser editada no momento.');
      return;
    }

    setEditingMessage(message);
    setEditingMessageDraft(getMessageEditableText(message));
    closeMessageActionMenu();
  }, [closeMessageActionMenu]);

  const handleCloseEditMessageModal = useCallback(() => {
    setEditingMessage(null);
    setEditingMessageDraft('');
  }, []);

  const handleSaveEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    const targetMessage = editingMessage;
    if (!editingMessageLockRef.current.tryAcquire(targetMessage.id)) {
      return;
    }

    const nextText = editingMessageDraft.trim();
    if (!nextText) {
      editingMessageLockRef.current.release(targetMessage.id);
      toast.error('Digite o novo texto da mensagem.');
      return;
    }

    const previousText = getMessageEditableText(targetMessage);
    if (previousText === nextText) {
      editingMessageLockRef.current.release(targetMessage.id);
      handleCloseEditMessageModal();
      return;
    }

    setSavingMessageEdit(true);

    try {
      const result = await whatsappMessagesRepository.edit(targetMessage.id, nextText);
      const editedText = result.editedText || nextText;
      const editedAt = result.editedAt || new Date().toISOString();
      const metadata = targetMessage.metadata && typeof targetMessage.metadata === 'object' && !Array.isArray(targetMessage.metadata)
        ? targetMessage.metadata as Record<string, unknown>
        : {};
      const existingHistory = Array.isArray(metadata.edit_history) ? metadata.edit_history : [];
      const isMediaMessage = targetMessage.message_type.trim().toLowerCase() !== 'text';

      patchMessageLocally(targetMessage.id, {
        text_content: editedText,
        media_caption: isMediaMessage ? editedText : targetMessage.media_caption,
        status_updated_at: editedAt,
        metadata: {
          ...metadata,
          edited: true,
          edited_at: editedAt,
          original_text_content: String(metadata.original_text_content ?? '').trim() || previousText || null,
          edit_action_type: 'manual_edit',
          edit_history: [
            ...existingHistory,
            {
              at: editedAt,
              previous_text: previousText || null,
              next_text: editedText,
              action_type: 'manual_edit',
            },
          ].slice(-10),
        },
      });

      const editedMessageAt = getMessageTimestampMs(targetMessage.message_at);
      setChats((current) => current.map((chat) => (
        chat.id === targetMessage.chat_id
        && editedMessageAt !== null
        && getMessageTimestampMs(chat.last_message_at) === editedMessageAt
          ? { ...chat, last_message_text: editedText, updated_at: editedAt }
          : chat
      )));

      toast.success('Mensagem editada no WhatsApp.');
      handleCloseEditMessageModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao editar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível editar a mensagem no WhatsApp.');
    } finally {
      editingMessageLockRef.current.release(targetMessage.id);
      setSavingMessageEdit(false);
    }
  }, [editingMessage, editingMessageDraft, handleCloseEditMessageModal, patchMessageLocally, setChats]);

  const handleDeleteMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (!canDeleteOutboundMessage(message)) {
      toast.error('Esta mensagem não pode ser apagada no momento.');
      return;
    }

    if (!deletingMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setDeletingMessageId(message.id);

    try {
      const result = await whatsappMessagesRepository.delete(message.id);
      const deletedAt = result.deletedAt || new Date().toISOString();
      const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
        ? message.metadata as Record<string, unknown>
        : {};
      const preservedText = getMessageEditableText(message)
        || String(message.text_content ?? message.media_caption ?? '').trim()
        || getDeletedMessageMarker(message.message_type);

      patchMessageLocally(message.id, {
        delivery_status: 'deleted',
        status_updated_at: deletedAt,
        metadata: {
          ...metadata,
          deleted: true,
          deleted_at: deletedAt,
          deleted_action_type: 'manual_delete',
          deleted_by: 'self',
          deleted_original_text_content: String(metadata.deleted_original_text_content ?? '').trim() || preservedText,
        },
      });

      setChats((current) => current.map((chat) => chat.id === message.chat_id && chat.last_message_at === message.message_at
        ? { ...chat, last_message_text: buildDeletedMessageSummary(message.message_type, preservedText), updated_at: deletedAt }
        : chat));

      toast.success('Mensagem apagada no WhatsApp.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao apagar mensagem', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível apagar a mensagem no WhatsApp.');
    } finally {
      deletingMessageLockRef.current.release(message.id);
      setDeletingMessageId((current) => (current === message.id ? null : current));
    }
  }, [patchMessageLocally, setChats]);

  const handleTranscribeMessage = useCallback(async (message: CommWhatsAppMessage) => {
    if (!transcriptionMessageLockRef.current.tryAcquire(message.id)) {
      return;
    }

    setTranscribingMessageId(message.id);
    patchMessageLocally(message.id, {
      transcription_status: 'processing',
      transcription_error: null,
    });

    try {
      const result = await whatsappMessagesRepository.transcribe(message.id, {
        force: message.transcription_status === 'failed' || Boolean(message.transcription_text?.trim()),
      });

      patchMessageLocally(message.id, {
        transcription_text: result.transcription_text,
        transcription_status: result.transcription_status,
        transcription_provider: result.transcription_provider ?? null,
        transcription_model: result.transcription_model ?? null,
        transcription_error: null,
        transcription_updated_at: new Date().toISOString(),
      });
      toast.success('Transcrição concluída.');
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Não foi possível transcrever este áudio.';
      patchMessageLocally(message.id, {
        transcription_status: 'failed',
        transcription_error: messageText,
      });
      toast.error(messageText);
    } finally {
      transcriptionMessageLockRef.current.release(message.id);
      setTranscribingMessageId((current) => (current === message.id ? null : current));
    }
  }, [patchMessageLocally]);

  return {
    editingMessage,
    editingMessageDraft,
    setEditingMessageDraft,
    savingMessageEdit,
    deletingMessageId,
    transcribingMessageId,
    handleOpenEditMessageModal,
    handleCloseEditMessageModal,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleTranscribeMessage,
  };
};
