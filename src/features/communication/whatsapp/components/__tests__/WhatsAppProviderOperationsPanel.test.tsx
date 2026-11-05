import { act } from 'react';
import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { render } from '../../../../../testing-library/react';
import WhatsAppProviderOperationsPanel from '../WhatsAppProviderOperationsPanel';

const requests = vi.hoisted(() => ({ calls: [] as Array<{ name: string; body: Record<string, unknown> }>, responses: [] as unknown[] }));
vi.mock('../../../../../infrastructure/supabase', () => ({ databaseClient: { functions: {
  invoke: async (name: string, options: { body: Record<string, unknown> }) => {
    requests.calls.push({ name, body: options.body });
    return requests.responses.shift();
  },
} } }));

function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((entry) => entry.textContent?.trim() === label);
  if (!found) throw new Error(`Botão não encontrado: ${label}`);
  return found;
}
async function submit(container: HTMLElement) {
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

function setup(responses: unknown[]) { requests.calls = []; requests.responses = responses; }

test('builds a group request with explicit false and structured recipients, then prevents a duplicate click', async () => {
  setup([{ data: { state: 'processed', result: { value: true }, historyPending: false }, error: null }]);
  const view = render(<WhatsAppProviderOperationsPanel revision={7} />);
  try {
    change(view.container.querySelectorAll('select')[0], 'Grupos');
    change(view.container.querySelectorAll('select')[1], 'group/create-group');
    change(view.container.querySelector<HTMLInputElement>('#operation-groupName')!, 'Equipe comercial');
    const invite = view.container.querySelector('#operation-autoInvite')!.closest('.kds-field')!.querySelector('select')!;
    assert.ok(Array.from(invite.options).some((option) => option.textContent === 'Não'));
    change(invite, 'false');
    act(() => button(view.container, 'Adicionar item').click());
    change(view.container.querySelector<HTMLInputElement>('#operation-phones-0')!, '5511999999999');
    await submit(view.container);
    assert.equal(requests.calls[0].name, 'comm-whatsapp-provider-operations');
    assert.equal(requests.calls[0].body.operation, 'group/create-group');
    assert.equal(requests.calls[0].body.revision, 7);
    assert.deepEqual(requests.calls[0].body.input, { groupName: 'Equipe comercial', autoInvite: false, phones: ['5511999999999'] });
    assert.equal(view.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled, true);
    assert.ok(view.container.textContent?.includes('Confirmação do provedor'));
  } finally { view.unmount(); }
});

test('an empty query is explained as empty and does not turn into success', async () => {
  setup([{ data: { state: 'queried', result: [], historyPending: false }, error: null }]);
  const view = render(<WhatsAppProviderOperationsPanel revision={1} />);
  try {
    await submit(view.container);
    assert.ok(view.container.textContent?.includes('A consulta não retornou registros.'));
    assert.ok(!view.container.textContent?.includes('sucesso'));
  } finally { view.unmount(); }
});

test('an ambiguous request locks its data and reuses its identifier when checking again', async () => {
  setup([{ data: null, error: { context: new Response(JSON.stringify({ error: 'Confirmação pendente', ambiguous: true }), { status: 409 }) } }]);
  const view = render(<WhatsAppProviderOperationsPanel revision={1} />);
  try {
    change(view.container.querySelectorAll('select')[0], 'Mensagens');
    change(view.container.querySelector<HTMLInputElement>('#operation-phone')!, '5511999999999');
    change(view.container.querySelector<HTMLInputElement>('#operation-message')!, 'Olá');
    await submit(view.container);
    const first = requests.calls[0].body;
    assert.equal(view.container.querySelector<HTMLInputElement>('#operation-message')!.disabled, true);
    requests.responses.push({ data: { state: 'queued', result: { messageId: 'MSG' }, historyPending: false }, error: null });
    await submit(view.container);
    assert.deepEqual(requests.calls[1].body, first);
    assert.ok(view.container.textContent?.includes('Entrega e leitura ainda dependem'));
  } finally { view.unmount(); }
});
