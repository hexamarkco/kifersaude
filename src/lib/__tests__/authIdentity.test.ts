import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { User } from '@supabase/supabase-js';

import { getAuthenticatedUserId } from '../supabase';

test('usa somente o identificador imutavel da sessao', () => {
  const user = {
    id: 'auth-user-id',
    user_metadata: {
      user_management_id: 'victim-profile-id',
      user_id: 'another-victim-profile-id',
      role: 'admin',
    },
    app_metadata: {
      user_management_id: 'app-metadata-victim-id',
      role: 'admin',
    },
  } as Pick<User, 'id'>;

  assert.equal(getAuthenticatedUserId(user), 'auth-user-id');
});

test('retorna nulo sem uma sessao autenticada valida', () => {
  assert.equal(getAuthenticatedUserId(null), null);
  assert.equal(getAuthenticatedUserId({ id: '   ' }), null);
});
