import { databaseClient } from '../../../../infrastructure/supabase';
import type { UserProfile } from '../../domain/types';

type CreateUserInput = {
  email: string;
  password: string;
  username: string;
  role: string;
};

type UpdateUserInput = {
  userId: string;
  updates: {
    username: string;
    email: string;
    role: string;
    password?: string;
  };
};

async function invokeManageUsers(
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<void> {
  const { data, error } = await databaseClient.functions.invoke('manage-users', { body });
  if (error) throw new Error(error.message || fallbackMessage);

  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
}

export async function listUsers(): Promise<UserProfile[]> {
  const { data, error } = await databaseClient
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email,
    username: profile.username,
    role: profile.role,
    created_at: profile.created_at ?? '',
    created_by: profile.created_by ?? undefined,
  }));
}

export async function createUser(input: CreateUserInput): Promise<void> {
  await invokeManageUsers(
    { action: 'createUser', ...input },
    'Não foi possível criar o usuário.',
  );
}

export async function updateUser(input: UpdateUserInput): Promise<void> {
  await invokeManageUsers(
    { action: 'updateUser', ...input },
    'Não foi possível atualizar o usuário.',
  );
}

export async function deleteUser(userId: string): Promise<void> {
  await invokeManageUsers(
    { action: 'deleteUser', userId },
    'Não foi possível excluir o usuário.',
  );
}

export async function countUsersByRole(role: string): Promise<number> {
  const { count, error } = await databaseClient
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', role);
  if (error) throw error;
  return count ?? 0;
}
