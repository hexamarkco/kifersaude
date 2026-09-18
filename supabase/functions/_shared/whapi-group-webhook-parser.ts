import {
  normalizeWhapiChatId,
  normalizeWhapiParticipantId,
} from './comm-whatsapp/identity.ts';

export type WhapiGroupParticipant = {
  id: string;
  name: string;
  rank: 'creator' | 'admin' | 'member' | 'unknown';
  membershipStatus: 'member' | 'pending' | 'removed' | 'unknown';
  raw: Record<string, unknown>;
};

export type WhapiGroupSnapshot = {
  id: string;
  name: string;
  description: string;
  chatPic: string;
  chatPicFull: string;
  createdAt: string;
  nameAt: string;
  createdBy: string;
  adminAddMemberMode: boolean | null;
  participants: WhapiGroupParticipant[];
  raw: Record<string, unknown>;
};

export type WhapiGroupEventItem = {
  groupId: string;
  eventType: 'post' | 'put' | 'patch' | 'participants';
  action: string;
  snapshot: WhapiGroupSnapshot | null;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changes: string[];
  participantIds: string[];
  performedBy: string;
  receipt: Record<string, unknown>;
  raw: Record<string, unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecords = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const text = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const normalizeParticipantRank = (value: unknown): WhapiGroupParticipant['rank'] => {
  const rank = text(value).toLowerCase();
  if (rank === 'creator' || rank === 'superadmin' || rank === 'owner') return 'creator';
  if (rank === 'admin' || rank === 'administrator') return 'admin';
  if (rank === 'member') return 'member';
  return 'unknown';
};

const normalizeParticipant = (
  value: unknown,
  fallbackStatus: WhapiGroupParticipant['membershipStatus'] = 'member',
): WhapiGroupParticipant | null => {
  const raw = isRecord(value) ? value : { id: value };
  const id = normalizeWhapiParticipantId(raw.id ?? raw.user_id ?? raw.participant_id ?? raw.phone);
  if (!id) return null;

  const status = text(raw.status ?? raw.membership_status).toLowerCase();
  const membershipStatus: WhapiGroupParticipant['membershipStatus'] =
    status === 'pending' || status === 'removed' || status === 'member'
      ? status
      : fallbackStatus;

  return {
    id,
    name: text(raw.name ?? raw.display_name ?? raw.pushname ?? raw.push_name),
    rank: normalizeParticipantRank(raw.rank ?? raw.role ?? raw.type),
    membershipStatus,
    raw,
  };
};

export const normalizeWhapiGroupSnapshot = (value: unknown): WhapiGroupSnapshot | null => {
  if (!isRecord(value)) return null;
  const id = normalizeWhapiChatId(value.id ?? value.group_id ?? value.chat_id);
  if (!id || !/@g\.us$/i.test(id)) return null;

  const participants = asRecords(value.participants)
    .map((participant) => normalizeParticipant(participant))
    .filter((participant): participant is WhapiGroupParticipant => Boolean(participant));

  const settings = isRecord(value.settings) ? value.settings : {};
  const mode = value.adminAddMemberMode ?? settings.admin_add_member_only ?? value.admin_add_member_only;

  return {
    id,
    name: text(value.name ?? value.subject ?? value.chat_name) || 'Grupo',
    description: text(value.description),
    chatPic: text(value.chat_pic ?? value.picture),
    chatPicFull: text(value.chat_pic_full ?? value.picture_full),
    createdAt: text(value.created_at ?? value.creation_time),
    nameAt: text(value.name_at),
    createdBy: normalizeWhapiParticipantId(value.created_by ?? value.owner),
    adminAddMemberMode: typeof mode === 'boolean' ? mode : null,
    participants,
    raw: value,
  };
};

const extractPayloadArray = (payload: unknown, key: string): Array<Record<string, unknown>> => {
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload[key])) return asRecords(payload[key]);
  if (isRecord(payload.data) && Array.isArray(payload.data[key])) return asRecords(payload.data[key]);
  return [];
};

export const extractWhapiGroupEvents = (payload: unknown): WhapiGroupEventItem[] => {
  const result: WhapiGroupEventItem[] = [];

  for (const raw of extractPayloadArray(payload, 'groups')) {
    const snapshot = normalizeWhapiGroupSnapshot(raw);
    if (!snapshot) continue;
    result.push({
      groupId: snapshot.id,
      eventType: 'post',
      action: 'post',
      snapshot,
      before: {},
      after: raw,
      changes: [],
      participantIds: snapshot.participants.map((participant) => participant.id),
      performedBy: snapshot.createdBy,
      receipt: raw,
      raw,
    });
  }

  for (const raw of extractPayloadArray(payload, 'groups_participants')) {
    const groupId = normalizeWhapiChatId(raw.group_id ?? raw.chat_id);
    if (!/@g\.us$/i.test(groupId)) continue;
    const action = text(raw.action).toLowerCase() || 'update';
    const fallbackStatus = action === 'request' ? 'pending' : action === 'remove' ? 'removed' : 'member';
    const ids = (Array.isArray(raw.participants) ? raw.participants : [raw.participant_id])
      .map((participant) => normalizeParticipant(participant, fallbackStatus)?.id ?? normalizeWhapiChatId(participant))
      .filter(Boolean);
    result.push({
      groupId,
      eventType: 'participants',
      action,
      snapshot: null,
      before: {},
      after: raw,
      changes: [],
      participantIds: Array.from(new Set(ids)),
      performedBy: normalizeWhapiParticipantId(raw.performed_by ?? raw.actor ?? raw.from),
      receipt: raw,
      raw,
    });
  }

  for (const raw of extractPayloadArray(payload, 'groups_updates')) {
    const before = isRecord(raw.before_update) ? raw.before_update : {};
    const after = isRecord(raw.after_update) ? raw.after_update : {};
    const snapshot = normalizeWhapiGroupSnapshot(after) ?? normalizeWhapiGroupSnapshot(before);
    if (!snapshot) continue;
    const changes = Array.isArray(raw.changes) ? raw.changes.map(text).filter(Boolean) : [];
    result.push({
      groupId: snapshot.id,
      eventType: 'patch',
      action: text(raw.action) || 'patch',
      snapshot,
      before,
      after,
      changes,
      participantIds: snapshot.participants.map((participant) => participant.id),
      performedBy: normalizeWhapiParticipantId(raw.triggered_by ?? raw.performed_by ?? raw.trigger?.from),
      receipt: isRecord(raw.trigger) ? raw.trigger : raw,
      raw,
    });
  }

  return result;
};

const stableValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableValue).sort().join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableValue(value[key])}`).join('|')}}`;
  }
  return text(value) || String(value ?? '');
};

export const buildWhapiGroupEventReceiptKey = (event: WhapiGroupEventItem): string =>
  `group:${event.eventType}:${event.groupId}:${event.action}:${event.participantIds.slice().sort().join(',')}:${stableValue(event.changes)}:${text(event.receipt.id ?? event.receipt.timestamp) || stableValue(event.after)}`;
