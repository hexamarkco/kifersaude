import { Image as ImageIcon, Loader, Save, Tag, Upload, X } from "lucide-react";
import { useMemo, type ChangeEvent } from "react";
import ReactQuill from "react-quill";

import FilterSingleSelect from "../../../components/FilterSingleSelect";
import {
  Button,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Surface,
  Textarea,
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
}: BlogEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: BLOG_EDITOR_TOOLBAR,
    }),
    [],
  );

  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Conteudo publico"
        title={editingPost ? "Editar post" : "Novo post"}
        description="Estruture o artigo, a capa e os metadados para publicacao."
        actions={(
          <Button
            type="button"
            onClick={onClose}
            variant="icon"
            size="icon"
            aria-label="Fechar editor"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      />

      <Surface className="space-y-6">
        <Field label="Titulo *">
          <Input
            type="text"
            value={formData.title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Digite o titulo do post"
          />
        </Field>

        <Field label="Slug (URL) *" description={`URL: /blog/${formData.slug || "slug-do-post"}`}>
          <Input
            type="text"
            value={formData.slug}
            onChange={(event) =>
              onFormDataChange({ ...formData, slug: event.target.value })
            }
            placeholder="url-amigavel-do-post"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria *">
            <FilterSingleSelect
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

        <Field label="Imagem de capa">
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
                  placeholder="https://exemplo.com/imagem.jpg ou faca upload"
                />
              </div>
              {formData.cover_image_url && (
                <Button
                  type="button"
                  onClick={() =>
                    window.open(formData.cover_image_url, "_blank")
                  }
                  variant="secondary"
                  size="icon"
                  aria-label="Abrir imagem de capa"
                >
                  <ImageIcon className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div>
              <label className="kds-surface kds-surface-warning flex cursor-pointer items-center justify-center border-dashed px-4 py-3 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={onCoverImageUpload}
                  className="hidden"
                  disabled={uploadingCover}
                />
                {uploadingCover ? (
                  <div className="flex items-center gap-2 text-[var(--warning-text)]">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span className="font-semibold">Fazendo upload...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[var(--warning-text)]">
                    <Upload className="h-5 w-5" />
                    <span className="font-semibold">
                      Fazer upload da imagem de capa
                    </span>
                    <span className="text-sm text-[var(--warning-text)]">
                      (JPG, PNG, WEBP, GIF - max 5MB)
                    </span>
                  </div>
                )}
              </label>
            </div>

            {formData.cover_image_url && (
              <Surface padding="none" className="mt-2 overflow-hidden">
                <img
                  src={formData.cover_image_url}
                  alt="Preview"
                  className="h-48 w-full object-cover"
                />
              </Surface>
            )}
          </div>
        </Field>

        <Field label="Resumo (descricao curta) *" description={`${formData.excerpt.length}/160 caracteres (ideal para SEO)`}>
          <Textarea
            value={formData.excerpt}
            onChange={(event) =>
              onFormDataChange({
                ...formData,
                excerpt: event.target.value,
                meta_description: event.target.value,
              })
            }
            rows={3}
            placeholder="Breve descricao do post (aparece na listagem e no Google)"
            maxLength={160}
          />
        </Field>

        <Field label="Conteudo do artigo *">
          <div className="mb-3">
            <label className="kds-surface kds-surface-muted inline-flex cursor-pointer items-center px-4 py-2 transition-colors">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={onContentImageUpload}
                className="hidden"
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
                    Adicionar imagem ao conteudo
                  </span>
                </div>
              )}
            </label>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Faca upload de imagens que serao inseridas no final do editor.
              Voce pode move-las depois.
            </p>
          </div>

          <Surface variant="default" padding="none" className="overflow-hidden">
            <ReactQuill
              theme="snow"
              value={formData.content}
              onChange={onContentChange}
              modules={modules}
              formats={BLOG_EDITOR_FORMATS}
              placeholder="Escreva o conteudo do artigo aqui..."
              style={{ height: "400px", marginBottom: "50px" }}
            />
          </Surface>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Use o editor para formatar o texto. Adicione titulos (H2, H3),
            listas, links e imagens.
          </p>
        </Field>

        <Surface variant="muted" className="pt-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
            SEO (otimizacao para Google)
          </h3>

          <div className="space-y-4">
            <Field label="Meta titulo (Google)" description={`${formData.meta_title.length}/60 caracteres`}>
              <Input
                type="text"
                value={formData.meta_title}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_title: event.target.value,
                  })
                }
                placeholder="Titulo que aparece no Google"
                maxLength={60}
              />
            </Field>

            <Field label="Meta descricao (Google)" description={`${formData.meta_description.length}/160 caracteres`}>
              <Textarea
                value={formData.meta_description}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_description: event.target.value,
                  })
                }
                rows={2}
                placeholder="Descricao que aparece no Google"
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
          <label
            htmlFor="published"
            className="text-sm font-medium text-[var(--text-secondary)]"
          >
            Publicar imediatamente (visivel no site e Google)
          </label>
        </div>

        <div className="flex gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button
            type="button"
            onClick={onSave}
            fullWidth
            size="lg"
          >
            <Save className="h-5 w-5" />
            {editingPost ? "Atualizar Post" : "Criar Post"}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            size="lg"
          >
            Cancelar
          </Button>
        </div>
      </Surface>
    </div>
  );
}
