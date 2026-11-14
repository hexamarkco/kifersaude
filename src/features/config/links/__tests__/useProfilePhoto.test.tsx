import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import { useProfilePhoto } from '../hooks/useProfilePhoto';

const upload = vi.hoisted(() => ({ calls: [] as File[], result: { success: false, url: undefined as string | undefined } }));
vi.mock('../../../../lib/imageUploadService', () => ({ uploadLinkPageImage: async (file: File) => { upload.calls.push(file); return upload.result; } }));

test('aguarda a confirmação do recorte e só altera o perfil quando o envio termina com sucesso', async () => {
  const uploaded: string[] = [];
  let controller: ReturnType<typeof useProfilePhoto>;
  function Harness() { controller = useProfilePhoto((url) => uploaded.push(url)); return null; }
  const view = render(<Harness />);
  const original = new File(['original'], 'foto.jpg', { type: 'image/jpeg' });
  const cropped = new File(['recorte'], 'foto-recorte.jpg', { type: 'image/jpeg' });
  try {
    act(() => controller.selectPhoto(original));
    assert.equal(upload.calls.length, 0);
    assert.equal(controller!.file, original);
    act(() => controller.cancel());
    assert.equal(controller!.file, null);
    assert.equal(uploaded.length, 0);
    act(() => controller.selectPhoto(original));
    upload.result = { success: false, url: undefined };
    await act(async () => { await assert.rejects(controller.uploadPhoto(cropped), /Não foi possível enviar/); });
    assert.equal(uploaded.length, 0);
    assert.equal(controller!.file, original);
    assert.equal(controller!.uploading, false);
    upload.result = { success: true, url: 'https://example.com/recorte.jpg' };
    await act(async () => controller.uploadPhoto(cropped));
    assert.equal(upload.calls[1], cropped);
    assert.equal(uploaded[0], 'https://example.com/recorte.jpg');
    assert.equal(controller!.file, null);
  } finally { view.unmount(); upload.calls.length = 0; }
});
