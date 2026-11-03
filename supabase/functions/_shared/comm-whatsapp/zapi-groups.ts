import type { WhapiGroupSnapshot } from '../whapi-group-webhook-parser.ts';
import { zapiDestination, zapiPhone, zapiRecord, zapiString } from './zapi.ts';

export function normalizeZapiGroup(value: unknown, externalGroupId: string): WhapiGroupSnapshot | null {
  const group = zapiRecord(value);
  const providerGroupId = zapiDestination(externalGroupId);
  if (!providerGroupId.endsWith('-group') || group.phone !== providerGroupId) return null;
  const participants = Array.isArray(group.participants) ? group.participants.map(zapiRecord) : [];
  const verified = participants.every((participant) => Boolean(zapiPhone(participant.phone)));
  return {
    id: externalGroupId,
    name: zapiString(group.subject),
    description: zapiString(group.description),
    chatPic: '',
    chatPicFull: '',
    createdAt: typeof group.creation === 'number' ? String(group.creation) : '',
    nameAt: typeof group.subjectTime === 'number' ? String(group.subjectTime) : '',
    createdBy: zapiPhone(group.owner),
    adminAddMemberMode: null,
    // A partial identity response cannot be used to mark absent participants as removed.
    participants: verified ? participants.map((participant) => ({
      id: `${zapiPhone(participant.phone)}@s.whatsapp.net`,
      name: zapiString(participant.name),
      rank: participant.isSuperAdmin === true ? 'creator' : participant.isAdmin === true ? 'admin' : 'member',
      membershipStatus: 'member',
      raw: { provider: 'zapi' },
    })) : [],
    raw: { provider: 'zapi' },
  };
}
