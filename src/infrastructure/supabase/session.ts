import type { Session, User } from '@supabase/supabase-js';

import { supabase } from './client';
import { getSupabaseErrorMessage } from './errors';

export async function waitForSupabaseSession(options: {
  timeoutMs?: number;
  errorMessage?: string;
} = {}): Promise<Session> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() <= deadline) {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      lastError = error;
    } else if (session?.access_token) {
      return session;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }

  if (lastError) {
    throw new Error(
      await getSupabaseErrorMessage(
        lastError,
        options.errorMessage ?? 'Não foi possível validar sua sessão.',
      ),
    );
  }

  throw new Error(
    options.errorMessage
      ?? 'Sua sessão ainda não está pronta. Atualize a página ou entre novamente.',
  );
}

export function getAuthenticatedUserId(
  user: Pick<User, 'id'> | null | undefined,
): string | null {
  const userId = user?.id?.trim();
  return userId || null;
}
