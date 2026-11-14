import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { cropImageFile, getImageFileError, getSquareImageCrop } from '../imageCrop';

test('enquadra imagens horizontais e verticais sem sair dos limites ao mover e aproximar', () => {
  assert.deepEqual(getSquareImageCrop(1600, 900, { x: 0.5, y: 0.5, zoom: 1 }), { x: 350, y: 0, size: 900 });
  assert.deepEqual(getSquareImageCrop(900, 1600, { x: 0.5, y: 1, zoom: 1 }), { x: 0, y: 700, size: 900 });
  assert.deepEqual(getSquareImageCrop(1600, 900, { x: 1, y: 0, zoom: 2 }), { x: 1150, y: 0, size: 450 });
  for (const width of [100, 900, 1600]) for (const height of [100, 900, 1600]) {
    for (const x of [-1, 0, 0.5, 1, 2]) for (const y of [-1, 0, 0.5, 1, 2]) for (const zoom of [0, 1, 2, 3, 5]) {
      const crop = getSquareImageCrop(width, height, { x, y, zoom });
      assert.ok(crop.size > 0 && crop.x >= 0 && crop.y >= 0);
      assert.ok(crop.x + crop.size <= width && crop.y + crop.size <= height);
    }
  }
});

test('rejeita formatos inválidos e fotos acima de 5 MB antes de abrir o recorte', () => {
  assert.equal(getImageFileError(new File(['foto'], 'foto.jpg', { type: 'image/jpeg' })), null);
  assert.match(getImageFileError(new File(['pdf'], 'documento.pdf', { type: 'application/pdf' })) ?? '', /JPG/);
  assert.match(getImageFileError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })) ?? '', /5 MB/);
});

test('exporta exatamente as coordenadas da prévia, limita a resolução e mantém transparência em PNG', async () => {
  const image = document.createElement('img');
  const drawn: unknown[][] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: (...args: unknown[]) => drawn.push(args) }));
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    assert.equal(this.width, 1024);
    assert.equal(this.height, 1024);
    if (typeof callback === 'function') callback(new Blob(['foto recortada'], { type: typeof type === 'string' ? type : undefined }));
  });
  try {
    const file = await cropImageFile(image, new File(['foto'], 'perfil.webp', { type: 'image/webp' }), { x: 200, y: 100, size: 1500 });
    assert.deepEqual(drawn[0], [image, 200, 100, 1500, 1500, 0, 0, 1024, 1024]);
    assert.equal(file.type, 'image/png');
    assert.equal(file.name, 'perfil-recorte.png');
  } finally { vi.restoreAllMocks(); }
});
