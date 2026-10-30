import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { SettingsCatalogLink } from '../SettingsCatalogLink';

test('atalho de configurações preserva espaçamento por tokens, navegação e contagem', () => {
  let navigated = false;
  const view = render(
    <SettingsCatalogLink
      title="Perfis e acessos"
      description="Permissões por área do CRM"
      ariaLabel="Abrir perfis e acessos"
      count={3}
      onClick={() => { navigated = true; }}
    />,
  );

  const button = view.container.querySelector<HTMLButtonElement>('button[aria-label="Abrir perfis e acessos"]');
  assert.ok(button);
  assert.ok(button.classList.contains('kds-settings-catalog-link'));
  assert.equal(button.classList.contains('kds-card-padding-md'), false);
  const content = button.querySelector<HTMLElement>('.flex.w-full.items-center.justify-between');
  assert.ok(content);
  assert.ok(content.classList.contains('flex'));
  assert.ok(content.classList.contains('kds-card-padding-md'));
  assert.equal(content.textContent?.includes('Perfis e acessos'), true);
  assert.equal(button.classList.contains('px-3'), false);
  assert.equal(button.classList.contains('py-3'), false);
  assert.ok(view.container.textContent?.includes('Permissões por área do CRM'));
  assert.ok(view.container.textContent?.includes('3'));

  act(() => button.click());
  assert.equal(navigated, true);
});
