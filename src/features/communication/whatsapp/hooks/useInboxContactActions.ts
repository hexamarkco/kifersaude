import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import { whatsappContactsRepository } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { KeyedActionLock } from '../components/keyedActionLock';
import { toast } from '../../../../lib/toast';

type RefreshStartChatSources = (query: string, page?: number, appendSavedContacts?: boolean) => Promise<void>;

type InboxContactActionsOptions = {
  selectedChat: CommWhatsAppChat | null;
  selectedChatForPresentation: CommWhatsAppChat | null;
  saveContactName: string;
  setSavingContact: Dispatch<SetStateAction<boolean>>;
  setSaveContactDialogOpen: Dispatch<SetStateAction<boolean>>;
  setSharedContactActionKey: Dispatch<SetStateAction<string | null>>;
  startChatQuery: string;
  refreshStartChatSources: RefreshStartChatSources;
  rememberManualSavedContactName: (phone: string | null | undefined, displayName: string) => void;
  loadChats: () => Promise<unknown> | void;
};

export const useInboxContactActions = ({
  selectedChat,
  selectedChatForPresentation,
  saveContactName,
  setSavingContact,
  setSaveContactDialogOpen,
  setSharedContactActionKey,
  startChatQuery,
  refreshStartChatSources,
  rememberManualSavedContactName,
  loadChats,
}: InboxContactActionsOptions) => {
  const contactSaveLockRef = useRef(new KeyedActionLock());

  const handleSaveSharedContact = useCallback(async (contact: { name: string | null; phoneNumber: string | null }) => {
    const displayName = contact.name?.trim() ?? '';
    const phoneNumber = contact.phoneNumber?.trim() ?? '';

    if (!displayName) {
      toast.error('O contato compartilhado precisa de um nome para ser salvo.');
      return;
    }

    if (!phoneNumber) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const actionKey = `save:${phoneNumber}`;
    setSharedContactActionKey(actionKey);

    try {
      await whatsappContactsRepository.save({ phoneNumber, displayName });

      rememberManualSavedContactName(phoneNumber, displayName);
      void refreshStartChatSources(startChatQuery, 1, false);
      void loadChats();
      toast.success('Contato salvo com sucesso.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar contato compartilhado', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato compartilhado.');
    } finally {
      setSharedContactActionKey((current) => (current === actionKey ? null : current));
    }
  }, [loadChats, refreshStartChatSources, rememberManualSavedContactName, setSharedContactActionKey, startChatQuery]);

  const handleSaveContactToPhonebook = useCallback(async () => {
    const name = saveContactName.trim();
    if (!name) {
      toast.error('Informe um nome para salvar o contato.');
      return;
    }
    if (!selectedChat) return;

    const targetChat = selectedChatForPresentation ?? selectedChat;
    if (!contactSaveLockRef.current.tryAcquire(targetChat.id)) {
      return;
    }

    const isRenaming = Boolean(targetChat.saved_contact_name?.trim());

    setSavingContact(true);
    try {
      if (isRenaming) {
        await whatsappContactsRepository.rename({
          phoneNumber: targetChat.phone_number,
          displayName: name,
        });
        toast.success('Contato renomeado com sucesso.');
      } else {
        await whatsappContactsRepository.save({
          phoneNumber: targetChat.phone_number,
          displayName: name,
        });
        toast.success('Contato salvo com sucesso.');
      }
      rememberManualSavedContactName(targetChat.phone_digits || targetChat.phone_number, name);
      setSaveContactDialogOpen(false);
      void refreshStartChatSources(startChatQuery, 1, false);
      void loadChats();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao salvar contato', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o contato.');
    } finally {
      contactSaveLockRef.current.release(targetChat.id);
      setSavingContact(false);
    }
  }, [loadChats, refreshStartChatSources, rememberManualSavedContactName, saveContactName, selectedChat, selectedChatForPresentation, setSaveContactDialogOpen, setSavingContact, startChatQuery]);

  return { handleSaveSharedContact, handleSaveContactToPhonebook };
};
