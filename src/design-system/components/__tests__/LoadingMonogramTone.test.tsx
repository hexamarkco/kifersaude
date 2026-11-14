import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { getLoadingMonogramTone } from '../../hooks/useLoadingMonogramTone';
import { DesignSystemProvider } from '../DesignSystemProvider';
import { LoadingMonogram } from '../LoadingMonogram';

test('preserva o marrom do fundo escuro em vez de misturar branco e produzir cinza', () => {
  assert.equal(getLoadingMonogramTone([22, 17, 12]), 'hsl(30.00 29.41% 22.67%)');
  assert.equal(getLoadingMonogramTone([247, 244, 239]), 'hsl(37.50 33.33% 73.29%)');
  assert.equal(getLoadingMonogramTone([255, 0, 0]), 'hsl(0.00 100.00% 28.00%)');
});

test('usa a superfície mais próxima, inclusive um botão colorido dentro de um tema escuro', () => {
  const view = render(<div style={{ backgroundColor: 'rgb(22, 17, 12)' }}><div><LoadingMonogram label="Página" /></div><button style={{ backgroundColor: 'rgb(240, 121, 63)' }}><LoadingMonogram label="Botão" /></button></div>);
  try {
    const page = view.container.querySelector<SVGSVGElement>('[aria-label="Página"]')!;
    const button = view.container.querySelector<SVGSVGElement>('[aria-label="Botão"]')!;
    assert.equal(page.style.getPropertyValue('--loading-monogram-color'), getLoadingMonogramTone([22, 17, 12]));
    assert.equal(button.style.getPropertyValue('--loading-monogram-color'), getLoadingMonogramTone([240, 121, 63]));
  } finally { view.unmount(); }
});

test('considera a composição de superfícies transparentes sobre o fundo', () => {
  const view = render(<div style={{ backgroundColor: 'rgb(0, 0, 200)' }}><div style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}><LoadingMonogram /></div></div>);
  try {
    const monogram = view.container.querySelector<SVGSVGElement>('svg')!;
    assert.equal(monogram.style.getPropertyValue('--loading-monogram-color'), getLoadingMonogramTone([127.5, 127.5, 227.5]));
  } finally { view.unmount(); }
});

test('atualiza o tom ao trocar o tema sem recriar a logo animada', () => {
  function Example() {
    const [dark, setDark] = useState(true);
    return <DesignSystemProvider theme={dark ? 'dark' : 'light'} style={{ backgroundColor: dark ? 'rgb(22, 17, 12)' : 'rgb(247, 244, 239)' }}><button onClick={() => setDark(!dark)}>Trocar tema</button><LoadingMonogram /></DesignSystemProvider>;
  }
  const view = render(<Example />);
  try {
    const monogram = view.container.querySelector<SVGSVGElement>('svg')!;
    assert.equal(monogram.style.getPropertyValue('--loading-monogram-color'), getLoadingMonogramTone([22, 17, 12]));
    act(() => view.container.querySelector('button')!.click());
    assert.equal(view.container.querySelector('svg'), monogram);
    assert.equal(monogram.style.getPropertyValue('--loading-monogram-color'), getLoadingMonogramTone([247, 244, 239]));
  } finally { view.unmount(); }
});
