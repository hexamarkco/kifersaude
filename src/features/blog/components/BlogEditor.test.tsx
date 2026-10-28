import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import BlogEditor from './BlogEditor';
import { createEmptyBlogFormData } from '../shared/blogUtils';

vi.mock('../../../design-system/components/RichTextEditor', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />) };
});

test('blocks saving and leaving while an image upload is in progress', () => {
  const view = render(<BlogEditor editingPost={null} formData={createEmptyBlogFormData()} saving={false}
    validationAttempted={false} uploadingCover uploadingContent={false} onClose={vi.fn()} onSave={vi.fn()}
    onContentChange={vi.fn()} onContentImageUpload={vi.fn()} onCoverImageUpload={vi.fn()}
    onFormDataChange={vi.fn()} onTitleChange={vi.fn()} />);
  try {
    assert.ok(view.container.textContent?.includes('Aguarde o envio da imagem para salvar ou sair.'));
    for (const label of ['Salvar', 'Cancelar', 'Voltar para artigos']) {
      const button = Array.from(view.container.querySelectorAll('button')).find(item => item.textContent?.includes(label));
      assert.ok(button?.disabled, `${label} deve estar desabilitado`);
    }
  } finally { view.unmount(); }
});
