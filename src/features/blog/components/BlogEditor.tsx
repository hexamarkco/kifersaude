import { FieldLabel, Image, Text, Heading } from '../../../design-system';
import { FileInput } from '../../../design-system';
import { ArrowLeft, Image as ImageIcon, Loader, Save, Tag, Upload } from "lucide-react";
import { useMemo, useRef, type ChangeEvent } from "react";
import type ReactQuill from "react-quill";
import { RichTextEditor } from '../../../design-system';

import {
  Button,
  Checkbox,
  Field,
  Input,
  PageHeader,
  PageActions,
  Surface,
  Textarea,
  IconButton,
  FilterSelect,
} from "../../../design-system";
import {
  BLOG_CATEGORY_OPTIONS,
  BLOG_EDITOR_FORMATS,
  BLOG_EDITOR_TOOLBAR,
} from "../shared/blogConstants";
import type { BlogPost, BlogPostFormData } from "../shared/blogTypes";

type BlogEditorProps = {
  editingPost: BlogPost | null;
  formData: BlogPostFormData;
  onClose: () => void;
  onContentChange: (value: string) => void;
  onContentImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onFormDataChange: (nextFormData: BlogPostFormData) => void;
  onSave: () => void;
  onTitleChange: (title: string) => void;
  uploadingContent: boolean;
  uploadingCover: boolean;
  validationAttempted: boolean;
};

export default function BlogEditor({
  editingPost,
  formData,
  onClose,
  onContentChange,
  onContentImageUpload,
  onCoverImageUpload,
  onFormDataChange,
  onSave,
  onTitleChange,
  uploadingContent,
  uploadingCover,
  validationAttempted,
}: BlogEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<ReactQuill>(null);
  const modules = useMemo(
    () => ({
      toolbar: BLOG_EDITOR_TOOLBAR,
    }),
    [],
  );
  const handleSaveClick = () => {
    onSave();
    if (!formData.title) titleRef.current?.focus();
    else if (!formData.slug) slugRef.current?.focus();
    else if (!formData.excerpt) excerptRef.current?.focus();
    else if (!formData.content) editorRef.current?.focus();
  };

  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Conteúdo público"
        title={editingPost ? "Editar post" : "Novo post"}
        description="Estruture o artigo, a capa e os metadados para publicação."
        actions={(
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            size="md">
            <ArrowLeft className="kds-control-icon" aria-hidden="true" /> Voltar para artigos
          </Button>
        )}
      />

      <Surface className="space-y-6">
        <div>
          <Heading level={2} size="lg">Informações do artigo</Heading>
          <Text size="sm" tone="muted">Defina como o artigo será identificado no site.</Text>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Título" required error={validationAttempted && !formData.title ? "Informe o título do artigo." : undefined}>
          <Input
            ref={titleRef}
            type="text"
            value={formData.title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Digite o título do post"
          />
        </Field>
        <Field label="Slug (URL)" required error={validationAttempted && !formData.slug ? "Informe a URL do artigo." : undefined} descriptionPlacement="tooltip" description={`URL: /blog/${formData.slug || "slug-do-post"}`}>
          <Input
            ref={slugRef}
            type="text"
            value={formData.slug}
            onChange={(event) =>
              onFormDataChange({ ...formData, slug: event.target.value })
            }
            placeholder="url-amigavel-do-post"
          />
        </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoria *">
            <FilterSelect
              icon={Tag}
              value={formData.category}
              onChange={(value) =>
                onFormDataChange({ ...formData, category: value })
              }
              placeholder="Categoria"
              includePlaceholderOption={false}
              options={[...BLOG_CATEGORY_OPTIONS]}
            />
          </Field>

          <Field label="Tempo de leitura *">
            <Input
              type="text"
              value={formData.read_time}
              onChange={(event) =>
                onFormDataChange({ ...formData, read_time: event.target.value })
              }
              placeholder="5 min"
            />
          </Field>
        </div>

        <div>
          <Heading level={2} size="lg">Imagem de capa</Heading>
          <Text size="sm" tone="muted">Adicione uma imagem por endereço ou arquivo.</Text>
        </div>
        <Field label="Endereço da imagem de capa">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={formData.cover_image_url}
                  onChange={(event) =>
                    onFormDataChange({
                      ...formData,
                      cover_image_url: event.target.value,
                    })
                  }
                  placeholder="https://exemplo.com/imagem.jpg ou faça upload"
                />
              </div>
              {formData.cover_image_url && (
                <IconButton
                  type="button"
                  onClick={() =>
                    window.open(formData.cover_image_url, "_blank")
                  }
                  variant="secondary"
                  aria-label="Abrir imagem de capa"
                 size="md">
                  <ImageIcon aria-hidden="true" />
                </IconButton>
              )}
            </div>

            <div>
              <FieldLabel className="kds-surface kds-surface-warning flex cursor-pointer items-center justify-center border-dashed px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
                <FileInput

                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={onCoverImageUpload}
                  className="sr-only"
                  disabled={uploadingCover}
                />
                {uploadingCover ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[var(--warning-text)]">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span className="font-semibold">Fazendo upload...</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[var(--warning-text)]">
                    <Upload className="h-5 w-5" />
                    <span className="font-semibold">
                      Fazer upload da imagem de capa
                    </span>
                    <span className="text-sm text-[var(--warning-text)]">
                      (JPG, PNG, WEBP, GIF - max 5MB)
                    </span>
                  </div>
                )}
              </FieldLabel>
            </div>

            {formData.cover_image_url && (
              <Surface padding="none" className="mt-2 overflow-hidden">
                <Image
                  src={formData.cover_image_url}
                  alt="Preview"
                  className="h-48 w-full object-cover"
                />
              </Surface>
            )}
          </div>
        </Field>

        <Field label="Resumo (descrição curta)" required error={validationAttempted && !formData.excerpt ? "Informe um resumo do artigo." : undefined} description={`${formData.excerpt.length}/160 caracteres (ideal para SEO)`}>
          <Textarea
            ref={excerptRef}
            value={formData.excerpt}
            onChange={(event) =>
              onFormDataChange({
                ...formData,
                excerpt: event.target.value,
                meta_description: event.target.value,
              })
            }
            rows={3}
            placeholder="Breve descrição do post (aparece na listagem e no Google)"
            maxLength={160}
          />
        </Field>

        <div>
          <Heading level={2} size="lg">Conteúdo</Heading>
          <Text size="sm" tone="muted">Escreva e formate o texto que será publicado.</Text>
        </div>
        <Field label="Conteúdo do artigo *" error={validationAttempted && !formData.content ? "Escreva o conteúdo do artigo." : undefined}>
          <div role="group" aria-label="Conteúdo do artigo">
          <div className="mb-3">
            <FieldLabel className="kds-surface kds-surface-muted inline-flex cursor-pointer items-center px-4 py-2 transition-colors focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
              <FileInput

                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={onContentImageUpload}
                className="sr-only"
                disabled={uploadingContent}
              />
              {uploadingContent ? (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-semibold">
                    Fazendo upload...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    Adicionar imagem ao conteúdo
                  </span>
                </div>
              )}
            </FieldLabel>
            <Text className="mt-1 text-xs text-[var(--text-muted)]">
              Faça upload de imagens que serão inseridas no final do editor.
              Você pode movê-las depois.
            </Text>
          </div>

            <RichTextEditor
              ref={editorRef}
              theme="snow"
              value={formData.content}
              onChange={onContentChange}
              modules={modules}
              formats={BLOG_EDITOR_FORMATS}
              placeholder="Escreva o conteúdo do artigo aqui..."
              className="kds-blog-editor"
            />
          <Text className="mt-1 text-xs text-[var(--text-muted)]">
            Use o editor para formatar o texto. Adicione títulos (H2, H3),
            listas, links e imagens.
          </Text>
          </div>
        </Field>

        <Surface variant="muted" className="pt-6">
          <Heading level={3} className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            SEO (otimização para Google)
          </Heading>

          <div className="space-y-4">
            <Field label="Meta título (Google)" description={`${formData.meta_title.length}/60 caracteres`}>
              <Input
                type="text"
                value={formData.meta_title}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_title: event.target.value,
                  })
                }
                placeholder="Título que aparece no Google"
                maxLength={60}
              />
            </Field>

            <Field label="Meta descrição (Google)" description={`${formData.meta_description.length}/160 caracteres`}>
              <Textarea
                value={formData.meta_description}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_description: event.target.value,
                  })
                }
                rows={2}
                placeholder="Descrição que aparece no Google"
                maxLength={160}
              />
            </Field>
          </div>
        </Surface>

        <div className="flex items-center gap-2">
          <Checkbox
            id="published"
            checked={formData.published}
            onChange={(event) =>
              onFormDataChange({ ...formData, published: event.target.checked })
            }
          />
          <FieldLabel
            htmlFor="published"
            className="text-sm font-medium text-[var(--text-secondary)]"
          >
            Publicar imediatamente (visível no site e no Google)
          </FieldLabel>
        </div>

        <PageActions placement="form" primary={{ label: editingPost ? "Atualizar post" : "Criar post", icon: Save, onClick: handleSaveClick }} secondary={[{ label: "Cancelar", onClick: onClose }]} />
      </Surface>
    </div>
  );
}
