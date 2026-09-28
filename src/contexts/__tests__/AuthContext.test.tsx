import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import type { UserProfile } from '../../features/config';
import type { Mock } from '@vitest/spy';
import { test, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  clearLocalAuthSession: vi.fn<() => Promise<void>>(),
  getCurrentSession: vi.fn() as Mock<[], Promise<{ session: unknown; error: unknown }>>,
  loadAuthenticatedUserProfile: vi.fn() as Mock<[profileId: string], Promise<UserProfile | null>>,
  signInWithUsername: vi.fn(),
  signOutAuthenticatedUser: vi.fn<() => Promise<void>>(),
  signUpWithEmail: vi.fn(),
  subscribeToAuthState: vi.fn() as Mock<[
    callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: unknown) => void,
  ], () => void>,
}));

vi.mock('../../app/auth/authService', () => authMocks);
vi.mock('../../infrastructure/supabase', () => ({
  getAuthenticatedUserId: (user: { id?: string } | null) => user?.id ?? null,
}));

import { AuthProvider, useAuth } from '../AuthContext';

test('ignora perfil antigo quando o usuario sai antes da consulta terminar', async () => {
  let onAuthStateChange: ((event: 'SIGNED_IN' | 'SIGNED_OUT', session: unknown) => void) | null = null;
  let resolveProfile: ((profile: UserProfile) => void) | null = null;
  const profileRequest = new Promise<UserProfile>((resolve) => {
    resolveProfile = resolve;
  });

  authMocks.getCurrentSession.mockResolvedValue({ session: null, error: null });
  authMocks.subscribeToAuthState.mockImplementation((callback) => {
    onAuthStateChange = callback;
    return vi.fn();
  });
  authMocks.loadAuthenticatedUserProfile.mockReturnValue(profileRequest);

  const view = render(
    <AuthProvider>
      <AuthStateLabel />
    </AuthProvider>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  const session = { user: { id: 'user-a' } };
  const triggerAuthStateChange = (event: 'SIGNED_IN' | 'SIGNED_OUT', nextSession: unknown) => {
    const callback = onAuthStateChange;
    if (!callback) throw new Error('callback de autenticação não foi registrado');
    callback(event, nextSession);
  };

  await act(async () => {
    triggerAuthStateChange('SIGNED_IN', session);
    triggerAuthStateChange('SIGNED_OUT', null);
    await Promise.resolve();
  });

  const finishProfileRequest = (profile: UserProfile) => {
    const resolve = resolveProfile;
    if (!resolve) throw new Error('consulta de perfil não foi iniciada');
    resolve(profile);
  };

  await act(async () => {
    finishProfileRequest({
      id: 'user-a',
      email: 'user-a@example.com',
      username: 'usuario-antigo',
      role: 'admin',
      created_at: '',
    });
    await profileRequest;
  });

  assert.equal(view.container.textContent, 'sem perfil');
  view.unmount();
});

function AuthStateLabel() {
  const { userProfile } = useAuth();
  return <span>{userProfile?.username ?? 'sem perfil'}</span>;
}
