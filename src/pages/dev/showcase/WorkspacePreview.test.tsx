import assert from 'node:assert/strict';
import { act, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import { ToastProvider } from '../../../design-system';
import WorkspacePreview, { ContactForm, ContactList } from './WorkspacePreview';
import States from './States';
import type { DemoContact } from './demoData';

function mount(element: ReactElement) {
  return render(<ToastProvider>{element}</ToastProvider>);
}
function click(container: HTMLElement, label: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('button'),
  ].find(
    (item) =>
      item.textContent?.trim() === label ||
      item.getAttribute('aria-label') === label,
  );
  assert.ok(button, `Button ${label}`);
  act(() => button.click());
}
function input(container: HTMLElement, selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(selector);
  assert.ok(element);
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function submit(container: HTMLElement) {
  act(() =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

test('empty form explains each error, focuses the first invalid field and cancels without saving', () => {
  let saves = 0;
  let cancellations = 0;
  const { container, unmount } = mount(
    <ContactForm
      onSave={() => {
        saves += 1;
      }}
      onCancel={() => {
        cancellations += 1;
      }}
    />,
  );
  submit(container);
  assert.equal(saves, 0);
  assert.equal(container.querySelectorAll('[role="alert"]').length, 3);
  assert.equal(
    document.activeElement,
    container.querySelector('[name="name"]'),
  );
  const name = container.querySelector<HTMLInputElement>('[name="name"]')!;
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.ok(document.getElementById(name.getAttribute('aria-describedby')!));
  input(container, '[name="name"]', 'Contato de teste');
  click(container, 'Cancelar');
  assert.equal(cancellations, 1);
  assert.equal(name.value, '');
  assert.equal(saves, 0);
  unmount();
});

test('valid form uses the production phone mask and saves the entered local contact', () => {
  const saved: DemoContact[] = [];
  const { container, unmount } = mount(
    <ContactForm
      onSave={(contact) => saved.push(contact)}
      onCancel={() => undefined}
    />,
  );
  input(container, '[name="name"]', 'Pessoa de Exemplo');
  input(container, '[name="email"]', 'pessoa@example.com');
  input(container, '[name="phone"]', '11987654321');
  assert.equal(
    container.querySelector<HTMLInputElement>('[name="phone"]')!.value,
    '(11) 98765-4321',
  );
  submit(container);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Pessoa de Exemplo');
  assert.equal(saved[0].email, 'pessoa@example.com');
  assert.equal(saved[0].phone, '(11) 98765-4321');
  assert.equal(saved[0].status, 'Novo contato');
  unmount();
});

test('search, sorting, pagination and empty-result recovery use the displayed rows', () => {
  const { container, unmount } = mount(<ContactList />);
  const names = () =>
    [...container.querySelectorAll('tbody .ds-person strong')].map(
      (item) => item.textContent,
    );
  assert.equal(names()[0], 'Ana Paula Ribeiro');
  click(container, 'Próxima página');
  assert.equal(names()[0], 'Elisa Santos');
  input(container, '[aria-label="Buscar contatos"]', 'Bruno');
  assert.deepEqual(names(), ['Bruno Costa']);
  input(container, '[aria-label="Buscar contatos"]', 'sem resultado');
  assert.match(container.textContent ?? '', /Nenhum contato encontrado/);
  click(container, 'Limpar busca e filtros');
  assert.equal(names()[0], 'Ana Paula Ribeiro');
  click(container, 'Ordenar por Nome');
  assert.equal(names()[0], 'Henrique Souza');
  unmount();
});

test('creation and editing update the preview and preserve the selected contact details', () => {
  const { container, unmount } = mount(
    <WorkspacePreview initialPattern="create" />,
  );
  input(container, '[name="name"]', 'Pessoa Local');
  input(container, '[name="email"]', 'local@example.com');
  input(container, '[name="phone"]', '11987654321');
  submit(container);
  assert.equal(container.querySelector('h1')!.textContent, 'Pessoa Local');
  assert.match(container.textContent ?? '', /local@example.com/);
  click(container, 'Editar contato');
  input(container, '[name="name"]', 'Pessoa Atualizada');
  submit(container);
  assert.equal(container.querySelector('h1')!.textContent, 'Pessoa Atualizada');
  click(container, 'Voltar');
  input(container, '[aria-label="Buscar contatos"]', 'Pessoa Atualizada');
  assert.match(
    container.querySelector('tbody')!.textContent ?? '',
    /Pessoa Atualizada/,
  );
  unmount();
});

test('recovering a simulated data error returns the list after loading', async () => {
  vi.useFakeTimers();
  const { container, unmount } = mount(<States />);
  try {
    const label = [...container.querySelectorAll('label')].find(
      (item) => item.textContent === 'Cenário de dados',
    )!;
    const scenario = document.getElementById(label.htmlFor)!;
    act(() => scenario.click());
    const option = [
      ...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'),
    ].find((item) => item.textContent === 'Falha ao carregar')!;
    act(() => option.click());
    assert.match(
      container.textContent ?? '',
      /Não foi possível carregar os contatos/,
    );
    click(container, 'Tentar novamente');
    assert.match(container.textContent ?? '', /Carregando contatos/);
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    assert.match(container.textContent ?? '', /Contatos disponíveis/);
  } finally {
    unmount();
    vi.useRealTimers();
  }
});
