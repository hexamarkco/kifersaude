import { useState } from 'react';
import { ArrowUpRight, BookOpen, Edit2, Eye, EyeOff, FileText, HeartPulse, Newspaper, Plus, Search, Trash2 } from 'lucide-react';
import {
  ActionSurface, Alert, Badge, Button, Card, DisclosureTrigger, EmptyState, Heading, Image, Input,
  KpiCard, PageHeader, Pagination, PanelAdaptiveLoadingFrame, RecordActions, SegmentedControl, Text,
} from '../../../design-system';
import type { BlogPost } from '../shared/blogTypes';

const coverSymbols = [BookOpen, HeartPulse, Newspaper];

type BlogPostsListProps = {
  hasPostsSnapshot: boolean;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  onCreatePost: () => void;
  onDeletePost: (post: BlogPost) => void;
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
  hasPostsSnapshot, loading, loadError, onRetry, onCreatePost, onDeletePost, onEditPost, onPreviewPost,
  onSearchTermChange, onStatusFilterChange, onTogglePublish, posts, searchTerm, statusFilter, summary,
}: BlogPostsListProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagePosts = posts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(searchTerm.trim() || statusFilter);
  const showSummary = hasPostsSnapshot || (!loading && !loadError);

  return (
    <div className="panel-page-shell kds-blog-workspace space-y-5">
      <PageHeader title="Conteúdo que aproxima." description="Organize os artigos e as informações que você compartilha." />
      <div className="kds-blog-library-toolbar" aria-label="Filtros dos artigos">
        <Input type="search" aria-label="Buscar artigos" value={searchTerm} leftIcon={Search} placeholder="Buscar artigo…"
          onChange={(event) => { setPage(1); onSearchTermChange(event.target.value); }} />
        <SegmentedControl className="kds-blog-status-filter" ariaLabel="Situação dos artigos" value={statusFilter}
          items={[{ id: '', label: 'Todos' }, { id: 'published', label: 'Publicado' }, { id: 'draft', label: 'Rascunho' }]}
          onChange={(value) => { setPage(1); onStatusFilterChange(value); }} />
        <Button onClick={onCreatePost}><Plus className="kds-control-icon" aria-hidden="true" />Novo artigo</Button>
      </div>
      {loadError && (
        <Alert tone="danger" role="alert" title="Não foi possível carregar os artigos"
          action={<Button variant="secondary" onClick={onRetry} disabled={loading}>Tentar novamente</Button>}>
          {hasPostsSnapshot ? 'Os artigos exibidos podem estar desatualizados.' : 'Tente novamente para consultar os artigos.'}
        </Alert>
      )}
      <PanelAdaptiveLoadingFrame loading={loading} label="Carregando artigos" hasContent={hasPostsSnapshot} overlayLabel="Atualizando artigos…" stageClassName="min-h-48">
        {posts.length === 0 && loadError && !hasPostsSnapshot ? null : posts.length === 0 ? (
          <EmptyState icon={<FileText aria-hidden="true" />} title="Nenhum artigo encontrado"
            description={hasFilters ? 'Ajuste a busca ou o status para encontrar artigos.' : 'Crie um artigo para começar a biblioteca.'}
            action={hasFilters ? (
              <Button variant="secondary" onClick={() => { setPage(1); onSearchTermChange(''); onStatusFilterChange(''); }}>Limpar filtros</Button>
            ) : <Button onClick={onCreatePost}>Novo artigo</Button>}
          />
        ) : (
          <div className="space-y-4">
            <ul className="kds-blog-library" aria-label="Biblioteca de artigos">
              {pagePosts.map((post, index) => {
                const CoverSymbol = coverSymbols[index % coverSymbols.length];
                return (
                  <li key={post.id}>
                    <Card padding="none" className="kds-blog-article-card">
                      <ActionSurface variant="plain" padding="none" className="kds-blog-article-cover"
                        aria-label={`Editar artigo: ${post.title}`} onClick={() => onEditPost(post)}>
                        {post.cover_image_url ? <Image src={post.cover_image_url} alt="" /> : <CoverSymbol aria-hidden="true" />}
                      </ActionSurface>
                      <div className="kds-blog-article-body">
                        <div className="kds-blog-article-top">
                          <Badge tone={post.published ? 'success' : 'warning'} size="sm">{post.published ? 'Publicado' : 'Rascunho'}</Badge>
                          <RecordActions label={`Ações de ${post.title}`} visibleCount={0} actions={[
                            { label: 'Editar artigo', icon: Edit2, onClick: () => onEditPost(post) },
                            { label: 'Visualizar', icon: Eye, onClick: () => onPreviewPost(post) },
                            { label: post.published ? 'Despublicar' : 'Publicar', icon: post.published ? EyeOff : ArrowUpRight, onClick: () => onTogglePublish(post) },
                            { label: 'Excluir artigo', icon: Trash2, destructive: true, onClick: () => onDeletePost(post) },
                          ]} />
                        </div>
                        <Text size="sm" tone="muted" className="kds-blog-article-category">{post.category}</Text>
                        <Heading level={2} size="sm">
                          <ActionSurface variant="plain" padding="none" className="kds-blog-article-title" onClick={() => onEditPost(post)}>{post.title}</ActionSurface>
                        </Heading>
                        <div className="kds-blog-article-meta">
                          <time dateTime={post.updated_at || post.created_at}>{new Date(post.updated_at || post.created_at).toLocaleDateString('pt-BR')}</time>
                          <span>{post.read_time}</span>
                          <span aria-label={`${post.views_count ?? 0} visualizações`}><Eye aria-hidden="true" />{(post.views_count ?? 0).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {posts.length > 10 && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={posts.length} itemsPerPage={pageSize}
              onPageChange={setPage} onItemsPerPageChange={(value) => { setPageSize(value); setPage(1); }} pageSizeOptions={[10, 25, 50]} />}
          </div>
        )}
      </PanelAdaptiveLoadingFrame>
      {showSummary && (
        <details className="kds-blog-library-summary">
          <DisclosureTrigger size="sm">Indicadores da biblioteca</DisclosureTrigger>
          <div className="kds-workspace-record-metrics" aria-label="Indicadores do blog">
            <KpiCard title="Artigos publicados" value={String(summary.published)} />
            <KpiCard title="Rascunhos" value={String(summary.drafts)} />
            <KpiCard title="Visualizações" value={summary.views.toLocaleString('pt-BR')} />
            <KpiCard title="Atualizados no mês" value={String(summary.updated)} />
          </div>
        </details>
      )}
    </div>
  );
}
