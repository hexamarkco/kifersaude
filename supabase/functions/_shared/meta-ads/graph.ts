import { MetaError, isRecord } from './domain.ts';

export function createGraphClient(version: string, token: string, fetcher: typeof fetch = fetch) {
  if (!/^v\d+\.0$/.test(version) || !token) throw new MetaError('GRAPH_NOT_CONFIGURED');
  return async (id: string, fieldsOrBody: string | Record<string, unknown>): Promise<unknown> => {
    if (!/^\d{1,32}$/.test(id)) throw new MetaError('INVALID_PROVIDER_ID');
    const url = new URL(`https://graph.facebook.com/${version}/${id}${typeof fieldsOrBody === 'string' ? '' : '/events'}`);
    if (typeof fieldsOrBody === 'string') url.searchParams.set('fields', fieldsOrBody);
    let response: Response;
    try {
      response = await fetcher(url, {
        method: typeof fieldsOrBody === 'string' ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: typeof fieldsOrBody === 'string' ? undefined : JSON.stringify(fieldsOrBody),
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
    } catch { throw new MetaError('GRAPH_NETWORK', true); }
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new MetaError('GRAPH_INVALID_RESPONSE', true); }
    if (!response.ok || (isRecord(payload) && payload.error)) {
      const transient = isRecord(payload) && isRecord(payload.error) && payload.error.is_transient === true;
      const code = isRecord(payload) && isRecord(payload.error) ? payload.error.code : null;
      throw new MetaError(response.status === 401 || response.status === 403 || [10,190,200].includes(Number(code)) ? 'GRAPH_AUTH' : 'GRAPH_REJECTED',
        transient || [1,2,4,17,32,341,613,80004].includes(Number(code)) || [408, 429].includes(response.status) || response.status >= 500);
    }
    return payload;
  };
}
