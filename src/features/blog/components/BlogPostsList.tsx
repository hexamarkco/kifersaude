import { Text, Image, Heading } from '../../../design-system';
import {
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { BlogTabSkeletonList } from '../../../design-system';
import { PanelAdaptiveLoadingFrame } from '../../../design-system';
import {
  Badge,
  Alert,
  Button,
  Input,
  PageHeader,
  Surface,
  RecordActions,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../design-system";
import type { AdaptiveLoadingPhase } from "../../../hooks/useAdaptiveLoading";
import type { BlogPost } from "../shared/blogTypes";

type BlogPostsListProps = {
  hasPostsSnapshot: boolean;
  loading: boolean;
  loadError: boolean;
  loadingPhase: AdaptiveLoadingPhase;
  onRetry: () => void;
  onCreatePost: () => void;
  onDeletePost: (id: string) => void;
  onEditPost: (post: BlogPost) => void;
  onPreviewPost: (post: BlogPost) => void;
  onSearchTermChange: (value: string) => void;
  onTogglePublish: (post: BlogPost) => void;
  posts: BlogPost[];
  searchTerm: string;
};

export default function BlogPostsList({
  hasPostsSnapshot,
  loading,
  loadError,
  loadingPhase,
  onRetry,
  onCreatePost,
  onDeletePost,
  onEditPost,
  onPreviewPost,
  onSearchTermChange,
  onTogglePublish,
  posts,
  searchTerm,
}: BlogPostsListProps) {
  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Conteúdo público"
        title="Blog"
        description="Gerencie artigos publicados no site, rascunhos e metadados de busca."
        actions={(
          <Button type="button" onClick={onCreatePost}>
            <Plus className="kds-control-icon" />
            Novo post
          </Button>
        )}
      />

      <Surface className="space-y-6">
        {loadError && (
          <Alert tone="danger" role="alert" title="Não foi possível carregar os artigos" action={<Button type="button" variant="secondary" onClick={onRetry} disabled={loading}>Tentar novamente</Button>}>
            {hasPostsSnapshot ? "Os artigos exibidos podem estar desatualizados." : "Tente novamente para consultar os artigos."}
          </Alert>
        )}
        <Surface variant="muted" padding="sm">
          <Input
              type="text"
              aria-label="Buscar artigos"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Buscar por título ou categoria..."
              leftIcon={Search}
          />
        </Surface>
      </Surface>

      <Surface className="space-y-4">
        <div>
          <Heading level={2} size="lg">Biblioteca de artigos</Heading>
          <Text size="sm" tone="muted">Consulte e gerencie as publicações do site.</Text>
        </div>
        <PanelAdaptiveLoadingFrame
          loading={loading}
          phase={loadingPhase}
          hasContent={hasPostsSnapshot}
          skeleton={<BlogTabSkeletonList />}
          overlayLabel="Atualizando posts..."
          stageClassName="min-h-[360px]"
        >
          {posts.length === 0 && loadError ? null : posts.length === 0 ? (
            <Surface variant="muted" className="py-12 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-[var(--text-muted)]" />
              <Text className="text-[var(--text-secondary)]">Nenhum post encontrado</Text>
            </Surface>
          ) : (
            <Table aria-label="Biblioteca de artigos" className="min-w-[800px]" columnWidths={['36%', '14%', '12%', '12%', '14%', '12%']}>
              <TableHeader><TableRow>
                <TableHead>Artigo</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead><TableHead>Visualizações</TableHead>
                <TableHead>Criado em</TableHead><TableHead align="right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="min-w-64">
                      <div className="flex items-start gap-3">
                        {post.cover_image_url && <Image src={post.cover_image_url} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />}
                        <div className="min-w-0">
                          <Text className="font-semibold">{post.title}</Text>
                          <Text size="sm" tone="muted" className="line-clamp-2">{post.excerpt}</Text>
                          <Text size="sm" tone="muted">{post.read_time}</Text>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge tone="accent" size="sm">{post.category}</Badge></TableCell>
                    <TableCell><Badge tone={post.published ? "success" : "neutral"} size="sm">{post.published ? "Publicado" : "Rascunho"}</Badge></TableCell>
                    <TableCell>{post.views_count}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(post.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell align="right">
                      <RecordActions label={`Ações de ${post.title}`} actions={[
                        { label: "Visualizar", icon: Eye, onClick: () => onPreviewPost(post) },
                        { label: post.published ? "Despublicar" : "Publicar", icon: post.published ? Eye : EyeOff, onClick: () => onTogglePublish(post) },
                        { label: "Editar", icon: Edit2, onClick: () => onEditPost(post) },
                        { label: "Excluir", icon: Trash2, destructive: true, onClick: () => onDeletePost(post.id) },
                      ]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelAdaptiveLoadingFrame>
      </Surface>
    </div>
  );
}
