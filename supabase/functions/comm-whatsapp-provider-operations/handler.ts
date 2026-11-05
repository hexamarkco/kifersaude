import type { AuthorizedDashboardUser } from '../_shared/dashboard-auth.ts';
import { ContactPermissionBlockedError, ContactPermissionCheckError } from '../_shared/contact-permissions.ts';
import { ZapiInputError, getZapiOperation } from '../_shared/comm-whatsapp/zapi-operation-input.ts';
import { WhatsAppTransportError } from '../_shared/comm-whatsapp/transport.ts';
import { ZapiRequestError, zapiRecord } from '../_shared/comm-whatsapp/zapi.ts';
import type { ProviderOperationRequest } from './service.ts';

type Dependencies = {
  headers: Record<string, string>;
  authorize(req: Request, mutation: boolean): Promise<AuthorizedDashboardUser | Response>;
  rateLimit(actorId: string): Promise<boolean>;
  execute(actor: AuthorizedDashboardUser, body: ProviderOperationRequest): Promise<unknown>;
};

export function createProviderOperationsHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: deps.headers });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: deps.headers });
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    try {
      // Authenticate before reading a potentially large base64 body.
      const actor = await deps.authorize(req, false);
      if (actor instanceof Response) return actor;
      if (!await deps.rateLimit(actor.userId)) return json({ error: 'Aguarde um instante antes de fazer outra operação.' }, 429);
      if (Number(req.headers.get('content-length')) > 48 * 1024 * 1024) return json({ error: 'Os dados excedem o tamanho permitido.' }, 413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > 48 * 1024 * 1024) return json({ error: 'Os dados excedem o tamanho permitido.' }, 413);
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return json({ error: 'Os dados da operação são inválidos.' }, 400); }
      const body = zapiRecord(parsed);
      const { definition } = getZapiOperation(body.operation);
      if (definition.mutation && !actor.canEditModule) return json({ error: 'Você não tem permissão para alterar o WhatsApp.' }, 403);
      return json(await deps.execute(actor, body), definition.sendsMessage ? 202 : 200);
    } catch (error) {
      if (error instanceof ContactPermissionBlockedError) return json({ error: error.message, code: error.code }, 403);
      if (error instanceof ContactPermissionCheckError) return json({ error: error.message, code: error.code }, 503);
      if (error instanceof ZapiInputError || error instanceof WhatsAppTransportError || error instanceof ZapiRequestError) {
        return json({ error: error.message, ambiguous: 'uncertain' in error && error.uncertain }, error.status);
      }
      return json({ error: 'Não foi possível concluir a operação do WhatsApp. Consulte a situação antes de tentar novamente.' }, 500);
    }
  };
}
