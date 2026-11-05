// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import fixtures from './fixtures/zapi-operation-requests.json';
import { zapiOperations } from '../comm-whatsapp/zapi-operation-contract';
import { prepareZapiOperation, canonicalZapiInput } from '../comm-whatsapp/zapi-operation-input';
import { createZapiAdapter } from '../comm-whatsapp/zapi';
import { normalizeZapiWebhook } from '../comm-whatsapp/zapi-webhook';

const credentials = { instanceId: 'instance', instanceToken: 'server-secret', clientToken: 'client-secret' };

describe('documented Z-API operations', () => {
  test('covers all 107 documented operations and 96 distinct method/path combinations', () => {
    expect(Object.keys(zapiOperations).sort()).toEqual(fixtures.map((row) => row.operation).sort());
    expect(fixtures).toHaveLength(107);
    expect(new Set(fixtures.map((row) => `${row.method} ${row.path.replace(/\{[^}]+\}/g, '{}')}`)).size).toBe(96);
    const browser = readFileSync('src/features/communication/whatsapp/domain/zapiOperationContract.generated.ts', 'utf8');
    expect(browser.endsWith(readFileSync('supabase/functions/_shared/comm-whatsapp/zapi-operation-contract.ts', 'utf8'))).toBe(true);
  });

  test.each(fixtures)('$operation preserves the documented method, path, query and nested body', async (fixture) => {
    const prepared = prepareZapiOperation(fixture.operation, fixture.input, credentials.instanceId);
    const expectedPath = fixture.path.replace(/\{([^}]+)\}/g, (_match, key: string) => encodeURIComponent(String((fixture.input as Record<string, unknown>)[key])));
    const fetcher = vi.fn(async () => Response.json({ messageId: 'accepted' }));
    await createZapiAdapter(credentials, fetcher).request(prepared.path, { method: prepared.definition.method, body: prepared.body });
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const requestUrl = new URL(url);
    expect(requestUrl.pathname).toBe(`/instances/instance/token/server-secret/${expectedPath}`);
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual(Object.fromEntries(Object.entries(fixture.query).map(([key, value]) => [key, String(value)])));
    expect(options.method).toBe(fixture.method);
    expect(options.body ? JSON.parse(String(options.body)) : null).toEqual(fixture.body);
    expect(options.headers).toMatchObject({ 'Client-Token': 'client-secret' });
  });

  test('preserves false and sends root arrays on contact endpoints, including DELETE', () => {
    expect(prepareZapiOperation('message/delete-message', { phone: '5511999999999', messageId: 'MSG', owner: false }, 'instance').path)
      .toContain('owner=false');
    const contacts = [{ phone: '5511999999999', firstName: 'Nome' }];
    expect(prepareZapiOperation('contacts/add-contacts', { contacts }, 'instance').body).toEqual(contacts);
    expect(prepareZapiOperation('contacts/remove-contacts', { phones: ['5511999999999'] }, 'instance').body).toEqual(['5511999999999']);
  });

  test.each([
    ['message/send-button-list', { phone: '5511999999999', message: 'Opções', buttonList: { buttons: [{ label: 'Sim', injected: 'field' }] } }],
    ['contacts/get-metadata-contact', { phone: '../status' }],
    ['newsletter/newsletter-metadata', { newsletterId: 'id?secret=other' }],
    ['contacts/get-contacts', { page: Number.NaN, pageSize: 100 }],
    ['group/add-participant', { autoInvite: false, groupId: 'G', phones: ['123@lid'] }],
    ['message/send-text', { phone: '123@lid', message: 'Olá' }],
    ['message/send-text', { phone: '5511999999999', message: 'Olá', method: 'DELETE' }],
    ['message/send-text', { phone: '5511999999999', message: '' }],
    ['contacts/get-contacts', { page: 1.5, pageSize: 100 }],
  ])('rejects invalid data for %s before any provider call', (operation, input) => {
    expect(() => prepareZapiOperation(operation, input, 'instance')).toThrow();
  });

  test('decodes only namespaced IDs from the active instance and fences unknown operations', () => {
    expect(prepareZapiOperation('message/reply-message', { phone: '5511999999999', message: 'Olá', messageId: 'zapi:instance:MSG' }, 'instance').body)
      .toMatchObject({ messageId: 'MSG' });
    expect(() => prepareZapiOperation('message/reply-message', { phone: '5511999999999', message: 'Olá', messageId: 'zapi:other:MSG' }, 'instance')).toThrow();
    expect(() => prepareZapiOperation('__proto__', {}, 'instance')).toThrow();
  });

  test('a GET that accepts a group invite mutates; batch number lookup and channel search are reads', () => {
    expect(zapiOperations['group/accept-group-invite'].mutation).toBe(true);
    expect(zapiOperations['contacts/get-iswhatsapp-batch'].mutation).toBe(false);
    expect(zapiOperations['newsletter/search-newsletter'].mutation).toBe(false);
    expect(canonicalZapiInput({ z: [{ b: 1, a: 2 }], a: false })).toBe(canonicalZapiInput({ a: false, z: [{ a: 2, b: 1 }] }));
  });

  test.each([{ value: false }, { success: false }, { errors: ['rejected'] }, { error: 'rejected' }])('does not turn HTTP 200 with a provider failure into success: %j', async (result) => {
    const fetcher = vi.fn(async () => Response.json(result));
    await expect(createZapiAdapter(credentials, fetcher).request('create-group', { body: {}, dispatch: true }))
      .rejects.toMatchObject({ status: 422, uncertain: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('real interactive replies remain visible to the Inbox and commercial rules', () => {
  test.each([
    [{ buttonsResponseMessage: { buttonId: '1', message: 'Quero cotar' } }, 'Quero cotar'],
    [{ listResponseMessage: { selectedRowId: '2', title: 'Família', message: 'Plano familiar' } }, 'Família — Plano familiar'],
    [{ pollVote: { options: [{ name: 'Manhã' }] } }, 'Voto na enquete: Manhã'],
    [{ eventResponse: { response: 'GOING' } }, 'Resposta ao evento: vou participar.'],
    [{ buttonsMessage: { message: 'Escolha uma opção' } }, 'Escolha uma opção'],
    [{ hydratedTemplate: { message: 'Seu código' } }, 'Seu código'],
    [{ carouselMessage: { text: 'Alternativas do plano' } }, 'Alternativas do plano'],
    [{ event: { name: 'Reunião' } }, 'Evento: Reunião'],
  ])('normalizes %j into a visible production message', (content, text) => {
    expect(normalizeZapiWebhook({
      ...content, type: 'ReceivedCallback', instanceId: 'instance', connectedPhone: '5511888888888',
      messageId: 'MSG', phone: '5511999999999', fromMe: false, momment: Date.now(),
    }, 'instance', '5511888888888')).toMatchObject({ kind: 'message', message: { type: 'text', text: { body: text } } });
  });
});
