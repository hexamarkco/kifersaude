import { Text, Image, Heading } from '../../../design-system';
import { useState } from 'react';
import {
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Filter,
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
  FilterSelect,
  KpiCard,
  EmptyState,
  Pagination,
  PageHeader,
  ResponsiveCollection,
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
  onStatusFilterChange: (value: string) => void;
  onTogglePublish: (post: BlogPost) => void;
  posts: BlogPost[];
  searchTerm: string;
  statusFilter: string;
  summary: { published: number; drafts: number; views: number; updated: number };
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
  onStatusFilterChange,
  onTogglePublish,
  posts,
  searchTerm,
  statusFilter,
  summary,
}: BlogPostsListProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(searchTerm.trim() || statusFilter);
  const showSummary = hasPostsSnapshot || (!loading && !loadError);
  const getActions = (post: BlogPost) => [
    { label: "Visualizar", icon: Eye, onClick: () => onPreviewPost(post) },
    { label: post.published ? "Despublicar" : "Publicar", icon: post.published ? Eye : EyeOff, onClick: () => onTogglePublish(post) },
    { label: "Editar", icon: Edit2, onClick: () => onEditPost(post) },
    { label: "Excluir", icon: Trash2, destructive: true, onClick: () => onDeletePost(post.id) },
  ];
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

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard padding="sm" title={<span className="block min-h-10 text-sm">Artigos publicados</span>} value={showSummary ? String(summary.published) : '—'} />
        <KpiCard padding="sm" title={<span className="block min-h-10 text-sm">Rascunhos</span>} value={showSummary ? String(summary.drafts) : '—'} />
        <KpiCard padding="sm" title={<span className="block min-h-10 text-sm">Visualizações</span>} value={showSummary ? summary.views.toLocaleString('pt-BR') : '—'} />
        <KpiCard padding="sm" title={<span className="block min-h-10 text-sm">Atualizados no mês</span>} value={showSummary ? String(summary.updated) : '—'} />
      </div>

      <Surface className="space-y-6">
        {loadError && (
          <Alert tone="danger" role="alert" title="Não foi possível carregar os artigos" action={<Button type="button" variant="secondary" onClick={onRetry} disabled={loading}>Tentar novamente</Button>}>
            {hasPostsSnapshot ? "Os artigos exibidos podem estar desatualizados." : "Tente novamente para consultar os artigos."}
          </Alert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
          <Input
              type="text"
              aria-label="Buscar artigos"
              value={searchTerm}
              onChange={(event) => { setPage(1); onSearchTermChange(event.target.value); }}
              placeholder="Buscar por título ou categoria..."
              leftIcon={Search}
          />
          </div>
          <FilterSelect icon={Filter} placeholder="Todos os status" value={statusFilter} onChange={(value) => { setPage(1); onStatusFilterChange(value); }}
            options={[{ value: 'published', label: 'Publicado' }, { value: 'draft', label: 'Rascunho' }]} />
        </div>
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
          {posts.length === 0 && loadError && !hasPostsSnapshot ? null : posts.length === 0 ? (
            <EmptyState icon={<FileText aria-hidden="true" />} title="Nenhum post encontrado"
              description={hasFilters ? "Ajuste a busca ou os filtros para encontrar artigos." : "Crie um artigo para começar a biblioteca."}
              action={hasFilters
                ? <Button type="button" variant="secondary" onClick={() => { setPage(1); onSearchTermChange(''); onStatusFilterChange(''); }}>Limpar filtros</Button>
                : <Button type="button" onClick={onCreatePost}><Plus className="kds-control-icon" aria-hidden="true" /> Novo post</Button>} />
          ) : (
            <>
            <ResponsiveCollection table={<Table aria-label="Biblioteca de artigos" className="min-w-[800px]" columnWidths={['36%', '14%', '12%', '12%', '14%', '12%']}>
              <TableHeader><TableRow>
                <TableHead>Artigo</TableHead><TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead><TableHead>Visualizações</TableHead>
                <TableHead>Criado em</TableHead><TableHead align="right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pagePosts.map((post) => (
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
                      <RecordActions label={`Ações de ${post.title}`} actions={getActions(post)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>} cards={<div className="grid gap-3">
              {pagePosts.map((post) => (
                <Surface key={post.id} padding="sm" className="space-y-3">
                  {post.cover_image_url && <Image src={post.cover_image_url} alt="" className="h-20 w-full rounded-md object-cover" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Text className="break-words font-semibold">{post.title}</Text>
                      <Text size="sm" tone="muted" className="line-clamp-2 break-words">{post.excerpt}</Text>
                    </div>
                    <RecordActions label={`Ações de ${post.title}`} visibleCount={0} actions={getActions(post)} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent" size="sm">{post.category}</Badge>
                    <Badge tone={post.published ? "success" : "neutral"} size="sm">{post.published ? "Publicado" : "Rascunho"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-3">
                    <Text size="sm" tone="muted">Criado {new Date(post.created_at).toLocaleDateString("pt-BR")}</Text>
                    <Text size="sm" tone="muted">{post.views_count} visualizações</Text>
                    <Text size="sm" tone="muted">{post.read_time}</Text>
                  </div>
                </Surface>
              ))}
            </div>} />
            <Pagination currentPage={currentPage} totalPages={totalPages} itemsPerPage={pageSize} totalItems={posts.length}
              onPageChange={setPage} onItemsPerPageChange={(value) => { setPageSize(value); setPage(1); }} />
            </>
          )}
        </PanelAdaptiveLoadingFrame>
      </Surface>
    </div>
  );
}
