import {
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { BlogTabSkeletonList } from "../../../components/ui/panelSkeletons";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import type { AdaptiveLoadingPhase } from "../../../hooks/useAdaptiveLoading";
import type { BlogPost } from "../shared/blogTypes";

type BlogPostsListProps = {
  hasPostsSnapshot: boolean;
  loading: boolean;
  loadingPhase: AdaptiveLoadingPhase;
  onCreatePost: () => void;
  onDeletePost: (id: string) => void;
  onEditPost: (post: BlogPost) => void;
  onSearchTermChange: (value: string) => void;
  onTogglePublish: (post: BlogPost) => void;
  posts: BlogPost[];
  searchTerm: string;
};

export default function BlogPostsList({
  hasPostsSnapshot,
  loading,
  loadingPhase,
  onCreatePost,
  onDeletePost,
  onEditPost,
  onSearchTermChange,
  onTogglePublish,
  posts,
  searchTerm,
}: BlogPostsListProps) {
  return (
    <div className="panel-page-shell space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Blog</h2>
          <button
            type="button"
            onClick={onCreatePost}
            className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-700"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Post
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Buscar por titulo ou categoria..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <PanelAdaptiveLoadingFrame
          loading={loading}
          phase={loadingPhase}
          hasContent={hasPostsSnapshot}
          skeleton={<BlogTabSkeletonList />}
          stageLabel="Carregando posts do blog..."
          overlayLabel="Atualizando posts..."
          stageClassName="min-h-[360px]"
        >
          {posts.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-500">Nenhum post encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-lg border border-slate-200 p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-20 w-32 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-amber-100">
                        <FileText className="h-8 w-8 text-orange-400" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                              {post.category}
                            </span>
                            <span
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                post.published
                                  ? "bg-green-100 text-green-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {post.published ? "Publicado" : "Rascunho"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {post.read_time}
                            </span>
                          </div>

                          <h3 className="mb-1 truncate text-lg font-bold text-slate-900">
                            {post.title}
                          </h3>
                          <p className="mb-2 line-clamp-2 text-sm text-slate-600">
                            {post.excerpt}
                          </p>

                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>Visualizacoes: {post.views_count}</span>
                            <span>
                              Criado:{" "}
                              {new Date(post.created_at).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(`/blog/${post.slug}`, "_blank")
                            }
                            className="p-2 text-slate-400 transition-colors hover:text-blue-600"
                            title="Visualizar"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePublish(post)}
                            className={`p-2 transition-colors ${
                              post.published
                                ? "text-green-600 hover:text-slate-400"
                                : "text-slate-400 hover:text-green-600"
                            }`}
                            title={post.published ? "Despublicar" : "Publicar"}
                          >
                            {post.published ? (
                              <Eye className="h-5 w-5" />
                            ) : (
                              <EyeOff className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditPost(post)}
                            className="p-2 text-slate-400 transition-colors hover:text-orange-600"
                            title="Editar"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePost(post.id)}
                            className="p-2 text-slate-400 transition-colors hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelAdaptiveLoadingFrame>
      </div>
    </div>
  );
}
