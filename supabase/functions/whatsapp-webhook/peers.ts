import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

import {
  collectChatIdentifiers,
  normalizePeerChatIdentifier,
  normalizePeerLookupKey,
  normalizePeerPhoneDigits,
} from './phoneNumbers.ts';

type SupabaseTypedClient = SupabaseClient<any, any, any>;

type PeerRecord = {
  id: string;
  normalized_phone: string | null;
  normalized_chat_lid: string | null;
  raw_chat_lid: string | null;
  chat_lid_history: string[] | null;
};

export type PeerResolution = {
  peerId: string;
  canonicalPhone: string | null;
  normalizedChatLid: string | null;
  rawChatLid: string | null;
};

type EnsurePeerOptions = {
  supabase: SupabaseTypedClient;
  payload: any;
  normalizedPhone: string | null;
  normalizedTargetPhone: string | null;
  isGroupChat: boolean;
};

const WHATSAPP_CHAT_PEERS_TABLE = 'whatsapp_chat_peers';

function unique<T>(values: Iterable<T>): T[] {
  return Array.from(new Set(values));
}

function collectRawPhoneCandidates(payload: any): unknown[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const values: unknown[] = [
    payload?.phone,
    payload?.phoneNumber,
    payload?.senderPhone,
    payload?.participantPhone,
    payload?.contact?.phone,
    payload?.contact?.waid,
    payload?.contact?.jid,
    payload?.contact?.id,
    payload?.remotePhone,
    payload?.receiverPhone,
    payload?.recipientPhone,
    payload?.targetPhone,
    payload?.chatPhone,
    payload?.conversation?.phone,
    payload?.message?.phone,
    payload?.message?.participant,
    payload?.message?.chatId,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.key?.remoteJid,
    payload?.contextInfo?.remoteJid,
    payload?.contextInfo?.participant,
  ];

  if (payload?.fromMe) {
    values.push(payload?.from, payload?.message?.from);
  }

  return values;
}

async function loadPeersByIdentifiers(
  supabase: SupabaseTypedClient,
  phones: string[],
  chatLids: string[],
): Promise<PeerRecord[]> {
  const results: PeerRecord[] = [];

  if (phones.length > 0) {
    const { data, error } = await supabase
      .from(WHATSAPP_CHAT_PEERS_TABLE)
      .select('*')
      .in('normalized_phone', phones);

    if (error) {
      console.warn('Não foi possível carregar peers por telefone:', error);
    } else if (Array.isArray(data)) {
      results.push(...(data as PeerRecord[]));
    }
  }

  if (chatLids.length > 0) {
    const { data, error } = await supabase
      .from(WHATSAPP_CHAT_PEERS_TABLE)
      .select('*')
      .in('normalized_chat_lid', chatLids);

    if (error) {
      console.warn('Não foi possível carregar peers por chatLid:', error);
    } else if (Array.isArray(data)) {
      results.push(...(data as PeerRecord[]));
    }
  }

  return results;
}

function mergeChatLidHistory(existing: string[] | null | undefined, additions: Iterable<string>): string[] | null {
  const history = new Set<string>();

  if (Array.isArray(existing)) {
    existing
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .forEach((value) => history.add(value));
  }

  for (const addition of additions) {
    if (typeof addition === 'string' && addition.trim().length > 0) {
      history.add(addition.trim());
    }
  }

  return history.size > 0 ? Array.from(history) : null;
}

export async function ensurePeerAssociation(options: EnsurePeerOptions): Promise<PeerResolution | null> {
  const { supabase, payload, normalizedPhone, normalizedTargetPhone, isGroupChat } = options;

  if (isGroupChat) {
    return null;
  }

  const phoneCandidates = new Set<string>();
  const chatLidCandidates = new Map<string, string>();

  const addPhoneCandidate = (value: unknown) => {
    const normalized = normalizePeerPhoneDigits(value);
    if (normalized) {
      phoneCandidates.add(normalized);
    }
  };

  const addChatLidCandidate = (value: unknown) => {
    const normalized = normalizePeerChatIdentifier(value);
    if (normalized) {
      chatLidCandidates.set(normalized.normalized, normalized.raw);
      phoneCandidates.add(normalized.normalized);
    }
  };

  addPhoneCandidate(normalizedPhone);
  addPhoneCandidate(normalizedTargetPhone);

  const rawIdentifiers = collectChatIdentifiers(payload);
  rawIdentifiers.forEach((identifier) => addChatLidCandidate(identifier));

  const rawPhones = collectRawPhoneCandidates(payload);
  rawPhones.forEach((value) => {
    const normalized = normalizePeerLookupKey(value);
    if (!normalized) {
      return;
    }

    if (normalized.isGroup) {
      return;
    }

    if (chatLidCandidates.has(normalized.key)) {
      return;
    }

    addPhoneCandidate(value);
  });

  if (phoneCandidates.size === 0 && chatLidCandidates.size === 0) {
    return null;
  }

  const phoneList = unique(phoneCandidates);
  const chatLidList = unique(chatLidCandidates.keys());

  const peerRecords = await loadPeersByIdentifiers(supabase, phoneList, chatLidList);

  let primaryPeer: PeerRecord | null = peerRecords[0] ?? null;

  if (!primaryPeer) {
    const chatLidHistory = chatLidList.map((candidate) => chatLidCandidates.get(candidate) ?? candidate);
    const insertPayload: Record<string, unknown> = {
      normalized_phone: phoneList[0] ?? null,
      normalized_chat_lid: chatLidList[0] ?? null,
      raw_chat_lid: chatLidList.length > 0 ? chatLidCandidates.get(chatLidList[0]!) ?? chatLidList[0] : null,
      chat_lid_history: chatLidHistory.length > 0 ? chatLidHistory : null,
      is_group: false,
    };

    const { data, error } = await supabase
      .from(WHATSAPP_CHAT_PEERS_TABLE)
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      console.error('Erro ao criar peer do WhatsApp:', error);
      return null;
    }

    primaryPeer = data as PeerRecord;
  } else {
    const duplicates = peerRecords.filter((record) => record.id !== primaryPeer!.id);
    for (const duplicate of duplicates) {
      const { error: deleteError } = await supabase
        .from(WHATSAPP_CHAT_PEERS_TABLE)
        .delete()
        .eq('id', duplicate.id);

      if (deleteError) {
        console.warn('Não foi possível remover peer duplicado do WhatsApp:', deleteError);
      }
    }
  }

  if (!primaryPeer) {
    return null;
  }

  const updates: Record<string, unknown> = {};

  if (!primaryPeer.normalized_phone && phoneList.length > 0) {
    updates.normalized_phone = phoneList[0];
    primaryPeer.normalized_phone = phoneList[0];
  }

  if (!primaryPeer.normalized_chat_lid && chatLidList.length > 0) {
    updates.normalized_chat_lid = chatLidList[0];
    primaryPeer.normalized_chat_lid = chatLidList[0];
  }

  const rawChatLids = chatLidList.map((candidate) => chatLidCandidates.get(candidate) ?? candidate);
  const mergedHistory = mergeChatLidHistory(primaryPeer.chat_lid_history, rawChatLids);
  if (mergedHistory) {
    updates.chat_lid_history = mergedHistory;
    primaryPeer.chat_lid_history = mergedHistory;
  }

  if (!primaryPeer.raw_chat_lid && rawChatLids.length > 0) {
    updates.raw_chat_lid = rawChatLids[0];
    primaryPeer.raw_chat_lid = rawChatLids[0];
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(WHATSAPP_CHAT_PEERS_TABLE)
      .update(updates)
      .eq('id', primaryPeer.id)
      .select('*')
      .single();

    if (error) {
      console.warn('Não foi possível atualizar peer do WhatsApp:', error);
    } else if (data) {
      primaryPeer = data as PeerRecord;
    }
  }

  return {
    peerId: primaryPeer.id,
    canonicalPhone: primaryPeer.normalized_phone ?? phoneList[0] ?? null,
    normalizedChatLid: primaryPeer.normalized_chat_lid ?? chatLidList[0] ?? null,
    rawChatLid: primaryPeer.raw_chat_lid ?? rawChatLids[0] ?? null,
  };
}

