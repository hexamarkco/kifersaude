import assert from 'node:assert/strict';

import { ensurePeerAssociation } from '../peers.ts';

type MockPeerRecord = {
  id: string;
  normalized_phone: string | null;
  normalized_chat_lid: string | null;
  raw_chat_lid: string | null;
  chat_lid_history: string[] | null;
};

class MockSupabaseClient {
  private peers: MockPeerRecord[];
  private nextId: number;
  private updateLog: Array<{ id: string; updates: Record<string, unknown> }>;

  constructor(initialPeers: Array<Partial<MockPeerRecord>>) {
    this.peers = initialPeers.map((peer, index) => ({
      id: peer?.id ?? `peer-${index + 1}`,
      normalized_phone: peer?.normalized_phone ?? null,
      normalized_chat_lid: peer?.normalized_chat_lid ?? null,
      raw_chat_lid: peer?.raw_chat_lid ?? null,
      chat_lid_history: peer?.chat_lid_history ? [...peer.chat_lid_history] : null,
    }));
    this.nextId = this.peers.length + 1;
    this.updateLog = [];
  }

  from(table: string) {
    if (table !== 'whatsapp_chat_peers') {
      throw new Error(`Unsupported table: ${table}`);
    }

    return {
      select: () => ({
        in: async (column: string, values: string[]) => {
          const data = this.peers.filter((peer) => {
            const value = (peer as Record<string, unknown>)[column];
            if (typeof value !== 'string') {
              return false;
            }
            return values.includes(value);
          });

          return { data, error: null };
        },
      }),
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const historyValue = payload.chat_lid_history;
            const record: MockPeerRecord = {
              id: `peer-${this.nextId++}`,
              normalized_phone: (payload.normalized_phone ?? null) as string | null,
              normalized_chat_lid: (payload.normalized_chat_lid ?? null) as string | null,
              raw_chat_lid: (payload.raw_chat_lid ?? null) as string | null,
              chat_lid_history: Array.isArray(historyValue)
                ? [...historyValue]
                : historyValue === null || historyValue === undefined
                  ? null
                  : [historyValue as string],
            };

            this.peers.push(record);

            return { data: record, error: null };
          },
        }),
      }),
      update: (updates: Record<string, unknown>) => ({
        eq: (column: string, value: string) => ({
          select: () => ({
            single: async () => {
              const record = this.peers.find((peer) => (peer as Record<string, unknown>)[column] === value);
              if (!record) {
                return { data: null, error: new Error('Record not found') };
              }

              Object.assign(record, updates);
              this.updateLog.push({ id: record.id, updates: { ...updates } });

              return { data: record, error: null };
            },
          }),
        }),
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          const index = this.peers.findIndex((peer) => (peer as Record<string, unknown>)[column] === value);
          if (index >= 0) {
            this.peers.splice(index, 1);
          }

          return { error: null };
        },
      }),
    };
  }

  snapshot() {
    return this.peers.map((peer) => ({ ...peer, chat_lid_history: peer.chat_lid_history ? [...peer.chat_lid_history] : null }));
  }

  updates() {
    return this.updateLog.map((entry) => ({ id: entry.id, updates: { ...entry.updates } }));
  }
}

const outgoingSupabase = new MockSupabaseClient([]);
await ensurePeerAssociation({
  supabase: outgoingSupabase as unknown as any,
  payload: {
    fromMe: true,
    chatLid: '5511987654321@lid',
    phone: '5511987654321@lid',
    message: {
      chatLid: '5511987654321@lid',
    },
  },
  normalizedPhone: '5511987654321@lid',
  normalizedTargetPhone: '5511987654321@lid',
  isGroupChat: false,
  messageDirection: 'sent',
});

const outgoingSnapshot = outgoingSupabase.snapshot();
assert.equal(outgoingSnapshot.length, 1);
assert.equal(outgoingSnapshot[0]?.normalized_phone, null);
assert.equal(outgoingSnapshot[0]?.normalized_chat_lid, '5511987654321');
assert.equal(outgoingSnapshot[0]?.raw_chat_lid, '5511987654321@lid');

const incomingSupabase = new MockSupabaseClient([
  {
    id: 'peer-1',
    normalized_phone: null,
    normalized_chat_lid: '5511977776666',
    raw_chat_lid: '5511977776666@lid',
    chat_lid_history: ['5511977776666@lid'],
  },
]);

const incomingResolution = await ensurePeerAssociation({
  supabase: incomingSupabase as unknown as any,
  payload: {
    chatLid: '5511977776666@lid',
    phone: '5511977776666',
    message: {
      chatLid: '5511977776666@lid',
      participant: '5511977776666',
    },
  },
  normalizedPhone: '5511977776666',
  normalizedTargetPhone: null,
  isGroupChat: false,
  messageDirection: 'received',
});

assert.equal(incomingResolution?.canonicalPhone, '5511977776666');
const incomingSnapshot = incomingSupabase.snapshot();
assert.equal(incomingSnapshot[0]?.normalized_phone, '5511977776666');
assert(
  incomingSupabase
    .updates()
    .some((entry) => Object.prototype.hasOwnProperty.call(entry.updates, 'normalized_phone')),
);

const cleanupSupabase = new MockSupabaseClient([
  {
    id: 'peer-1',
    normalized_phone: '5511977776666@lid',
    normalized_chat_lid: '5511977776666',
    raw_chat_lid: '5511977776666@lid',
    chat_lid_history: ['5511977776666@lid'],
  },
]);

await ensurePeerAssociation({
  supabase: cleanupSupabase as unknown as any,
  payload: {
    chatLid: '5511977776666@lid',
    phone: '5511977776666',
  },
  normalizedPhone: '5511977776666',
  normalizedTargetPhone: null,
  isGroupChat: false,
  messageDirection: 'received',
});

const cleanupSnapshot = cleanupSupabase.snapshot();
assert.equal(cleanupSnapshot[0]?.normalized_phone, '5511977776666');
assert(
  cleanupSupabase
    .updates()
    .some((entry) => Object.prototype.hasOwnProperty.call(entry.updates, 'normalized_phone')),
);

const stableSupabase = new MockSupabaseClient([
  {
    id: 'peer-1',
    normalized_phone: '5511977776666',
    normalized_chat_lid: '5511977776666',
    raw_chat_lid: '5511977776666@lid',
    chat_lid_history: ['5511977776666@lid'],
  },
]);

await ensurePeerAssociation({
  supabase: stableSupabase as unknown as any,
  payload: {
    chatLid: '5511977776666@lid',
    phone: '5511977776666',
  },
  normalizedPhone: '5511977776666',
  normalizedTargetPhone: null,
  isGroupChat: false,
  messageDirection: 'received',
});

const stableSnapshot = stableSupabase.snapshot();
assert.equal(stableSnapshot[0]?.normalized_phone, '5511977776666');
assert(
  stableSupabase
    .updates()
    .every((entry) => !Object.prototype.hasOwnProperty.call(entry.updates, 'normalized_phone')),
);

console.log('whatsapp webhook peers tests passed');
