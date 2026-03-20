import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  areEquivalentDirectChats,
  choosePreferredDirectChatId,
  getDirectChatMergePriority,
} from '../directChatIdentity';

test('treats c.us and s.whatsapp.net variants as the same direct chat', () => {
  assert.equal(
    areEquivalentDirectChats(
      {
        id: '5511998765432@c.us',
        is_group: false,
        phone_number: '5511998765432',
      },
      {
        id: '5511998765432@s.whatsapp.net',
        is_group: false,
        phone_number: '11998765432',
      },
    ),
    true,
  );
});

test('does not merge non-direct chats into the same identity', () => {
  assert.equal(
    areEquivalentDirectChats(
      {
        id: '1203630-1@g.us',
        is_group: true,
      },
      {
        id: '5511998765432@s.whatsapp.net',
        is_group: false,
        phone_number: '5511998765432',
      },
    ),
    false,
  );
});

test('prefers stable direct ids over lid aliases when merging chat rows', () => {
  assert.equal(
    choosePreferredDirectChatId(
      {
        id: '5511998765432@lid',
        phone_number: null,
      },
      {
        id: '5511998765432@s.whatsapp.net',
        phone_number: '5511998765432',
      },
    ),
    '5511998765432@s.whatsapp.net',
  );
  assert.ok(getDirectChatMergePriority('5511998765432@s.whatsapp.net', '5511998765432') > getDirectChatMergePriority('5511998765432@lid', '5511998765432'));
});
