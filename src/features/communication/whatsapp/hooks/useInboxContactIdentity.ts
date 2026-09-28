import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { whatsappContactsRepository } from '../data';
import {
  addSavedContactsToNameMap,
  applyManualSavedContactNameToMaps,
  applySavedContactNameFromLookup,
  collectPhoneLookupKeys,
  resolveSavedContactName,
} from '../domain/contactLookup';
import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from '../domain/types';

const CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE = 30;
const CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

export const useInboxContactIdentity = ({
  chats,
  selectedChat,
  setChats,
}: {
  chats: CommWhatsAppChat[];
  selectedChat: CommWhatsAppChat | null;
  setChats: Dispatch<SetStateAction<CommWhatsAppChat[]>>;
}) => {
  const [savedContactNameRevision, setSavedContactNameRevision] = useState(0);
  const prefetchedLeadNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactNameByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactNameOverrideByPhoneRef = useRef<Map<string, string>>(new Map());
  const savedContactLookupInFlightKeysRef = useRef<Set<string>>(new Set());
  const savedContactLookupFailedAtByKeyRef = useRef<Map<string, number>>(new Map());
  const resolvedSavedContactPhoneKeysRef = useRef<Set<string>>(new Set());
  const lastSavedContactForceSyncAtRef = useRef(0);

  const applyPrefetchedLeadNames = useCallback((items: CommWhatsAppChat[]) => items.map((chat) => {
    const savedContactName = resolveSavedContactName(
      chat.phone_digits || chat.phone_number,
      chat.saved_contact_name,
      savedContactNameOverrideByPhoneRef.current,
      savedContactNameByPhoneRef.current,
    );
    if (savedContactName) {
      return applySavedContactNameFromLookup(
        chat,
        savedContactNameOverrideByPhoneRef.current,
        savedContactNameByPhoneRef.current,
      );
    }

    const matchedLeadName = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number)
      .map((key) => prefetchedLeadNameByPhoneRef.current.get(key) ?? null)
      .find((value): value is string => Boolean(value?.trim()));

    if (!matchedLeadName) {
      return chat;
    }

    return {
      ...chat,
      lead_name: chat.lead_name || matchedLeadName,
    };
  }), []);

  const applyFrontendSavedContactNames = useCallback((items: CommWhatsAppChat[]) => items.map((chat) => (
    applySavedContactNameFromLookup(
      chat,
      savedContactNameOverrideByPhoneRef.current,
      savedContactNameByPhoneRef.current,
    )
  )), []);

  const rememberManualSavedContactName = useCallback((phone: string | null | undefined, displayName: string) => {
    const result = applyManualSavedContactNameToMaps(
      phone,
      displayName,
      savedContactNameByPhoneRef.current,
      savedContactNameOverrideByPhoneRef.current,
    );

    if (result.phoneKeys.length === 0 || !displayName.trim()) {
      return;
    }

    result.phoneKeys.forEach((key) => {
      resolvedSavedContactPhoneKeysRef.current.add(key);
    });
    savedContactNameByPhoneRef.current = result.synchronizedNames;
    savedContactNameOverrideByPhoneRef.current = result.manualNames;
    setSavedContactNameRevision((current) => current + 1);
    setChats((current) => applyFrontendSavedContactNames(current));
  }, [applyFrontendSavedContactNames, setChats]);

  const synchronizeSavedContacts = useCallback((contacts: CommWhatsAppPhoneContact[]) => {
    const names = new Map(savedContactNameByPhoneRef.current);
    const manualOverrides = new Map(savedContactNameOverrideByPhoneRef.current);
    addSavedContactsToNameMap(names, contacts, manualOverrides);
    savedContactNameByPhoneRef.current = names;
    savedContactNameOverrideByPhoneRef.current = manualOverrides;
    setSavedContactNameRevision((current) => current + 1);
    setChats((current) => applyFrontendSavedContactNames(current));
  }, [applyFrontendSavedContactNames, setChats]);

  useEffect(() => {
    const now = Date.now();
    for (const [key, failedAt] of savedContactLookupFailedAtByKeyRef.current.entries()) {
      if (now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS) {
        savedContactLookupFailedAtByKeyRef.current.delete(key);
      }
    }

    const shouldAttemptLookupKey = (key: string) => {
      if (resolvedSavedContactPhoneKeysRef.current.has(key) || savedContactLookupInFlightKeysRef.current.has(key)) {
        return false;
      }

      const failedAt = savedContactLookupFailedAtByKeyRef.current.get(key);
      return !failedAt || now - failedAt >= CHAT_IDENTITY_LOOKUP_FAILURE_COOLDOWN_MS;
    };

    const selectedLookupKeys = selectedChat
      ? collectPhoneLookupKeys(selectedChat.phone_digits || selectedChat.phone_number)
      : [];
    const canForceSyncSelectedContact = selectedLookupKeys.length > 0
      && now - lastSavedContactForceSyncAtRef.current >= SAVED_CONTACT_FORCE_SYNC_COOLDOWN_MS;
    const forceSyncKeys = new Set(canForceSyncSelectedContact ? selectedLookupKeys : []);

    const targetChats = chats.filter((chat) => {
      const lookupKeys = collectPhoneLookupKeys(chat.phone_digits || chat.phone_number);
      const isSelectedChat = Boolean(selectedChat?.id && chat.id === selectedChat.id);

      return lookupKeys.length > 0 && (lookupKeys.some(shouldAttemptLookupKey) || (isSelectedChat && canForceSyncSelectedContact));
    }).slice(0, CHAT_IDENTITY_LOOKUP_MAX_CHATS_PER_CYCLE);

    if (targetChats.length === 0) {
      return;
    }

    const requestKeys = Array.from(
      new Set(targetChats.flatMap((chat) => collectPhoneLookupKeys(chat.phone_digits || chat.phone_number))),
    ).filter((key) => shouldAttemptLookupKey(key) || forceSyncKeys.has(key));
    const phoneNumbers = Array.from(
      new Set(targetChats.flatMap((chat) => [chat.phone_number, chat.phone_digits].filter(Boolean))),
    );

    if (requestKeys.length === 0 || phoneNumbers.length === 0) {
      return;
    }

    const forceSync = requestKeys.some((key) => forceSyncKeys.has(key));

    if (forceSync) {
      lastSavedContactForceSyncAtRef.current = now;
    }

    requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.add(key));
    // The list can change while lookup is in flight (polling, Realtime, or
    // lead-panel loading); apply the response against the latest chat state.
    void whatsappContactsRepository.lookupSavedByPhones({ phoneNumbers, forceSync }).then((contacts) => {
      const matchedKeys = new Set(contacts.flatMap((contact) => collectPhoneLookupKeys(contact.phone_digits || contact.phone_number)));
      const missedAt = Date.now();
      requestKeys.forEach((key) => {
        if (matchedKeys.has(key)) {
          resolvedSavedContactPhoneKeysRef.current.add(key);
          savedContactLookupFailedAtByKeyRef.current.delete(key);
        } else {
          savedContactLookupFailedAtByKeyRef.current.set(key, missedAt);
        }
      });

      if (contacts.length > 0) {
        const names = new Map(savedContactNameByPhoneRef.current);
        const manualOverrides = new Map(savedContactNameOverrideByPhoneRef.current);
        addSavedContactsToNameMap(names, contacts, manualOverrides);
        savedContactNameByPhoneRef.current = names;
        savedContactNameOverrideByPhoneRef.current = manualOverrides;
        setSavedContactNameRevision((current) => current + 1);
        setChats((current) => applyFrontendSavedContactNames(current));
      }
    }).catch((error) => {
      const failedAt = Date.now();
      requestKeys.forEach((key) => savedContactLookupFailedAtByKeyRef.current.set(key, failedAt));
      console.warn('[WhatsAppInbox] lookup de contatos salvos pausado temporariamente apos erro', error);
    }).finally(() => {
      requestKeys.forEach((key) => savedContactLookupInFlightKeysRef.current.delete(key));
    });
  }, [applyFrontendSavedContactNames, chats, selectedChat, setChats]);

  return {
    savedContactNameRevision,
    prefetchedLeadNameByPhoneRef,
    savedContactNameByPhoneRef,
    savedContactNameOverrideByPhoneRef,
    applyPrefetchedLeadNames,
    applyFrontendSavedContactNames,
    rememberManualSavedContactName,
    synchronizeSavedContacts,
  };
};
