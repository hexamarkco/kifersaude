import assert from 'node:assert/strict';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import BlogEditor from './BlogEditor';
import { createEmptyBlogFormData } from '../shared/blogUtils';

vi.mock('../../../design-system/components/RichTextEditor', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef<HTMLDivElement>((_, ref) => <div ref={ref} />) };
});

const editorCallbacks = {
  onClose: vi.fn(), onSave: vi.fn(), onPreview: vi.fn(), onPublish: vi.fn(),
  onContentChange: vi.fn(), onContentImageUpload: vi.fn(), onCoverImageUpload: vi.fn(),
  onFormDataChange: vi.fn(), onTitleChange: vi.fn(),
};

test('blocks saving and leaving while an image upload is in progress', () => {
  const view = render(<BlogEditor editingPost={null} formData={createEmptyBlogFormData()} saving={false}
    validationAttempted={false} uploadingCover uploadingContent={false} {...editorCallbacks} />);
  try {
    assert.ok(view.container.textContent?.includes('Aguarde o envio da imagem para salvar ou sair.'));
    for (const label of ['Salvar', 'Prévia', 'Publicar', 'Voltar para artigos']) {
      const button = Array.from(view.container.querySelectorAll('button')).find(item => item.textContent?.includes(label));
      assert.ok(button?.disabled, `${label} deve estar desabilitado`);
    }
  } finally { view.unmount(); }
});

test('displays the saved category even when it is outside the current category options', () => {
  const view = render(<BlogEditor editingPost={null} formData={{ ...createEmptyBlogFormData(), category: 'Cuidados preventivos' }} saving={false}
    validationAttempted={false} uploadingCover={false} uploadingContent={false} {...editorCallbacks} />);
  try {
    assert.equal(view.container.querySelector('button#blog-category')?.textContent, 'Cuidados preventivos');
  } finally { view.unmount(); }
});
