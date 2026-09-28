import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';

import { applyTemplateVariables } from '../../../../lib/autoContactService';
import type { CommWhatsAppLeadPanel } from '../data';
import type { WhatsAppQuickReply } from '../domain/quickReplies';
import {
  buildQuickReplyShortcut,
  getActiveQuickReplyMatch,
  normalizeQuickReplyLookup,
  summarizeQuickReplyPreview,
} from '../domain/quickReplies';
import { getSafeChatDisplayName } from '../domain/chatPresentation';
import type { CommWhatsAppChat } from '../domain/types';
import type { Lead } from '../../../leads';

export type InboxQuickReplyOption = {
  id: string;
  name: string;
  shortcut: string;
  text: string;
  preview: string;
  searchValue: string;
};

type ComposerSelection = { start: number; end: number };

type InboxQuickReplyComposerOptions = {
  quickReplies: WhatsAppQuickReply[];
  quickRepliesLoadError: boolean;
  selectedChat: CommWhatsAppChat | null;
  selectedChatForPresentation: CommWhatsAppChat | null;
  leadPanel: CommWhatsAppLeadPanel | null;
  connectedUserName: string | null;
  messageDraft: string;
  composerSelection: ComposerSelection;
  composerFocused: boolean;
  setQuickReplyActiveIndex: Dispatch<SetStateAction<number>>;
  dismissedQuickReplyKey: string | null;
  setDismissedQuickReplyKey: Dispatch<SetStateAction<string | null>>;
};

export const useInboxQuickReplyComposer = ({
  quickReplies,
  quickRepliesLoadError,
  selectedChat,
  selectedChatForPresentation,
  leadPanel,
  connectedUserName,
  messageDraft,
  composerSelection,
  composerFocused,
  setQuickReplyActiveIndex,
  dismissedQuickReplyKey,
  setDismissedQuickReplyKey,
}: InboxQuickReplyComposerOptions) => {
  const quickReplyLead = useMemo<Lead | null>(() => {
    if (!selectedChat) {
      return null;
    }

    const timestamp = new Date().toISOString();
    return {
      id: leadPanel?.id ?? selectedChat.lead_id ?? selectedChat.id,
      nome_completo: getSafeChatDisplayName(selectedChatForPresentation, connectedUserName),
      telefone: leadPanel?.telefone || selectedChat.phone_number || '',
      email: '',
      cidade: '',
      origem: null,
      status: leadPanel?.status_value ?? selectedChat.lead_status ?? null,
      responsavel: leadPanel?.responsavel_value ?? null,
      data_criacao: timestamp,
      arquivado: false,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }, [connectedUserName, leadPanel, selectedChat, selectedChatForPresentation]);

  const resolveComposerVariables = useCallback((value: string) => (
    quickReplyLead ? applyTemplateVariables(value, quickReplyLead) : value
  ), [quickReplyLead]);

  const quickReplyOptions = useMemo(() => {
    const usedShortcuts = new Set<string>();

    return quickReplies
      .map((quickReply, index) => {
        const name = quickReply.name?.trim() || `Mensagem rapida ${index + 1}`;
        const rawText = quickReply.text.trim();
        const text = resolveComposerVariables(rawText).trim();

        if (!text) {
          return null;
        }

        const baseShortcut = buildQuickReplyShortcut(quickReply.shortcut || name, index);
        let shortcut = baseShortcut;
        let duplicateIndex = 2;

        while (usedShortcuts.has(shortcut)) {
          shortcut = `${baseShortcut}-${duplicateIndex}`;
          duplicateIndex += 1;
        }

        usedShortcuts.add(shortcut);

        return {
          id: quickReply.id,
          name,
          shortcut,
          text,
          preview: summarizeQuickReplyPreview(text),
          searchValue: normalizeQuickReplyLookup(`${shortcut} ${name} ${text}`),
        } satisfies InboxQuickReplyOption;
      })
      .filter((option): option is InboxQuickReplyOption => option !== null);
  }, [quickReplies, resolveComposerVariables]);

  const activeQuickReplyMatch = useMemo(
    () => getActiveQuickReplyMatch(messageDraft, composerSelection),
    [composerSelection, messageDraft],
  );
  const activeQuickReplyKey = activeQuickReplyMatch
    ? `${activeQuickReplyMatch.start}:${activeQuickReplyMatch.query}`
    : null;
  const filteredQuickReplyOptions = useMemo(() => {
    if (!activeQuickReplyMatch) {
      return [];
    }

    const query = normalizeQuickReplyLookup(activeQuickReplyMatch.query);

    return quickReplyOptions
      .map((option, index) => {
        if (query && !option.searchValue.includes(query)) {
          return null;
        }

        const normalizedName = normalizeQuickReplyLookup(option.name);
        const rank = query.length === 0
          ? 0
          : option.shortcut.startsWith(query)
            ? 0
            : normalizedName.startsWith(query)
              ? 1
              : 2;

        return { option, rank, index };
      })
      .filter((item): item is { option: InboxQuickReplyOption; rank: number; index: number } => item !== null)
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }

        return a.index - b.index;
      })
      .map((item) => item.option);
  }, [activeQuickReplyMatch, quickReplyOptions]);
  const quickReplyMenuHasResults = filteredQuickReplyOptions.length > 0;
  const quickReplyMenuOpen = composerFocused
    && activeQuickReplyMatch !== null
    && activeQuickReplyKey !== dismissedQuickReplyKey;
  const quickReplyEmptyStateMessage = quickRepliesLoadError
    ? 'Não foi possível carregar as mensagens rápidas.'
    : quickReplyOptions.length === 0
      ? 'Nenhuma mensagem rapida cadastrada ainda.'
      : 'Nenhum atalho encontrado para esse termo.';

  useEffect(() => {
    if (!quickReplyMenuOpen || !quickReplyMenuHasResults) {
      setQuickReplyActiveIndex(0);
      return;
    }

    setQuickReplyActiveIndex((current) => Math.min(current, filteredQuickReplyOptions.length - 1));
  }, [filteredQuickReplyOptions.length, quickReplyMenuHasResults, quickReplyMenuOpen, setQuickReplyActiveIndex]);

  useEffect(() => {
    if (!activeQuickReplyKey) {
      setDismissedQuickReplyKey(null);
      return;
    }

    if (dismissedQuickReplyKey && dismissedQuickReplyKey !== activeQuickReplyKey) {
      setDismissedQuickReplyKey(null);
    }
  }, [activeQuickReplyKey, dismissedQuickReplyKey, setDismissedQuickReplyKey]);

  return {
    resolveComposerVariables,
    activeQuickReplyMatch,
    activeQuickReplyKey,
    filteredQuickReplyOptions,
    quickReplyMenuHasResults,
    quickReplyMenuOpen,
    quickReplyEmptyStateMessage,
  };
};
