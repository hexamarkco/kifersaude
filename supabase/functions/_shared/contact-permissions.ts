import { normalizeCommWhatsAppPhone } from './comm-whatsapp/identity.ts';

export type ContactPermissionSendScope = 'commercial' | 'service_reply' | 'transactional';

type RpcError = { message?: string } | null;

export type ContactPermissionRpcClient = {
  rpc: (
    functionName: string,
    params: {
      p_channel: 'whatsapp';
      p_endpoint_normalized: string;
      p_purpose_scope: ContactPermissionSendScope;
    },
  ) => PromiseLike<{ data: unknown; error: RpcError }>;
};

type ContactPermissionCheckResult = {
  allowed?: unknown;
  blocked_scope?: unknown;
  reason?: unknown;
};

export class ContactPermissionBlockedError extends Error {
  readonly code = 'CONTACT_PERMISSION_BLOCKED';
  readonly blockedScope: string;

  constructor(blockedScope: string, reason?: string) {
    const detail = reason?.trim();
    super(detail
      ? `Envio bloqueado pela permissão de contato (${blockedScope}): ${detail}`
      : `Envio bloqueado pela permissão de contato (${blockedScope}).`);
    this.name = 'ContactPermissionBlockedError';
    this.blockedScope = blockedScope;
  }
}

export class ContactPermissionCheckError extends Error {
  readonly code = 'CONTACT_PERMISSION_CHECK_FAILED';

  constructor() {
    super('Não foi possível verificar a permissão de contato; o envio foi bloqueado por segurança.');
    this.name = 'ContactPermissionCheckError';
  }
}

/**
 * Checks the canonical DB permission immediately before outbound dispatch.
 * The RPC includes global blocks and the requested scope; infrastructure
 * failures and malformed responses deliberately fail closed.
 */
export async function assertContactPermissionForSend(
  client: ContactPermissionRpcClient,
  endpoint: unknown,
  purposeScope: ContactPermissionSendScope,
): Promise<void> {
  const endpointNormalized = normalizeCommWhatsAppPhone(endpoint);
  if (endpointNormalized.length < 3) {
    throw new ContactPermissionCheckError();
  }

  let result: { data: unknown; error: RpcError };
  try {
    result = await client.rpc('check_contact_permission_for_send', {
      p_channel: 'whatsapp',
      p_endpoint_normalized: endpointNormalized,
      p_purpose_scope: purposeScope,
    });
  } catch {
    throw new ContactPermissionCheckError();
  }

  if (result.error) {
    throw new ContactPermissionCheckError();
  }

  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new ContactPermissionCheckError();
  }

  const check = result.data as ContactPermissionCheckResult;
  if (check.allowed === false) {
    const blockedScope = typeof check.blocked_scope === 'string' ? check.blocked_scope : 'global';
    const reason = typeof check.reason === 'string' ? check.reason : undefined;
    throw new ContactPermissionBlockedError(blockedScope, reason);
  }
  if (check.allowed !== true) {
    throw new ContactPermissionCheckError();
  }
}
