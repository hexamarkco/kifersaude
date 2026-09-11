import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { Settings } from 'lucide-react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import {
  Button,
  Combobox,
  Dialog,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  Field,
  IconButton,
  Input,
  Pagination,
  SegmentedControl,
  Select,
  Tabs,
} from '../../index';

const click = (element: Element | null) => {
  assert.ok(element instanceof HTMLElement);
  act(() => element.click());
};

const keyDown = (element: EventTarget, key: string) => {
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
};

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
