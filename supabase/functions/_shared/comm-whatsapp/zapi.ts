import type { ZapiJson } from './zapi-operation-contract.ts';

export type ZapiCredentials = {
  instanceId: string;
  instanceToken: string;
  clientToken: string;
};

export type WhatsAppConnection = { connected: boolean; phone: string | null };
export type MediaKind = 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'gif';
export type ZapiSend =
  | { phone: string; kind: 'text'; text: string; quote?: string }
  | { phone: string; kind: MediaKind; media: string | Blob; caption?: string; fileName?: string; quote?: string };
export type ZapiAcceptance = { messageId: string; queueId: string | null };
type ZapiBody = ZapiJson;

export class ZapiRequestError extends Error {
  constructor(readonly status: number, readonly uncertain: boolean) {
    super(uncertain
      ? 'Não foi possível confirmar o envio pela Z-API. Aguarde a conciliação antes de tentar novamente.'
      : `A Z-API recusou a operação (HTTP ${status}).`);
  }
}

export const zapiRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

export const zapiString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export const zapiPhone = (value: unknown): string => {
  const phone = zapiString(value);
  return /^[1-9]\d{7,14}$/.test(phone) ? phone : '';
};

const safeId = (value: unknown) => {
  const id = zapiString(value);
  return /^[\w.-]{1,128}$/.test(id) ? id : '';
};

export const isZapiMessageId = (id: string) => id.startsWith('zapi:');
export const isZapiMediaId = (id: string) => /^zapi-media-[a-f0-9]{64}$/.test(id);
export async function zapiMediaId(externalId: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(externalId));
  return 'zapi-media-' + Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const zapiExternalId = (instanceId: string, id: unknown): string => {
  const key = safeId(id);
  return safeId(instanceId) && key ? `zapi:${instanceId}:${key}` : '';
};
export const zapiNativeId = (instanceId: string, id: string): string => {
  const prefix = `zapi:${instanceId}:`;
  return id.startsWith(prefix) ? safeId(id.slice(prefix.length)) : '';
};

export function zapiDestination(chatId: string, verifiedPhone?: string | null): string {
  const direct = /^([1-9]\d{7,14})@s\.whatsapp\.net$/.exec(chatId);
  if (direct) return !verifiedPhone || direct[1] === verifiedPhone ? direct[1] : '';
  if (/^\d+(?:-\d+)?@g\.us$/.test(chatId)) return chatId.replace(/@g\.us$/, '-group');
  // A route resolved by the CRM may have independent evidence of the phone.
  // A LID by itself is never evidence of a phone number.
  if (/^\d+@lid$/.test(chatId)) return zapiPhone(verifiedPhone);
  return zapiPhone(chatId);
}

async function dataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 16_384)));
  }
  return `data:${file.type.split(';')[0] || 'application/octet-stream'};base64,${btoa(chunks.join(''))}`;
}

export function createZapiAdapter(credentials: ZapiCredentials, fetcher: typeof fetch = fetch) {
  const base = `https://api.z-api.io/instances/${encodeURIComponent(credentials.instanceId)}/token/${encodeURIComponent(credentials.instanceToken)}`;

  async function request(path: string, options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: ZapiBody;
    timeoutMs?: number;
    dispatch?: boolean;
  } = {}): Promise<unknown> {
    const signal = AbortSignal.timeout(options.timeoutMs ?? 15_000);
    try {
      const response = await fetcher(`${base}/${path}`, {
        method: options.method ?? (options.body ? 'POST' : 'GET'),
        headers: { 'Client-Token': credentials.clientToken, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: options.body ? JSON.stringify(options.body) : undefined,
        redirect: 'error',
        signal,
      });
      if (!response.ok) {
        throw new ZapiRequestError(response.status, options.dispatch === true &&
          (response.status >= 500 || response.status === 408 || response.status === 429));
      }
      if (response.status === 204) return null;
      const payload: unknown = await response.json();
      const result = zapiRecord(payload);
      if (result.value === false || result.success === false || result.error ||
          (Array.isArray(result.errors) && result.errors.length > 0)) {
        throw new ZapiRequestError(422, false);
      }
      return payload;
    } catch (error) {
      if (error instanceof ZapiRequestError) throw error;
      throw new ZapiRequestError(signal.aborted ? 504 : 502, options.dispatch === true);
    }
  }

  return {
    request,
    async getConnection(): Promise<WhatsAppConnection> {
      const status = zapiRecord(await request('status'));
      if (status.connected !== true) return { connected: false, phone: null };
      const device = zapiRecord(await request('device'));
      return { connected: true, phone: zapiPhone(device.phone) || null };
    },
    async send(input: ZapiSend, timeoutMs?: number): Promise<ZapiAcceptance> {
      const phone = input.phone;
      const body: Record<string, string | boolean> = { phone };
      if (input.quote) body.messageId = input.quote;
      let endpoint: string;
      if (input.kind === 'text') {
        endpoint = 'send-text';
        body.message = input.text;
      } else {
        const field = input.kind === 'voice' ? 'audio' : input.kind;
        endpoint = `send-${field}`;
        if (input.quote && ['audio', 'sticker'].includes(field)) {
          throw new ZapiRequestError(422, false);
        }
        body[field] = typeof input.media === 'string'
          ? input.media.replace(/;name=[^;]*;base64,/, ';base64,')
          : await dataUrl(input.media);
        if (input.caption && ['image', 'video', 'document', 'gif'].includes(field)) body.caption = input.caption;
        if (field === 'document') {
          const extension = /\.([a-z0-9]{1,10})$/i.exec(input.fileName ?? '')?.[1];
          if (!extension) throw new ZapiRequestError(422, false);
          endpoint += `/${extension.toLowerCase()}`;
          body.fileName = input.fileName!;
        }
        if (input.kind === 'voice') body.waveform = true;
      }
      const result = zapiRecord(await request(endpoint, { body, timeoutMs, dispatch: true }));
      const messageId = zapiExternalId(credentials.instanceId, result.messageId);
      if (!messageId) throw new ZapiRequestError(502, true);
      return { messageId, queueId: safeId(result.zaapId) || null };
    },
  };
}
