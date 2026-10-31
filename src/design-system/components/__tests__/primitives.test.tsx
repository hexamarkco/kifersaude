import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { Filter, Settings } from 'lucide-react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import {
  Button,
  Combobox,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  FilterMultiSelect,
  FilterSelect,
  Field,
  IconButton,
  Input,
  Pagination,
  SegmentedControl,
  Select,
  SortableTableHead,
  Tabs,
} from '../../index';

const click = (element: Element | null) => {
  assert.ok(element instanceof HTMLElement);
  act(() => element.click());
};

const keyDown = (element: EventTarget, key: string) => {
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
};

test('filtro distingue a opção neutra de uma seleção ativa', () => {
  function Example() {
    const [value, setValue] = useState('todos');
    return <FilterSelect icon={Filter} placeholder="Todos os status" value={value} onChange={setValue} includePlaceholderOption={false} neutralValues={['todos']} options={[{ value: 'todos', label: 'Todos os status' }, { value: 'ativo', label: 'Ativo' }]} />;
  }
  const view = render(<Example />);
  try {
    const trigger = view.container.querySelector<HTMLButtonElement>('.kds-filter-trigger')!;
    assert.equal(trigger.classList.contains('is-active'), false);
    click(trigger);
    click(Array.from(document.body.querySelectorAll('[role="option"]')).find(option => option.textContent?.trim() === 'Ativo') ?? null);
    assert.equal(trigger.classList.contains('is-active'), true);
    click(trigger);
    click(Array.from(document.body.querySelectorAll('[role="option"]')).find(option => option.textContent?.trim() === 'Todos os status') ?? null);
    assert.equal(trigger.classList.contains('is-active'), false);
  } finally { view.unmount(); }
});

test('controls share the sm/md/lg scale and loading semantics', () => {
  const { container, unmount } = render(
    <div>
      <Button size="sm">Pequeno</Button>
      <Button size="md" loading><Settings />Médio</Button>
      <Button size="lg">Grande</Button>
      <IconButton size="md" aria-label="Configurações"><Settings /></IconButton>
    </div>,
  );
  const buttons = container.querySelectorAll('button');
  assert.match(buttons[0].className, /kds-control-sm/);
  assert.match(buttons[1].className, /kds-control-md/);
  assert.equal(buttons[1].disabled, true);
  assert.equal(buttons[1].getAttribute('aria-busy'), 'true');
  assert.equal(buttons[1].getAttribute('data-loading'), 'true');
  assert.ok(buttons[1].querySelector('.kds-button-spinner'));
  assert.ok(buttons[1].querySelector('.kds-button-content'));
  assert.match(buttons[2].className, /kds-control-lg/);
  assert.match(buttons[3].className, /kds-icon-button/);
  assert.equal(buttons[3].getAttribute('aria-label'), 'Configurações');
  unmount();
});

test('sortable table headers remain interactive without a visible sort arrow', () => {
  let sorted = false;
  const { container, unmount } = render(
    <table><thead><tr><SortableTableHead label="Contrato" sortDirection={null} onSort={() => { sorted = true; }} /></tr></thead></table>,
  );
  const sortButton = container.querySelector<HTMLButtonElement>('button[aria-label="Ordenar por Contrato"]');
  assert.ok(sortButton);
  assert.equal(sortButton.querySelector('svg'), null);
  assert.equal(sortButton.closest('th')?.getAttribute('aria-sort'), 'none');
  click(sortButton);
  assert.equal(sorted, true);
  unmount();
});

test('sortable table headers expose the active sort direction accessibly without an icon', () => {
  const onSort = () => undefined;
  const idle = render(
    <table><thead><tr><SortableTableHead label="Contrato" sortDirection={null} onSort={onSort} /></tr></thead></table>,
  );
  const sortButton = idle.container.querySelector<HTMLButtonElement>('button[aria-label="Ordenar por Contrato"]');
  assert.ok(sortButton);
  assert.equal(sortButton.querySelector('svg'), null);
  assert.equal(sortButton.closest('th')?.getAttribute('aria-sort'), 'none');

  idle.unmount();
  const active = render(
    <table><thead><tr><SortableTableHead label="Contrato" sortDirection="asc" onSort={onSort} /></tr></thead></table>,
  );
  const activeSortButton = active.container.querySelector<HTMLButtonElement>('button[aria-label="Ordenar por Contrato"]');
  assert.ok(activeSortButton);
  assert.equal(activeSortButton.querySelector('svg'), null);
  assert.equal(activeSortButton.closest('th')?.getAttribute('aria-sort'), 'ascending');
  active.unmount();
});

test('Field associates label, hint, required, disabled and error semantics', () => {
  const { container, unmount } = render(
    <Field label="E-mail" hint="Usado nas notificações" required disabled>
      <Input type="email" />
    </Field>,
  );
  const input = container.querySelector('input');
  const label = container.querySelector('label');
  const hint = container.querySelector('.kds-field-description');
  assert.ok(input && label && hint);
  assert.equal(label.htmlFor, input.id);
  assert.equal(input.required, true);
  assert.equal(input.disabled, true);
  assert.equal(input.getAttribute('aria-describedby'), hint.id);
  unmount();
});

test('Tabs and SegmentedControl support roving keyboard selection', () => {
  function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');
    return (
      <>
        <Tabs value={value} onChange={setValue} items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />
        <SegmentedControl value={value} onChange={setValue} items={[{ id: 'a', label: 'Grade' }, { id: 'b', label: 'Lista' }]} />
      </>
    );
  }
  const { container, unmount } = render(<Harness />);
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  keyDown(tabs[0], 'ArrowRight');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, tabs[1]);
  assert.match(tabs[2].className, /kds-tab/);
  unmount();
});

test('Tabs keeps the selected tab visible when the selection changes', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  const rect = (left: number, right: number, width: number): DOMRect => ({
    x: left,
    y: 0,
    left,
    right,
    top: 0,
    bottom: 40,
    width,
    height: 40,
    toJSON: () => ({}),
  });

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      if (this.getAttribute('role') === 'tablist') return rect(0, 100, 100);
      if (this.getAttribute('role') === 'tab') {
        const list = this.parentElement as HTMLElement;
        const index = Array.from(list.children).indexOf(this);
        const left = index * 70 - list.scrollLeft;
        return rect(left, left + 70, 70);
      }
      return originalGetBoundingClientRect.call(this);
    },
  });

  const items = [
    { id: 'a', label: 'Geral' },
    { id: 'b', label: 'Usuários' },
    { id: 'c', label: 'Formulários' },
  ] as const;
  function Harness() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('c');
    return <Tabs value={value} onChange={setValue} items={items} />;
  }

  try {
    const view = render(<Harness />);
    const list = view.container.querySelector<HTMLElement>('[role="tablist"]');
    assert.ok(list);
    assert.equal(list.scrollLeft, 114);

    click(view.container.querySelectorAll('[role="tab"]')[0]);
    assert.equal(list.scrollLeft, 0);
    view.unmount();
  } finally {
    if (originalDescriptor) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalDescriptor);
  }
});

test('Select and Combobox expose listbox semantics and commit selection', () => {
  function Harness() {
    const [selectValue, setSelectValue] = useState('');
    const [comboValue, setComboValue] = useState('');
    const options = [{ value: 'amil', label: 'Amil' }, { value: 'bradesco', label: 'Bradesco' }];
    return (
      <>
        <Select aria-label="Operadora" value={selectValue} onChange={(event) => setSelectValue(event.target.value)} options={options} />
        <Combobox aria-label="Operadora pesquisável" value={comboValue} onChange={setComboValue} options={options} />
      </>
    );
  }
  const { container, unmount } = render(<Harness />);
  const triggers = container.querySelectorAll<HTMLButtonElement>('[aria-haspopup="listbox"]');
  click(triggers[0]);
  const selectList = document.body.querySelector('[role="listbox"]');
  assert.ok(selectList);
  click(Array.from(selectList.querySelectorAll('[role="option"]')).find((option) => option.textContent?.includes('Bradesco')) ?? null);
  assert.match(triggers[0].textContent ?? '', /Bradesco/);

  click(triggers[1]);
  const lists = document.body.querySelectorAll('[role="listbox"]');
  const comboList = lists[lists.length - 1];
  click(Array.from(comboList.querySelectorAll('[role="option"]')).find((option) => option.textContent?.includes('Amil')) ?? null);
  assert.match(triggers[1].textContent ?? '', /Amil/);
  unmount();
});

test('FilterMultiSelect keeps choices pending until applied and discards them on Escape', () => {
  const applied: string[][] = [];
  function Harness() {
    const [values, setValues] = useState<string[]>([]);
    return (
      <FilterMultiSelect
        icon={Filter}
        options={[{ value: 'new', label: 'Novo' }, { value: 'active', label: 'Em andamento' }]}
        placeholder="Todos os status"
        dialogTitle="Filtrar por status"
        values={values}
        onChange={(nextValues) => {
          applied.push(nextValues);
          setValues(nextValues);
        }}
      />
    );
  }

  const { container, unmount } = render(<Harness />);
  const trigger = container.querySelector<HTMLButtonElement>('.kds-filter-trigger');
  assert.ok(trigger);
  act(() => trigger.focus());
  click(trigger);
  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector('h2')?.textContent, 'Filtrar por status');
  const pendingCheckbox = Array.from(dialog.querySelectorAll('label')).find((option) => option.textContent?.includes('Em andamento'))?.querySelector('input');
  click(pendingCheckbox ?? null);
  keyDown(document, 'Escape');
  assert.deepEqual(applied, []);
  assert.match(trigger.textContent ?? '', /Todos os status/);
  assert.equal(document.activeElement, trigger);

  act(() => trigger.focus());
  click(trigger);
  const reopenedDialog = document.body.querySelector('[role="dialog"]');
  assert.ok(reopenedDialog);
  const newCheckbox = Array.from(reopenedDialog.querySelectorAll('label')).find((option) => option.textContent?.includes('Novo'))?.querySelector('input');
  click(newCheckbox ?? null);
  click(Array.from(reopenedDialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Aplicar filtros')) ?? null);
  assert.deepEqual(applied, [['new']]);
  assert.match(trigger.textContent ?? '', /Novo/);
  unmount();
});

test('Dialog and Drawer trap presentation in modal semantics and close with Escape', () => {
  function Harness() {
    const [dialogOpen, setDialogOpen] = useState(true);
    return dialogOpen ? (
      <Dialog open onOpenChange={setDialogOpen} presentation="workspace">
        <DialogHeader><DialogTitle>Editor</DialogTitle></DialogHeader>
        <DialogBody><Button>Continuar</Button></DialogBody>
      </Dialog>
    ) : <span>Fechado</span>;
  }
  const dialogRender = render(<Harness />);
  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.match(dialog.className, /kds-dialog-workspace/);
  keyDown(document, 'Escape');
  assert.match(dialogRender.container.textContent ?? '', /Fechado/);
  dialogRender.unmount();

  const drawerRender = render(<Drawer open onOpenChange={() => {}} side="right"><DrawerBody>Detalhes</DrawerBody></Drawer>);
  const drawer = document.body.querySelector('[role="dialog"]');
  assert.ok(drawer);
  assert.match(drawer.className, /kds-drawer-right/);
  drawerRender.unmount();
});

test('first-content dialog focus stays on the dialog while its body is loading', async () => {
  const view = render(
    <Dialog open onOpenChange={() => undefined} initialFocus="first-content">
      <DialogHeader>
        <DialogTitle>Agenda do WhatsApp</DialogTitle>
        <DialogDescription>Consulte os lembretes da conversa.</DialogDescription>
      </DialogHeader>
      <DialogBody>Carregando agenda...</DialogBody>
    </Dialog>,
  );
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  assert.equal(document.activeElement, dialog);
  assert.equal(document.body.querySelector('[role="tooltip"]'), null);
  view.unmount();
});

test('first-content dialog focus selects its first available control', async () => {
  const view = render(
    <Dialog open onOpenChange={() => undefined} initialFocus="first-content">
      <DialogHeader><DialogTitle>Agenda do WhatsApp</DialogTitle></DialogHeader>
      <DialogBody><Button>Dia anterior</Button></DialogBody>
    </Dialog>,
  );
  const firstContentButton = document.body.querySelector<HTMLButtonElement>('.kds-dialog-body button');
  assert.ok(firstContentButton);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  assert.equal(document.activeElement, firstContentButton);
  view.unmount();
});

test('first-content dialog focus skips the hidden native select and focuses its visible trigger', async () => {
  const view = render(
    <Dialog open onOpenChange={() => undefined} initialFocus="first-content">
      <DialogHeader><DialogTitle>Editar mensagem rápida</DialogTitle></DialogHeader>
      <DialogBody>
        <Select
          aria-label="Resposta rápida"
          value="welcome"
          onChange={() => undefined}
          options={[{ value: 'welcome', label: 'Boas-vindas' }]}
        />
        <Button>Cancelar</Button>
      </DialogBody>
    </Dialog>,
  );
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  const hiddenSelect = dialog?.querySelector<HTMLSelectElement>('select[aria-hidden="true"]');
  const visibleTrigger = dialog?.querySelector<HTMLButtonElement>('.kds-select-trigger');
  assert.ok(dialog);
  assert.ok(hiddenSelect);
  assert.ok(visibleTrigger);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  assert.equal(hiddenSelect.tabIndex, -1);
  assert.equal(document.activeElement, visibleTrigger);
  view.unmount();
});

test('dialog helper text is available from the info icon while essential copy can stay visible', () => {
  const view = render(
    <>
      <DialogDescription>Orientação rápida do formulário.</DialogDescription>
      <DialogDescription placement="visible">Esta ação não pode ser desfeita.</DialogDescription>
    </>,
  );
  const help = view.container.querySelector<HTMLButtonElement>('.kds-info-trigger');
  assert.ok(help);
  assert.equal(help.getAttribute('aria-label'), 'Informações sobre esta janela');
  assert.equal(view.container.textContent, 'Esta ação não pode ser desfeita.');
  view.unmount();
});

test('Pagination renders summary, page size, ellipsis and disabled boundaries', () => {
  const { container, unmount } = render(
    <Pagination currentPage={1} totalPages={12} totalItems={230} itemsPerPage={25} onItemsPerPageChange={() => {}} onPageChange={() => {}} />,
  );
  const navigation = container.querySelector('nav');
  assert.equal(navigation?.getAttribute('aria-label'), 'Paginação');
  assert.match(container.textContent ?? '', /1–25 de 230/);
  assert.ok(container.querySelector('.kds-pagination-ellipsis'));
  assert.equal(container.querySelector<HTMLButtonElement>('[aria-label="Pagina anterior"]')?.disabled, true);
  unmount();
});
