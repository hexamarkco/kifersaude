import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import {
  Combobox,
  DateTimePicker,
  DesignSystemProvider,
  DetailPage,
  Dialog,
  DialogTitle,
  Field,
  FormActions,
  FormPage,
  FormSection,
  Input,
  ListPage,
  MultiSelect,
  PageActions,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Switch,
  Tooltip,
} from '../../index';
import { getOverlayPosition } from '../../hooks/useOverlayPosition';

test('page actions isolate destruction and preserve secondary/primary order while saving', () => {
  const view = render(
    <PageActions
      destructive={{ label: 'Excluir' }}
      secondary={[{ label: 'Cancelar' }]}
      primary={{ label: 'Salvar', loading: true }}
    />,
  );
  const buttons = [...view.container.querySelectorAll('button')];
  assert.deepEqual(
    buttons.map((button) => button.textContent),
    ['Excluir', 'Cancelar', 'Salvar'],
  );
  assert.ok(buttons.every((button) => button.disabled));
  assert.equal(buttons[2].getAttribute('aria-busy'), 'true');
  view.unmount();
});

test('list layout keeps orientation, search, filters, results and pagination in one reading order', () => {
  const view = render(
    <ListPage
      header={{
        title: 'Contatos',
        breadcrumbs: <nav aria-label="Caminho">CRM</nav>,
        actions: <PageActions primary={{ label: 'Novo contato' }} />,
      }}
      search={<Input aria-label="Busca" />}
      filters={<ButtonFilter />}
      summary="8 contatos"
      pagination={<nav aria-label="Paginação">Página 1</nav>}
    >
      <table aria-label="Resultados" />
    </ListPage>,
  );
  assert.equal(view.container.querySelector('h1')?.textContent, 'Contatos');
  const search = view.container.querySelector('input')!;
  const results = view.container.querySelector('table')!;
  const pagination = view.container.querySelector('[aria-label="Paginação"]')!;
  assert.ok(
    search.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  assert.ok(
    results.compareDocumentPosition(pagination) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  );
  assert.ok(view.container.querySelector('.kds-page-header-operational nav'));
  view.unmount();
});
function ButtonFilter() {
  return <button type="button">Status</button>;
}

test('form page submits once with grouped fields and cancel keeps native non-submit semantics', () => {
  let saves = 0;
  let cancelled = 0;
  const view = render(
    <FormPage
      header={{ title: 'Novo contato' }}
      onSubmit={(event) => {
        event.preventDefault();
        saves++;
      }}
      actions={
        <FormActions
          onCancel={() => {
            cancelled++;
          }}
          sticky
        />
      }
    >
      <FormSection title="Identificação">
        <Field label="Nome">
          <Input />
        </Field>
      </FormSection>
    </FormPage>,
  );
  assert.equal(
    view.container.querySelector('legend')?.textContent,
    'Identificação',
  );
  const buttons = view.container.querySelectorAll('button');
  act(() => buttons[0].click());
  assert.equal(saves, 0);
  assert.equal(cancelled, 1);
  act(() => buttons[1].click());
  assert.equal(saves, 1);
  view.unmount();
});

test('form page supports a responsive guidance aside and a header submit action', () => {
  let submits = 0;
  const view = render(
    <FormPage
      id="contact-form"
      header={{
        title: 'Editar contato',
        actions: (
          <PageActions
            primary={{
              label: 'Salvar alterações',
              type: 'submit',
              form: 'contact-form',
            }}
          />
        ),
      }}
      onSubmit={(event) => {
        event.preventDefault();
        submits++;
      }}
      actions={<FormActions onCancel={() => undefined} />}
      aside={<p>Confira os campos antes de salvar.</p>}
    >
      <FormSection title="Identificação">
        <Field label="Nome">
          <Input />
        </Field>
      </FormSection>
    </FormPage>,
  );
  const layout = view.container.querySelector('.kds-form-layout-aside')!;
  const aside = layout.querySelector('aside')!;
  const form = layout.querySelector('form')!;
  assert.ok(
    form.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  assert.equal(aside.textContent, 'Confira os campos antes de salvar.');
  act(() => {
    (view.container.querySelector('.kds-page-header .kds-button') as HTMLButtonElement).click();
  });
  assert.equal(submits, 1);
  view.unmount();
});

test('detail page exposes supplementary content as an aside and keeps status with identification', () => {
  const view = render(
    <DetailPage
      header={{ title: 'Ana', status: <span>Em atendimento</span> }}
      aside={<p>Próximo atendimento</p>}
    >
      <section>Informações</section>
    </DetailPage>,
  );
  assert.match(
    view.container.querySelector('header')?.textContent ?? '',
    /Em atendimento/,
  );
  assert.equal(
    view.container.querySelector('aside')?.textContent,
    'Próximo atendimento',
  );
  view.unmount();
});

test('composite controls receive required, error and description associations from Field', () => {
  const options = [{ value: 'a', label: 'Amil' }];
  const controls = [
    <Select options={options} />,
    <Combobox value="a" options={options} onChange={() => undefined} />,
    <MultiSelect values={['a']} options={options} onChange={() => undefined} />,
    <DateTimePicker />,
  ];
  for (const control of controls) {
    const view = render(
      <DesignSystemProvider>
        <Field
          label="Operadora"
          required
          error="Revise a seleção"
          description="Escolha uma opção para continuar"
        >
          {control}
        </Field>
      </DesignSystemProvider>,
    );
    const label = view.container.querySelector('label')!;
    const button = document.getElementById(label.htmlFor)!;
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.getAttribute('aria-invalid'), 'true');
    assert.equal(button.getAttribute('aria-required'), 'true');
    const descriptions = (button.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    assert.match(descriptions, /Revise a seleção/);
    assert.match(descriptions, /Escolha uma opção/);
    view.unmount();
  }
});

test('switch label is an operable and accessible control label', () => {
  const view = render(<Switch label="Receber resumo" />);
  const label =
    view.container.querySelector<HTMLLabelElement>('.kds-switch-label')!;
  const input = view.container.querySelector<HTMLInputElement>('input')!;
  assert.equal(label.htmlFor, input.id);
  act(() => label.click());
  assert.equal(input.checked, true);
  view.unmount();
});

test('provider gives portal dialogs their own theme even when another light root is present', () => {
  const view = render(
    <>
      <div className="painel-theme theme-light" />
      <DesignSystemProvider theme="dark">
        <Dialog open onOpenChange={() => undefined}>
          <DialogTitle>Revisão</DialogTitle>
        </Dialog>
      </DesignSystemProvider>
    </>,
  );
  const host = document.querySelector('.kds-dialog-overlay')!;
  assert.ok(host.classList.contains('theme-dark'));
  assert.ok(host.classList.contains('kds-operational'));
  view.unmount();
});

test('tooltip associates focused trigger and can be dismissed with Escape', async () => {
  vi.useFakeTimers();
  const view = render(
    <DesignSystemProvider theme="dark">
      <Tooltip delayMs={0} content="Adicionar contato">
        <button>Adicionar</button>
      </Tooltip>
    </DesignSystemProvider>,
  );
  try {
    const button = view.container.querySelector('button')!;
    act(() => button.focus());
    await act(async () => vi.advanceTimersByTimeAsync(1));
    const tip = document.querySelector('[role="tooltip"]')!;
    assert.ok(tip);
    assert.equal(button.getAttribute('aria-describedby'), tip.id);
    assert.ok(tip.classList.contains('theme-dark'));
    act(() =>
      button.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    assert.equal(document.querySelector('[role="tooltip"]'), null);
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

test('floating content flips and stays inside a narrow visible viewport', () => {
  const trigger = {
    left: 280,
    right: 312,
    top: 700,
    bottom: 740,
    width: 32,
    height: 40,
  };
  const content = {
    left: 0,
    right: 280,
    top: 0,
    bottom: 200,
    width: 280,
    height: 200,
  };
  const position = getOverlayPosition(trigger, content, 'bottom', 'start', 8, {
    width: 320,
    height: 768,
  });
  assert.equal(position.side, 'top');
  assert.ok(position.left >= 8);
  assert.ok(position.left + 280 <= 312);
  assert.ok(position.top + 200 < 700);
  const keyboard = getOverlayPosition(trigger, content, 'bottom', 'center', 8, {
    width: 320,
    height: 350,
    top: 300,
  });
  assert.ok(keyboard.top >= 308);
  assert.ok(keyboard.top + 200 <= 642);
});

test('nested popovers keep the parent open on child interaction and Escape closes one layer', () => {
  const view = render(
    <Popover defaultOpen>
      <PopoverTrigger>
        <button>Período</button>
      </PopoverTrigger>
      <PopoverContent aria-label="Intervalo">
        <Popover defaultOpen>
          <PopoverTrigger>
            <button>Calendário</button>
          </PopoverTrigger>
          <PopoverContent aria-label="Dias">
            <button>Hoje</button>
          </PopoverContent>
        </Popover>
      </PopoverContent>
    </Popover>,
  );
  const today = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === 'Hoje',
  )!;
  act(() =>
    today.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })),
  );
  assert.equal(document.querySelectorAll('.kds-popover').length, 2);
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.querySelectorAll('.kds-popover').length, 1);
  assert.equal(
    document.querySelector('.kds-popover')?.getAttribute('aria-label'),
    'Intervalo',
  );
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.querySelector('.kds-popover'), null);
  view.unmount();
});

test('Escape dismisses a modal popover before dismissing its dialog', () => {
  let closed = false;
  const view = render(
    <Dialog
      open
      onOpenChange={() => {
        closed = true;
      }}
    >
      <DialogTitle>Agendar retorno</DialogTitle>
      <Popover defaultOpen>
        <PopoverTrigger>
          <button>Data</button>
        </PopoverTrigger>
        <PopoverContent aria-label="Calendário">
          <button>Hoje</button>
        </PopoverContent>
      </Popover>
    </Dialog>,
  );
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.querySelector('.kds-popover'), null);
  assert.equal(closed, false);
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(closed, true);
  view.unmount();
});
