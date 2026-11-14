import assert from 'node:assert/strict';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';

import { KIFER_THEME_COLORS } from '../../../design-system';
import FormPage from '../FormPage';

vi.mock('../../../lib/formsService', () => ({
  formsService: { getPublicForm: vi.fn(async () => ({ form: null, steps: [] })) },
}));

test('form canvas follows the theme at document edges and restores the previous page on exit', async () => {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = 'white';
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0';
  document.head.append(meta, viewport);
  const elements = [document.documentElement, document.body];
  const originalStyles = elements.map((element) => element.getAttribute('style'));
  const originalTheme = localStorage.getItem('kifer-forms-theme');
  elements.forEach((element) => {
    element.style.backgroundColor = 'white';
    element.style.colorScheme = 'light';
  });
  localStorage.setItem('kifer-forms-theme', 'dark');

  const view = render(
    <MemoryRouter initialEntries={['/forms/mobile']}>
      <Routes><Route path="/forms/:slug" element={<FormPage />} /></Routes>
    </MemoryRouter>,
  );
  try {
    await act(async () => { await Promise.resolve(); });
    assert.equal(meta.content, KIFER_THEME_COLORS.darkCanvas);
    assert.match(viewport.content, /viewport-fit=cover/);
    elements.forEach((element) => {
      assert.equal(element.style.colorScheme, 'dark');
      assert.notEqual(element.style.backgroundColor, 'white');
    });
    const toggle = view.container.querySelector<HTMLButtonElement>('[aria-label="Ativar modo claro"]');
    assert.ok(toggle);
    act(() => toggle.click());
    assert.equal(meta.content, KIFER_THEME_COLORS.lightCanvas);
    elements.forEach((element) => assert.equal(element.style.colorScheme, 'light'));
    assert.equal(viewport.content.match(/viewport-fit/g)?.length, 1);
  } finally {
    view.unmount();
    assert.equal(meta.content, 'white');
    assert.equal(viewport.content, 'width=device-width, initial-scale=1.0');
    elements.forEach((element) => {
      assert.equal(element.style.backgroundColor, 'white');
      assert.equal(element.style.colorScheme, 'light');
    });
    elements.forEach((element, index) => {
      const style = originalStyles[index];
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    });
    if (originalTheme === null) localStorage.removeItem('kifer-forms-theme');
    else localStorage.setItem('kifer-forms-theme', originalTheme);
    meta.remove();
    viewport.remove();
  }
});
