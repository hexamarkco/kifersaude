import { useCallback, type Dispatch, type SetStateAction } from 'react';

import {
  whatsappContactsRepository,
  type CommWhatsAppLeadSearchResult,
} from '../data';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../domain/types';
import { collectPhoneLookupKeys } from '../domain/contactLookup';
import { toast } from '../../../../lib/toast';
import type { Lead } from '../../../leads';

type InboxChatCreationOptions = {
  chats: CommWhatsAppChat[];
  latestChatsRef: { current: CommWhatsAppChat[] };
  startingChatKey: string | null;
  manualStartPhone: string;
  setStartingChatKey: Dispatch<SetStateAction<string | null>>;
  setSharedContactActionKey: Dispatch<SetStateAction<string | null>>;
  setManualStartPhone: (value: string) => void;
  setSelectedChatId: (chatId: string) => void;
  setStartChatModalOpen: (isOpen: boolean) => void;
  setSearchDraft: (value: string) => void;
  setSearch: (value: string) => void;
  upsertChatLocally: (chat: CommWhatsAppChat) => void;
};

export const useInboxChatCreation = ({
  chats,
  latestChatsRef,
  startingChatKey,
  manualStartPhone,
  setStartingChatKey,
  setSharedContactActionKey,
  setManualStartPhone,
  setSelectedChatId,
  setStartChatModalOpen,
  setSearchDraft,
  setSearch,
  upsertChatLocally,
}: InboxChatCreationOptions) => {
  const handleStartChatFromSavedContact = useCallback(async (contact: CommWhatsAppPhoneContact) => {
    if (startingChatKey) {
      return;
    }

    if (!contact.phone_number) {
      toast.error('Este contato ainda não possui telefone confirmado.');
      return;
    }

    const actionKey = `saved:${contact.phone_digits}`;
    setStartingChatKey(actionKey);
    try {
      const result = await whatsappContactsRepository.startChat({
        source: 'saved_contact',
        phoneNumber: contact.phone_number,
        displayName: contact.display_name,
        contactId: contact.contact_id,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      toast.success('Conversa pronta para atendimento.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat por contato salvo', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa a partir do contato salvo.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  }, [setSearch, setSearchDraft, setSelectedChatId, setStartChatModalOpen, setStartingChatKey, startingChatKey, upsertChatLocally]);

  const handleStartChatFromLead = useCallback(async (lead: CommWhatsAppLeadSearchResult) => {
    if (startingChatKey) {
      return;
    }

    const actionKey = `crm:${lead.id}`;
    setStartingChatKey(actionKey);
    try {
      const result = await whatsappContactsRepository.startChat({
        source: 'crm',
        leadId: lead.id,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      toast.success('Conversa do lead aberta no inbox.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat por lead do CRM', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa a partir do lead do CRM.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  }, [setSearch, setSearchDraft, setSelectedChatId, setStartChatModalOpen, setStartingChatKey, startingChatKey, upsertChatLocally]);

  const handleStartChatFromManual = useCallback(async () => {
    if (startingChatKey) {
      return;
    }

    const actionKey = 'manual';
    setStartingChatKey(actionKey);
    try {
      const result = await whatsappContactsRepository.startChat({
        source: 'manual',
        phoneNumber: manualStartPhone,
      });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      setStartChatModalOpen(false);
      setManualStartPhone('');
      toast.success('Conversa aberta pelo número informado.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao iniciar chat manual', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a conversa pelo número informado.');
    } finally {
      setStartingChatKey((current) => (current === actionKey ? null : current));
    }
  }, [manualStartPhone, setManualStartPhone, setSearch, setSearchDraft, setSelectedChatId, setStartChatModalOpen, setStartingChatKey, startingChatKey, upsertChatLocally]);

  const handleOpenAgendaLeadChat = useCallback(async (lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone'>) => {
    if (startingChatKey) {
      return;
    }

    const phoneKeys = collectPhoneLookupKeys(lead.telefone);
    const localExistingChat = latestChatsRef.current.find((chat) => {
      if (lead.id && chat.lead_id === lead.id) {
        return true;
      }

      if (phoneKeys.length === 0) {
        return false;
      }

      const chatPhoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      return chatPhoneKeys.some((key) => phoneKeys.includes(key));
    }) ?? null;

    if (localExistingChat) {
      setSelectedChatId(localExistingChat.id);
      return;
    }

    if (!lead.id && !lead.telefone?.trim()) {
      toast.error('Não foi possível abrir uma conversa para este lead.');
      return;
    }

    const openingKey = `agenda:${lead.id || lead.telefone || 'lead'}`;
    setStartingChatKey(openingKey);

    try {
      const persistedExistingChat = await whatsappContactsRepository.findExistingChat({
        leadId: lead.id,
        phoneDigits: phoneKeys,
      });

      if (persistedExistingChat) {
        upsertChatLocally(persistedExistingChat);
        setSelectedChatId(persistedExistingChat.id);
        return;
      }

      const result = lead.id
        ? await whatsappContactsRepository.startChat({ source: 'crm', leadId: lead.id })
        : await whatsappContactsRepository.startChat({ source: 'manual', phoneNumber: lead.telefone ?? '' });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao abrir chat a partir da agenda', error);
      throw error;
    } finally {
      setStartingChatKey((current) => (current === openingKey ? null : current));
    }
  }, [latestChatsRef, setSearch, setSearchDraft, setSelectedChatId, setStartingChatKey, startingChatKey, upsertChatLocally]);

  const handleOpenSharedContactChat = useCallback(async (contact: { name: string | null; phoneNumber: string | null }) => {
    const phoneNumber = contact.phoneNumber?.trim() ?? '';
    if (!phoneNumber) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const phoneKeys = collectPhoneLookupKeys(phoneNumber);
    if (phoneKeys.length === 0) {
      toast.error('Este contato compartilhado não possui telefone válido.');
      return;
    }

    const actionKey = `open:${phoneNumber}`;
    setSharedContactActionKey(actionKey);

    try {
      const localExistingChat = chats.find((chat) => {
        const chatPhoneKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
        return chatPhoneKeys.some((key) => phoneKeys.includes(key));
      }) ?? null;

      if (localExistingChat) {
        setSelectedChatId(localExistingChat.id);
        return;
      }

      const persistedExistingChat = await whatsappContactsRepository.findExistingChat({ phoneDigits: phoneKeys });
      if (persistedExistingChat) {
        upsertChatLocally(persistedExistingChat);
        setSelectedChatId(persistedExistingChat.id);
        return;
      }

      const result = await whatsappContactsRepository.startChat({ source: 'manual', phoneNumber });

      setSearchDraft('');
      setSearch('');
      upsertChatLocally(result.chat);
      setSelectedChatId(result.chat.id);
      toast.success('Conversa aberta com o contato compartilhado.');
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao abrir contato compartilhado', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a conversa do contato compartilhado.');
    } finally {
      setSharedContactActionKey((current) => (current === actionKey ? null : current));
    }
  }, [chats, setSearch, setSearchDraft, setSelectedChatId, setSharedContactActionKey, upsertChatLocally]);

  return {
    handleStartChatFromSavedContact,
    handleStartChatFromLead,
    handleStartChatFromManual,
    handleOpenAgendaLeadChat,
    handleOpenSharedContactChat,
  };
};
