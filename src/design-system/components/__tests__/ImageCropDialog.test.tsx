import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import ImageCropDialog from '../ImageCropDialog';

vi.mock('../../useMinimumLoading', () => ({
  LOADING_CYCLE_MS: 0,
  useMinimumLoading: (loading: boolean) => loading,
}));

function mockPhoto() {
  const photo = document.createElement('img');
  Object.defineProperties(photo, { naturalWidth: { value: 1600 }, naturalHeight: { value: 900 } });
  vi.spyOn(window, 'Image').mockImplementation(function () { return photo; });
  return photo;
}

test('cancelar libera a imagem local sem confirmar nem enviar a foto', () => {
  mockPhoto();
  let confirmed = 0;
  let cancelled = 0;
  const confirm = async () => { confirmed++; };
  const cancel = () => { cancelled++; };
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const view = render(<ImageCropDialog file={new File(['foto'], 'perfil.jpg')} onCancel={cancel} onConfirm={confirm} />);
  try {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent === 'Cancelar');
    act(() => button!.click());
    assert.equal(cancelled, 1);
    assert.equal(confirmed, 0);
    view.unmount();
    assert.equal(revoke.mock.calls.length, 1);
  } finally { vi.restoreAllMocks(); }
});

test('prévia e exportação usam o mesmo recorte, com ajuste por teclado e erro recuperável', async () => {
  const photo = mockPhoto();
  const drawn: unknown[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: (...args: unknown[]) => drawn.push(args) }));
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    if (typeof callback === 'function') callback(new Blob(['foto'], { type: typeof type === 'string' ? type : undefined }));
  });
  const confirmed: File[] = [];
  const confirm = async (file: File) => {
    confirmed.push(file);
    if (confirmed.length === 1) throw new Error('Não foi possível enviar a foto.');
  };
  const view = render(<ImageCropDialog file={new File(['foto'], 'perfil.jpg', { type: 'image/jpeg' })} onCancel={() => undefined} onConfirm={confirm} />);
  try {
    act(() => photo.dispatchEvent(new Event('load')));
    const frame = document.querySelector<HTMLElement>('[aria-label="Prévia do recorte da foto"]')!;
    act(() => frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })));
    const preview = frame.querySelector('img')!;
    assert.equal(preview.style.left, `${-364 / 900 * 100}%`);
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent === 'Usar este recorte')!;
    await act(async () => button.click());
    assert.deepEqual(drawn[0], [photo, 364, 0, 900, 900, 0, 0, 900, 900]);
    assert.equal(confirmed[0].name, 'perfil-recorte.jpg');
    assert.equal(document.querySelector('[role="alert"]')?.textContent, 'Não foi possível enviar a foto.');
    assert.equal(button.disabled, false);
    await act(async () => button.click());
    assert.equal(confirmed.length, 2);
    assert.equal(document.querySelector('[role="alert"]'), null);
  } finally { view.unmount(); vi.restoreAllMocks(); }
});
