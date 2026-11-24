import { useMemo, useRef, type ChangeEvent, type ElementRef } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, ImagePlus, Save, Upload } from 'lucide-react';
import {
  Badge, Button, Field, FieldLabel, FileInput, Heading, Image, Input, LoadingState, PageHeader,
  RichTextEditor, Select, Surface, Text, Textarea,
} from '../../../design-system';
import { BLOG_CATEGORY_OPTIONS, BLOG_EDITOR_FORMATS, BLOG_EDITOR_TOOLBAR } from '../shared/blogConstants';
import type { BlogPost, BlogPostFormData } from '../shared/blogTypes';

type BlogEditorProps = {
  editingPost: BlogPost | null;
  formData: BlogPostFormData;
  onClose: () => void;
  onContentChange: (value: string) => void;
  onContentImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onFormDataChange: (nextFormData: BlogPostFormData) => void;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onTitleChange: (title: string) => void;
  uploadingContent: boolean;
  uploadingCover: boolean;
  validationAttempted: boolean;
  saving: boolean;
};

export default function BlogEditor({
  editingPost, formData, onClose, onContentChange, onContentImageUpload, onCoverImageUpload, onFormDataChange,
  onPreview, onSave, onPublish, onTitleChange, uploadingContent, uploadingCover, validationAttempted, saving,
}: BlogEditorProps) {
  const uploading = uploadingCover || uploadingContent;
  const busy = saving || uploading;
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<ElementRef<typeof RichTextEditor>>(null);
  const modules = useMemo(() => ({ toolbar: BLOG_EDITOR_TOOLBAR }), []);
  const save = (action: () => void) => {
    action();
    if (!formData.title) titleRef.current?.focus();
    else if (!formData.slug) slugRef.current?.focus();
    else if (!formData.excerpt) excerptRef.current?.focus();
    else if (!formData.content) editorRef.current?.focus();
  };
  const published = Boolean(editingPost?.published);
  const categories = formData.category && !BLOG_CATEGORY_OPTIONS.some(({ value }) => value === formData.category)
    ? [...BLOG_CATEGORY_OPTIONS, { value: formData.category, label: formData.category }]
    : BLOG_CATEGORY_OPTIONS;

  return (
    <div className="panel-page-shell kds-blog-workspace kds-blog-editor-page space-y-5">
      <PageHeader title="Cuidado começa com informação." description="Escreva, revise e prepare a publicação do seu artigo." />
      <div className="kds-blog-editor-toolbar">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          <ArrowLeft className="kds-control-icon" aria-hidden="true" /> Voltar para artigos
        </Button>
        <div className="kds-blog-editor-actions">
          <Badge tone={published ? 'success' : 'neutral'}>{published ? 'Publicado' : 'Rascunho em edição'}</Badge>
          <Button variant="secondary" onClick={onPreview} disabled={busy}><Eye className="kds-control-icon" aria-hidden="true" />Prévia</Button>
          <Button variant={published ? 'primary' : 'secondary'} onClick={() => save(onSave)} disabled={busy} loading={saving}>
            <Save className="kds-control-icon" aria-hidden="true" />{saving ? 'Salvando…' : published ? 'Salvar alterações' : 'Salvar rascunho'}
          </Button>
          {!published && <Button onClick={() => save(onPublish)} disabled={busy}><ArrowUpRight className="kds-control-icon" aria-hidden="true" />Publicar</Button>}
        </div>
      </div>
      {uploading && <Text size="sm" tone="muted" role="status">Aguarde o envio da imagem para salvar ou sair.</Text>}

      <fieldset disabled={saving} className="kds-blog-editor-layout">
        <Surface padding="none" className="kds-blog-editor-content">
          <div className="kds-blog-editor-title">
            <Field label="Título do artigo" htmlFor="blog-title" required error={validationAttempted && !formData.title ? 'Informe o título do artigo.' : undefined}>
              <Input id="blog-title" ref={titleRef} value={formData.title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Digite o título do artigo" />
            </Field>
          </div>
          <div role="group" aria-label="Conteúdo do artigo">
            <RichTextEditor ref={editorRef} readOnly={saving} theme="snow" value={formData.content} onChange={onContentChange}
              modules={modules} formats={BLOG_EDITOR_FORMATS} placeholder="Escreva o conteúdo do artigo aqui…" className="kds-blog-editor" />
            <div className="kds-blog-editor-attachments">
              <FieldLabel className="kds-blog-upload-inline">
                <FileInput accept="image/jpeg,image/png,image/webp,image/gif" onChange={onContentImageUpload} className="sr-only" disabled={uploadingContent} />
                <LoadingState active={uploadingContent} label="Adicionando imagem…" fallback={() => <><Upload className="kds-control-icon" aria-hidden="true" />Adicionar imagem ao conteúdo</>} />
              </FieldLabel>
              {validationAttempted && !formData.content && <Text size="sm" tone="danger" role="alert">Escreva o conteúdo do artigo.</Text>}
            </div>
          </div>
        </Surface>

        <aside className="kds-blog-editor-settings" aria-label="Detalhes da publicação">
          <Surface className="space-y-4">
            <Heading level={2} size="sm">Detalhes da publicação</Heading>
            <Field label="Categoria" htmlFor="blog-category" required>
              <Select id="blog-category" value={formData.category} options={categories}
                onChange={({ target }) => onFormDataChange({ ...formData, category: target.value })} />
            </Field>
            <Field label="Endereço do artigo" htmlFor="blog-slug" required hint="Aparece depois de /blog/."
              error={validationAttempted && !formData.slug ? 'Informe o endereço do artigo.' : undefined}>
              <Input id="blog-slug" ref={slugRef} value={formData.slug}
                onChange={(event) => onFormDataChange({ ...formData, slug: event.target.value })} placeholder="endereco-do-artigo" />
            </Field>
            <Field label="Resumo" htmlFor="blog-excerpt" required error={validationAttempted && !formData.excerpt ? 'Informe um resumo do artigo.' : undefined}>
              <Textarea id="blog-excerpt" ref={excerptRef} value={formData.excerpt} rows={3} maxLength={160}
                onChange={(event) => onFormDataChange({ ...formData, excerpt: event.target.value, meta_description: event.target.value })} />
            </Field>
            <Field label="Tempo de leitura" htmlFor="blog-read-time" required>
              <Input id="blog-read-time" value={formData.read_time} placeholder="5 min" onChange={(event) => onFormDataChange({ ...formData, read_time: event.target.value })} />
            </Field>
            <div className="space-y-3">
              <Text size="sm" weight="semibold">Imagem de capa</Text>
              <FieldLabel className="kds-blog-cover-upload">
                <FileInput accept="image/jpeg,image/png,image/webp,image/gif" onChange={onCoverImageUpload} className="sr-only" disabled={uploadingCover} />
                <LoadingState active={uploadingCover} label="Enviando imagem…" fallback={() => (
                  <><ImagePlus aria-hidden="true" /><span>{formData.cover_image_url ? 'Trocar imagem de capa' : 'Escolher imagem de capa'}</span><small>JPG, PNG, WEBP ou GIF · até 5 MB</small></>
                )} />
              </FieldLabel>
              {formData.cover_image_url && <Image src={formData.cover_image_url} alt="Imagem de capa" className="kds-blog-cover-thumbnail" />}
              <Field label="Endereço da imagem" htmlFor="article-cover-url">
                <Input id="article-cover-url" value={formData.cover_image_url} placeholder="https://…"
                  onChange={(event) => onFormDataChange({ ...formData, cover_image_url: event.target.value })} />
              </Field>
            </div>
          </Surface>

          <Surface className="space-y-4">
            <Heading level={2} size="sm">Busca e compartilhamento</Heading>
            <Field label="Título para os buscadores" htmlFor="blog-meta-title" hint={`${formData.meta_title.length}/60 caracteres`}>
              <Input id="blog-meta-title" value={formData.meta_title} maxLength={60}
                onChange={(event) => onFormDataChange({ ...formData, meta_title: event.target.value })} />
            </Field>
            <Field label="Descrição para os buscadores" htmlFor="blog-meta-description" hint={`${formData.meta_description.length}/160 caracteres`}>
              <Textarea id="blog-meta-description" value={formData.meta_description} rows={3} maxLength={160}
                onChange={(event) => onFormDataChange({ ...formData, meta_description: event.target.value })} />
            </Field>
          </Surface>
        </aside>
      </fieldset>
    </div>
  );
}
