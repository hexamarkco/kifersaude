import { databaseClient } from '../../../../infrastructure/supabase';
import type { ZapiJson, ZapiOperation, ZapiOperationInput } from '../domain/zapiOperationContract.generated';

export type ProviderOperationResult = {
  result: ZapiJson;
  externalMessageId: string | null;
  state: 'queued' | 'processed' | 'queried';
  historyPending: boolean;
};

export class ProviderOperationError extends Error {
  constructor(message: string, readonly ambiguous: boolean) { super(message); }
}

export const providerOperationsRepository = {
  async execute<K extends ZapiOperation>(operation: K, input: ZapiOperationInput<K>, options: {
    requestId: string; revision: number;
  }): Promise<ProviderOperationResult> {
    const { data, error } = await databaseClient.functions.invoke('comm-whatsapp-provider-operations', {
      body: { operation, input, ...options },
    });
    if (error) {
      const context = 'context' in error ? error.context : undefined;
      const body: unknown = context instanceof Response ? await context.json().catch(() => null) : null;
      const details = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      throw new ProviderOperationError(
        typeof details.error === 'string' ? details.error : 'Não foi possível confirmar a operação. Confira o WhatsApp antes de tentar novamente.',
        details.ambiguous === true || !(context instanceof Response) || context.status >= 500,
      );
    }
    const result = data as ProviderOperationResult | null;
    if (!result || !['queued', 'processed', 'queried'].includes(result.state)) {
      throw new ProviderOperationError('A resposta não confirmou a situação da operação. Confira o WhatsApp.', true);
    }
    return result;
  },
};
