import { useMemo } from 'react';

import type { CommWhatsAppMessageSearchResult } from '../data';
import {
  applySavedContactNameFromLookup,
  applySavedContactNameToContact,
} from '../domain/contactLookup';
import {
  createChatFilterMatcher,
  type ChatActivityFilter,
} from '../domain/chatFilters';
import {
  getSafeChatDisplayName,
  mergeUniqueChats,
  rankChatsBySearch,
  sortChatsByInboxOrder,
} from '../domain/chatPresentation';
import { normalizeInboxSearch } from '../domain/messagePresentation';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../domain/types';

type UseInboxChatListModelParams = {
  chats: CommWhatsAppChat[];
  selectedChatId: string | null;
  selectedChat: CommWhatsAppChat | null;
  archivedSectionOpen: boolean;
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  search: string;
  chatSearchResults: CommWhatsAppChat[];
  messageSearchResults: CommWhatsAppMessageSearchResult[];
  connectedUserName: string | null;
  savedContacts: CommWhatsAppPhoneContact[];
  savedContactNameRevision: number;
  savedContactNameOverrides: ReadonlyMap<string, string>;
  synchronizedContactNames: ReadonlyMap<string, string>;
  forwardSearch: string;
};

export const useInboxChatListModel = ({
  chats,
  selectedChatId,
  selectedChat,
  archivedSectionOpen,
  activityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  search,
  chatSearchResults,
  messageSearchResults,
  connectedUserName,
  savedContacts,
  savedContactNameRevision,
  savedContactNameOverrides,
  synchronizedContactNames,
  forwardSearch,
}: UseInboxChatListModelParams) => {
  const chatMatchesActiveFilters = useMemo(
    () => createChatFilterMatcher({
      activityFilter,
      leadStatusFilters,
      leadResponsavelFilters,
    }),
    [activityFilter, leadStatusFilters, leadResponsavelFilters],
  );

  const scopedChats = useMemo(() => {
    const matchesCurrentSection = (chat: CommWhatsAppChat) => (archivedSectionOpen ? chat.is_archived : !chat.is_archived);
    const filtered = chats.filter((chat) => matchesCurrentSection(chat) && chatMatchesActiveFilters(chat));
    const selected = selectedChatId ? chats.find((chat) => chat.id === selectedChatId) ?? null : null;

    // Keep the selected chat visible when its archive state still matches the
    // current section; state transitions choose the next valid selection.
    if (selected && matchesCurrentSection(selected) && !filtered.some((chat) => chat.id === selected.id)) {
      return sortChatsByInboxOrder([...filtered, selected]);
    }

    return sortChatsByInboxOrder(filtered);
  }, [archivedSectionOpen, chatMatchesActiveFilters, chats, selectedChatId]);

  const savedContactLookupMaps = useMemo(
    () => ({
      localOverrides: savedContactNameOverrides,
      synchronizedNames: synchronizedContactNames,
      revision: savedContactNameRevision,
    }),
    [savedContactNameOverrides, savedContactNameRevision, synchronizedContactNames],
  );

  const localChatSearchResults = useMemo(
    () => (search ? rankChatsBySearch(
      chats.map((chat) => applySavedContactNameFromLookup(
        chat,
        savedContactLookupMaps.localOverrides,
        savedContactLookupMaps.synchronizedNames,
      )).filter(chatMatchesActiveFilters),
      search,
      connectedUserName,
    ) : []),
    [chatMatchesActiveFilters, chats, connectedUserName, savedContactLookupMaps, search],
  );

  const savedContactsForPresentation = useMemo(
    () => savedContacts.map((contact) => applySavedContactNameToContact(
      contact,
      savedContactLookupMaps.localOverrides,
      savedContactLookupMaps.synchronizedNames,
    )),
    [savedContactLookupMaps, savedContacts],
  );

  const remoteChatSearchResults = useMemo(
    () => (search
      ? rankChatsBySearch(
          chatSearchResults
            .map((chat) => applySavedContactNameFromLookup(
              chat,
              savedContactLookupMaps.localOverrides,
              savedContactLookupMaps.synchronizedNames,
            ))
            .filter(chatMatchesActiveFilters),
          search,
          connectedUserName,
        )
      : []),
    [chatMatchesActiveFilters, chatSearchResults, connectedUserName, savedContactLookupMaps, search],
  );

  const filteredMessageSearchResults = useMemo(
    () => messageSearchResults
      .map((result) => ({
        ...result,
        chat: applySavedContactNameFromLookup(
          result.chat,
          savedContactLookupMaps.localOverrides,
          savedContactLookupMaps.synchronizedNames,
        ),
      }))
      .filter((result) => chatMatchesActiveFilters(result.chat)),
    [chatMatchesActiveFilters, messageSearchResults, savedContactLookupMaps],
  );

  const sidebarChats = useMemo(() => {
    const candidates = search ? mergeUniqueChats(localChatSearchResults, remoteChatSearchResults) : scopedChats;
    return candidates.map((chat) => applySavedContactNameFromLookup(
      chat,
      savedContactLookupMaps.localOverrides,
      savedContactLookupMaps.synchronizedNames,
    ));
  }, [localChatSearchResults, remoteChatSearchResults, savedContactLookupMaps, scopedChats, search]);

  const selectedChatForPresentation = useMemo(
    () => selectedChat
      ? applySavedContactNameFromLookup(
          selectedChat,
          savedContactLookupMaps.localOverrides,
          savedContactLookupMaps.synchronizedNames,
        )
      : null,
    [savedContactLookupMaps, selectedChat],
  );

  const forwardTargetChats = useMemo(() => {
    const normalizedSearch = normalizeInboxSearch(forwardSearch);
    const candidates = chats
      .filter((chat) => chat.external_chat_id?.trim())
      .map((chat) => applySavedContactNameFromLookup(
        chat,
        savedContactLookupMaps.localOverrides,
        savedContactLookupMaps.synchronizedNames,
      ));
    const filtered = normalizedSearch
      ? candidates.filter((chat) => normalizeInboxSearch(`${chat.display_name} ${chat.saved_contact_name ?? ''} ${chat.phone_number}`).includes(normalizedSearch))
      : candidates;

    return sortChatsByInboxOrder(filtered).slice(0, 30);
  }, [chats, forwardSearch, savedContactLookupMaps]);

  const selectedChatTranscriptLabel = useMemo(() => {
    if (!selectedChatForPresentation) {
      return 'Contato';
    }

    // Keep the header tied to the conversation identity while lead data loads.
    return getSafeChatDisplayName(selectedChatForPresentation, connectedUserName)
      || selectedChatForPresentation.phone_number?.trim()
      || 'Contato';
  }, [connectedUserName, selectedChatForPresentation]);

  return {
    chatMatchesActiveFilters,
    savedContactsForPresentation,
    filteredMessageSearchResults,
    sidebarChats,
    selectedChatForPresentation,
    forwardTargetChats,
    selectedChatTranscriptLabel,
  };
};
