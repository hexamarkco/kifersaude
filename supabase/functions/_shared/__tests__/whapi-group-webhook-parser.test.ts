import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildWhapiGroupEventReceiptKey,
  extractWhapiGroupEvents,
  normalizeWhapiGroupSnapshot,
} from '../whapi-group-webhook-parser';

test('normalizes a group snapshot and preserves participant roles', () => {
  const snapshot = normalizeWhapiGroupSnapshot({
    id: '120363012345678901@g.us',
    name: 'Equipe de Atendimento',
    description: 'Grupo controlado',
    adminAddMemberMode: true,
    created_at: 1713791253,
    name_at: 1713791253,
    created_by: '919984351847',
    participants: [
      { id: '919984351847', name: 'Admin', rank: 'creator' },
      { id: '61371989950', name: 'Membro', rank: 'member' },
    ],
  });

  assert.equal(snapshot?.id, '120363012345678901@g.us');
  assert.equal(snapshot?.name, 'Equipe de Atendimento');
  assert.equal(snapshot?.adminAddMemberMode, true);
  assert.equal(snapshot?.createdAt, '1713791253');
  assert.equal(snapshot?.createdBy, '919984351847');
  assert.deepEqual(snapshot?.participants.map((participant) => participant.rank), ['creator', 'member']);
});

test('extracts post, participant and patch events in payload order', () => {
  const events = extractWhapiGroupEvents({
    groups: [{ id: '120363012345678901@g.us', name: 'Grupo novo', participants: [] }],
    groups_participants: [{
      group_id: '120363012345678901@g.us',
      action: 'promote',
      participants: ['5511999999999@s.whatsapp.net'],
      performed_by: '5511888888888@s.whatsapp.net',
    }],
    groups_updates: [{
      before_update: { id: '120363012345678901@g.us', name: 'Grupo novo' },
      after_update: { id: '120363012345678901@g.us', name: 'Grupo renomeado' },
      changes: ['name'],
      trigger: { id: 'group-event-1', timestamp: '1760000000' },
    }],
  });

  assert.deepEqual(events.map((event) => event.eventType), ['post', 'participants', 'patch']);
  assert.equal(events[1]?.action, 'promote');
  assert.equal(events[2]?.snapshot?.name, 'Grupo renomeado');
  assert.equal(buildWhapiGroupEventReceiptKey(events[1]!), buildWhapiGroupEventReceiptKey(events[1]!));
});

test('accepts participant metadata before a full group snapshot', () => {
  const [event] = extractWhapiGroupEvents({
    groups_participants: [{
      group_id: '120363012345678901@g.us',
      action: 'request',
      participants: ['5511999999999@s.whatsapp.net'],
    }],
  });

  assert.equal(event?.groupId, '120363012345678901@g.us');
  assert.equal(event?.participantIds[0], '5511999999999@s.whatsapp.net');
  assert.equal(event?.action, 'request');
});
