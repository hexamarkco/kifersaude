import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { BreadcrumbLink, FormActions, NavigationList } from '../../index';

test('FormActions submits its form, cancels without submitting, and blocks both while saving', () => {
  let saves = 0;
  let cancellations = 0;
  const cancel = () => {
    cancellations += 1;
  };
  const view = render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        saves += 1;
      }}
    >
      <FormActions onCancel={cancel} />
    </form>,
  );
  const [cancelButton, submitButton] =
    view.container.querySelectorAll('button');
  act(() => cancelButton.click());
  assert.equal(cancellations, 1);
  assert.equal(saves, 0);
  act(() => submitButton.click());
  assert.equal(saves, 1);
  view.unmount();

  const busy = render(<FormActions loading onCancel={cancel} />);
  const buttons = busy.container.querySelectorAll('button');
  assert.ok([...buttons].every((button) => button.disabled));
  assert.equal(buttons[1].getAttribute('aria-busy'), 'true');
  busy.unmount();
});

test('NavigationList preserves destinations and modified clicks and marks the current section', () => {
  const destinations: string[] = [];
  const view = render(
    <NavigationList
      items={[
        { id: 'a', label: 'Contatos', href: '#contacts' },
        { id: 'b', label: 'Configurações', href: '#settings' },
      ]}
      activeId="a"
      ariaLabel="Áreas do CRM"
      onNavigate={(id) => destinations.push(id)}
    />,
  );
  const links = view.container.querySelectorAll('a');
  assert.equal(links[0].getAttribute('aria-current'), 'page');
  assert.equal(links[1].hasAttribute('aria-current'), false);
  assert.equal(links[1].getAttribute('href'), '#settings');
  act(() => links[1].click());
  assert.deepEqual(destinations, ['b']);
  const modifiedClick = new MouseEvent('click', {
    ctrlKey: true,
    cancelable: true,
    bubbles: true,
  });
  act(() => links[1].dispatchEvent(modifiedClick));
  assert.equal(modifiedClick.defaultPrevented, false);
  assert.equal(destinations.length, 1);
  view.unmount();
});

test('BreadcrumbLink forwards clicks on links so local navigation can preserve state', () => {
  let clicks = 0;
  const view = render(
    <BreadcrumbLink
      href="#contacts"
      onClick={(event) => {
        event.preventDefault();
        clicks += 1;
      }}
    >
      Contatos
    </BreadcrumbLink>,
  );
  act(() => view.container.querySelector('a')!.click());
  assert.equal(clicks, 1);
  view.unmount();
});
