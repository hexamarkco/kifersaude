import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { UserProfile } from '../../features/config';
import { databaseClient } from '../../infrastructure/supabase';

export type AuthResult = { error: unknown };

export async function getCurrentSession(): Promise<{
  session: Session | null;
  error: unknown;
}> {
  const { data, error } = await databaseClient.auth.getSession();
  return { session: data.session, error };
}

export function subscribeToAuthState(
  onChange: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data: { subscription } } = databaseClient.auth.onAuthStateChange(onChange);
  return () => subscription.unsubscribe();
}

export async function loadAuthenticatedUserProfile(
  profileId: string,
): Promise<UserProfile | null> {
  const { data, error } = await databaseClient
    .from('user_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    username: data.username,
    role: data.role,
    created_at: data.created_at ?? '',
    created_by: data.created_by ?? undefined,
  };
}

export async function clearLocalAuthSession(): Promise<void> {
  const { error } = await databaseClient.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

async function resolveEmailFromUsername(username: string): Promise<{
  email: string | null;
  error: unknown;
}> {
  const { data: emailFromRpc, error: emailLookupError } = await databaseClient.rpc(
    'get_email_by_username',
    { p_username: username },
  );
  if (emailLookupError) return { email: null, error: emailLookupError };
  if (emailFromRpc) return { email: emailFromRpc, error: null };

  const { data: profile, error: profileError } = await databaseClient
    .from('user_profiles')
    .select('email')
    .eq('username', username)
    .maybeSingle();
  if (profileError) return { email: null, error: profileError };
  return { email: profile?.email ?? null, error: null };
}

export async function signInWithUsername(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) return { error: { message: 'Usuário não encontrado' } };

    const resolved = normalizedUsername.includes('@')
      ? { email: normalizedUsername, error: null }
      : await resolveEmailFromUsername(normalizedUsername);
    if (resolved.error) return { error: resolved.error };
    if (!resolved.email) return { error: { message: 'Usuário não encontrado' } };

    const { error } = await databaseClient.auth.signInWithPassword({
      email: resolved.email,
      password,
    });
    return { error };
  } catch (error) {
    return { error };
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const { error } = await databaseClient.auth.signUp({ email, password });
  return { error };
}

export async function signOutAuthenticatedUser(): Promise<void> {
  const { error } = await databaseClient.auth.signOut();
  if (error) throw error;
}
