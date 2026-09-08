import { FunctionsFetchError } from '@supabase/supabase-js';

export const isSupabaseConnectivityError = (error: unknown): boolean =>
  error instanceof Error
  && error.message.toLowerCase().includes('falha de rede ao conectar com o supabase');

export const isSupabaseFunctionFetchError = (error: unknown): boolean =>
  error instanceof FunctionsFetchError
  || Boolean(
    error
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'FunctionsFetchError',
  );

export const getSupabaseErrorMessage = async (
  error: unknown,
  fallbackMessage: string,
): Promise<string> => {
  if (isSupabaseConnectivityError(error)) {
    return (error as Error).message;
  }

  if (error instanceof Error && 'context' in error) {
    const context = (error as Error & { context: unknown }).context;

    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = await context.clone().json() as Record<string, unknown> | null;
        if (body && typeof body === 'object') {
          for (const key of ['error', 'message'] as const) {
            const message = body[key];
            if (typeof message === 'string' && message.trim()) {
              return message.trim();
            }
          }
        }
      } catch {
        // Some function errors do not expose a JSON response body.
      }
      return `Edge Function retornou status ${context.status}`;
    }

    if (context instanceof Error && context.message.trim()) {
      return context.message.trim();
    }

    if (context && typeof context === 'object' && 'data' in context) {
      const data = (context as { data?: unknown }).data;
      if (data && typeof data === 'object' && 'error' in data) {
        const message = (data as { error?: unknown }).error;
        if (typeof message === 'string' && message.trim()) {
          return message.trim();
        }
      }
    }

    if (context && typeof context === 'object' && 'message' in context) {
      const message = String(
        (context as { message?: unknown }).message ?? '',
      ).trim();
      if (message) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
};
