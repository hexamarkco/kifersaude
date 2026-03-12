import { Image as ImageIcon, Loader, Save, Tag, Upload, X } from "lucide-react";
import { useMemo, type ChangeEvent } from "react";
import ReactQuill from "react-quill";

import FilterSingleSelect from "../../../components/FilterSingleSelect";
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
    <div className="panel-page-shell rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">
          {editingPost ? "Editar Post" : "Novo Post"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Titulo *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
            placeholder="Digite o titulo do post"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Slug (URL) *
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(event) =>
              onFormDataChange({ ...formData, slug: event.target.value })
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
            placeholder="url-amigavel-do-post"
          />
          <p className="mt-1 text-xs text-slate-500">
            URL: /blog/{formData.slug || "slug-do-post"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Categoria *
            </label>
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
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Tempo de leitura *
            </label>
            <input
              type="text"
              value={formData.read_time}
              onChange={(event) =>
                onFormDataChange({ ...formData, read_time: event.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
              placeholder="5 min"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Imagem de capa
          </label>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cover_image_url}
                  onChange={(event) =>
                    onFormDataChange({
                      ...formData,
                      cover_image_url: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  placeholder="https://exemplo.com/imagem.jpg ou faca upload"
                />
              </div>
              {formData.cover_image_url && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(formData.cover_image_url, "_blank")
                  }
                  className="rounded-lg bg-slate-100 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-200"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            <div>
              <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 px-4 py-3 transition-colors hover:bg-orange-100">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={onCoverImageUpload}
                  className="hidden"
                  disabled={uploadingCover}
                />
                {uploadingCover ? (
                  <div className="flex items-center gap-2 text-orange-700">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span className="font-semibold">Fazendo upload...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-orange-700">
                    <Upload className="h-5 w-5" />
                    <span className="font-semibold">
                      Fazer upload da imagem de capa
                    </span>
                    <span className="text-sm text-orange-600">
                      (JPG, PNG, WEBP, GIF - max 5MB)
                    </span>
                  </div>
                )}
              </label>
            </div>

            {formData.cover_image_url && (
              <div className="mt-2">
                <img
                  src={formData.cover_image_url}
                  alt="Preview"
                  className="h-48 w-full rounded-lg object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Resumo (descricao curta) *
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(event) =>
              onFormDataChange({
                ...formData,
                excerpt: event.target.value,
                meta_description: event.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
            rows={3}
            placeholder="Breve descricao do post (aparece na listagem e no Google)"
            maxLength={160}
          />
          <p className="mt-1 text-xs text-slate-500">
            {formData.excerpt.length}/160 caracteres (ideal para SEO)
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Conteudo do artigo *
          </label>
          <div className="mb-3">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 transition-colors hover:bg-slate-200">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                onChange={onContentImageUpload}
                className="hidden"
                disabled={uploadingContent}
              />
              {uploadingContent ? (
                <div className="flex items-center gap-2 text-slate-700">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-semibold">
                    Fazendo upload...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-700">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    Adicionar imagem ao conteudo
                  </span>
                </div>
              )}
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Faca upload de imagens que serao inseridas no final do editor.
              Voce pode move-las depois.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-300">
            <ReactQuill
              theme="snow"
              value={formData.content}
              onChange={onContentChange}
              modules={modules}
              formats={BLOG_EDITOR_FORMATS}
              placeholder="Escreva o conteudo do artigo aqui..."
              className="bg-white"
              style={{ height: "400px", marginBottom: "50px" }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Use o editor para formatar o texto. Adicione titulos (H2, H3),
            listas, links e imagens.
          </p>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            SEO (otimizacao para Google)
          </h3>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Meta titulo (Google)
              </label>
              <input
                type="text"
                value={formData.meta_title}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_title: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                placeholder="Titulo que aparece no Google"
                maxLength={60}
              />
              <p className="mt-1 text-xs text-slate-500">
                {formData.meta_title.length}/60 caracteres
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Meta descricao (Google)
              </label>
              <textarea
                value={formData.meta_description}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    meta_description: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Descricao que aparece no Google"
                maxLength={160}
              />
              <p className="mt-1 text-xs text-slate-500">
                {formData.meta_description.length}/160 caracteres
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={formData.published}
            onChange={(event) =>
              onFormDataChange({ ...formData, published: event.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
          />
          <label
            htmlFor="published"
            className="text-sm font-medium text-slate-700"
          >
            Publicar imediatamente (visivel no site e Google)
          </label>
        </div>

        <div className="flex gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
          >
            <Save className="mr-2 h-5 w-5" />
            {editingPost ? "Atualizar Post" : "Criar Post"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-6 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
