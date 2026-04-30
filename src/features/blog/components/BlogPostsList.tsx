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
import { Badge, Button, Input, PageHeader, Surface } from "../../../design-system";
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
      <PageHeader
        eyebrow="Conteudo publico"
        title="Blog"
        description="Gerencie artigos publicados no site, rascunhos e metadados de busca."
        actions={(
          <Button type="button" onClick={onCreatePost}>
            <Plus className="h-4 w-4" />
            Novo Post
          </Button>
        )}
      />

      <Surface className="space-y-6">
        <Surface variant="muted" padding="sm" className="p-4">
          <Input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Buscar por titulo ou categoria..."
              leftIcon={Search}
          />
        </Surface>

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
            <Surface variant="muted" className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12" style={{ color: "var(--panel-text-muted)" }} />
              <p style={{ color: "var(--panel-text-soft)" }}>Nenhum post encontrado</p>
            </Surface>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Surface
                  key={post.id}
                  variant="muted"
                  padding="sm"
                  className="p-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-20 w-32 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <Surface variant="warning" padding="none" className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-lg">
                        <FileText className="h-8 w-8" />
                      </Surface>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <Badge tone="accent" size="sm">
                              {post.category}
                            </Badge>
                            <Badge tone={post.published ? "success" : "neutral"} size="sm">
                              {post.published ? "Publicado" : "Rascunho"}
                            </Badge>
                            <span className="text-xs" style={{ color: "var(--panel-text-muted)" }}>
                              {post.read_time}
                            </span>
                          </div>

                          <h3 className="mb-1 truncate text-lg font-bold" style={{ color: "var(--panel-text)" }}>
                            {post.title}
                          </h3>
                          <p className="mb-2 line-clamp-2 text-sm" style={{ color: "var(--panel-text-soft)" }}>
                            {post.excerpt}
                          </p>

                          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--panel-text-muted)" }}>
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
                          <Button
                            type="button"
                            onClick={() =>
                              window.open(`/blog/${post.slug}`, "_blank")
                            }
                            variant="icon"
                            size="icon"
                            title="Visualizar"
                          >
                            <Eye className="h-5 w-5" />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onTogglePublish(post)}
                            variant={post.published ? "success" : "secondary"}
                            size="icon"
                            title={post.published ? "Despublicar" : "Publicar"}
                          >
                            {post.published ? (
                              <Eye className="h-5 w-5" />
                            ) : (
                              <EyeOff className="h-5 w-5" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onEditPost(post)}
                            variant="secondary"
                            size="icon"
                            title="Editar"
                          >
                            <Edit2 className="h-5 w-5" />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onDeletePost(post.id)}
                            variant="danger"
                            size="icon"
                            title="Excluir"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          )}
        </PanelAdaptiveLoadingFrame>
      </Surface>
    </div>
  );
}
