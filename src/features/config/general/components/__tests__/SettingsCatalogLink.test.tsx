import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import { SettingsCatalogLink } from '../SettingsCatalogLink';

test('atalho de configurações usa o padding do design system e preserva navegação e contagem', () => {
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
  assert.ok(button.classList.contains('kds-card-padding-sm'));
  assert.equal(button.classList.contains('px-3'), false);
  assert.equal(button.classList.contains('py-3'), false);
  assert.ok(view.container.textContent?.includes('Permissões por área do CRM'));
  assert.ok(view.container.textContent?.includes('3'));

  act(() => button.click());
  assert.equal(navigated, true);
});
