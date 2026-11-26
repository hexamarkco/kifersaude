import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { BookOpen } from "lucide-react";

import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { uploadBlogImage } from "../../lib/imageUploadService";
import { toast } from "../../lib/toast";
import { useAuth } from "../../contexts/AuthContext";
import BlogEditor from "./components/BlogEditor";
import BlogPostsList from "./components/BlogPostsList";
import {
  buildBlogPostPayload,
  createEmptyBlogFormData,
  estimateBlogReadTime,
  filterBlogPosts,
  generateBlogSlug,
  mapBlogPostToFormData,
} from "./shared/blogUtils";
import type { BlogPost } from "./shared/blogTypes";
import { Badge, BrandWordmark, Button, Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, Field, Heading, Image, Input, RichTextEditor, Text } from '../../design-system';
import {
  deleteBlogPost,
  listBlogPosts,
  saveBlogPost,
  setBlogPostPublished,
} from "./data/blogRepository";

function BlogPublishReview({ title, category, slug }: Pick<BlogPost, "title" | "category" | "slug">) {
  return <div className="kds-blog-publish-review">
    <Field label="Artigo"><Input value={title} readOnly /></Field>
    <div className="kds-blog-publish-fields">
      <Field label="Publicação"><Input value="Publicar agora" readOnly /></Field>
      <Field label="Categoria"><Input value={category} readOnly /></Field>
    </div>
    <Field label="Endereço do artigo"><Input value={`/blog/${slug}`} readOnly /></Field>
    <Text tone="muted" size="sm">Ao confirmar, o artigo ficará disponível publicamente. Não há agendamento futuro nesta tela.</Text>
  </div>;
}

export default function BlogTabScreen() {
  const { user } = useAuth();
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [previewPost, setPreviewPost] = useState<Pick<BlogPost, "title" | "category" | "content" | "excerpt" | "cover_image_url" | "published" | "published_at" | "read_time"> | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [formData, setFormData] = useState(createEmptyBlogFormData);
  const postsRequestIdRef = useRef(0);
  const savingRef = useRef(false);

  const loadPosts = useCallback(async () => {
    const requestId = postsRequestIdRef.current + 1;
    postsRequestIdRef.current = requestId;
    setLoading(true);

    try {
      const nextPosts = await listBlogPosts();
      if (requestId !== postsRequestIdRef.current) return;
      setPosts(nextPosts);
      setLoadError(false);
    } catch (error) {
      if (requestId === postsRequestIdRef.current) {
        setLoadError(true);
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível carregar os posts: ${message}`);
      }
    } finally {
      if (requestId === postsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPosts();
    return () => {
      postsRequestIdRef.current += 1;
    };
  }, [loadPosts]);

  const resetForm = useCallback(() => {
    setFormData(createEmptyBlogFormData());
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setValidationAttempted(false);
    setEditingPost(null);
    resetForm();
  }, [resetForm]);

  const handleTitleChange = useCallback((title: string) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      title,
      slug: generateBlogSlug(title),
      meta_title: title,
    }));
  }, []);

  const handleContentChange = useCallback((value: string) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      content: value,
      read_time: estimateBlogReadTime(value),
    }));
  }, []);

  const handleSave = useCallback(async (published = formData.published) => {
    if (savingRef.current || uploadingCover || uploadingContent) return;
    if (
      !formData.title ||
      !formData.slug ||
      !formData.excerpt ||
      !formData.content
    ) {
      setValidationAttempted(true);
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    if (published && !editingPost?.published) {
      const confirmed = await requestConfirmation({
        title: "Publicar artigo?",
        description: `“${formData.title}” ficará disponível no blog da Kifer Saúde.`,
          dialogClassName: "kds-crm-dialog kds-blog-publish-dialog",
          content: <BlogPublishReview title={formData.title} category={formData.category} slug={formData.slug} />,
        confirmLabel: "Publicar artigo",
        cancelLabel: "Cancelar",
      });
      if (!confirmed || savingRef.current) return;
    }

    const postData = buildBlogPostPayload({
      authorId: user?.id,
      formData: { ...formData, published },
    });

    savingRef.current = true;
    setSaving(true);
    try {
      await saveBlogPost(postData, editingPost?.id);
      toast.success(editingPost ? "Post atualizado." : "Post criado.");
      closeEditor();
      await loadPosts();
    } catch {
      const action = editingPost ? "atualizar" : "criar";
      toast.error(`Não foi possível ${action} o post. Tente novamente.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [closeEditor, editingPost, formData, loadPosts, requestConfirmation, uploadingContent, uploadingCover, user?.id]);

  const handleEdit = useCallback((post: BlogPost) => {
    setEditingPost(post);
    setFormData(mapBlogPostToFormData(post));
    setShowEditor(true);
  }, []);

  const handleDelete = useCallback(
    async (post: BlogPost) => {
      const confirmed = await requestConfirmation({
        title: "Excluir post?",
        description: `O artigo “${post.title}” será excluído permanentemente. Esta ação não pode ser desfeita.`,
        confirmLabel: "Excluir post",
        cancelLabel: "Cancelar",
        tone: "danger",
      });

      if (!confirmed) {
        return;
      }

      try {
        await deleteBlogPost(post.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível excluir o post: ${message}`);
        return;
      }

      await loadPosts();
    },
    [loadPosts, requestConfirmation],
  );

  const handleTogglePublish = useCallback(
    async (post: BlogPost) => {
      if (!post.published) {
        const confirmed = await requestConfirmation({
          title: "Publicar artigo?",
          description: `“${post.title}” ficará disponível no blog da Kifer Saúde.`,
          dialogClassName: "kds-crm-dialog kds-blog-publish-dialog",
          content: <BlogPublishReview title={post.title} category={post.category} slug={post.slug} />,
          confirmLabel: "Publicar artigo",
          cancelLabel: "Cancelar",
        });
        if (!confirmed) return;
      }
      try {
        await setBlogPostPublished(post, !post.published);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível atualizar o status: ${message}`);
        return;
      }

      await loadPosts();
    },
    [loadPosts, requestConfirmation],
  );

  const handleCoverImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";

      if (!file) {
        return;
      }

      setUploadingCover(true);
      try {
        const result = await uploadBlogImage(file);

        if (result.success && result.url) {
          setFormData((currentFormData) => ({
            ...currentFormData,
            cover_image_url: result.url!,
          }));
          return;
        }

        toast.error(result.error || "Não foi possível fazer o upload da imagem.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível fazer o upload da imagem: ${message}`);
      } finally {
        setUploadingCover(false);
      }
    },
    [],
  );

  const handleContentImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";

      if (!file) {
        return;
      }

      setUploadingContent(true);
      try {
        const result = await uploadBlogImage(file);

        if (result.success && result.url) {
          const imageHtml = `<img src="${result.url}" alt="Imagem do artigo" />`;
          setFormData((currentFormData) => ({
            ...currentFormData,
            content: `${currentFormData.content}${imageHtml}`,
          }));
          return;
        }

        toast.error(result.error || "Não foi possível fazer o upload da imagem.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível fazer o upload da imagem: ${message}`);
      } finally {
        setUploadingContent(false);
      }
    },
    [],
  );

  const filteredPosts = useMemo(
    () => filterBlogPosts(posts, searchTerm).filter(post =>
      !statusFilter || post.published === (statusFilter === "published")),
    [posts, searchTerm, statusFilter],
  );
  const summary = useMemo(() => {
    const now = new Date();
    return {
      published: posts.filter(post => post.published).length,
      drafts: posts.filter(post => !post.published).length,
      views: posts.reduce((total, post) => total + (post.views_count || 0), 0),
      updated: posts.filter(post => {
        const date = new Date(post.updated_at);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }).length,
    };
  }, [posts]);
  const hasPostsSnapshot = posts.length > 0;

  return (
    <>
      {showEditor ? (
        <BlogEditor
          editingPost={editingPost}
          formData={formData}
          onClose={closeEditor}
          onContentChange={handleContentChange}
          onContentImageUpload={handleContentImageUpload}
          onCoverImageUpload={handleCoverImageUpload}
          onFormDataChange={setFormData}
          onPreview={() => setPreviewPost({ ...formData, published_at: editingPost?.published_at })}
          onSave={() => void handleSave()}
          onPublish={() => void handleSave(true)}
          onTitleChange={handleTitleChange}
          saving={saving}
          validationAttempted={validationAttempted}
          uploadingContent={uploadingContent}
          uploadingCover={uploadingCover}
        />
      ) : (
        <BlogPostsList
          hasPostsSnapshot={hasPostsSnapshot}
          loading={loading}
          loadError={loadError}

          onRetry={() => void loadPosts()}
          onCreatePost={() => setShowEditor(true)}
          onDeletePost={handleDelete}
          onEditPost={handleEdit}
          onPreviewPost={setPreviewPost}
          onSearchTermChange={setSearchTerm}
          onStatusFilterChange={setStatusFilter}
          onTogglePublish={handleTogglePublish}
          posts={filteredPosts}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          summary={summary}
        />
      )}
      {ConfirmationDialog}
      <Dialog open={Boolean(previewPost)} onOpenChange={open => { if (!open) setPreviewPost(null); }} size="wide" className="kds-crm-dialog kds-blog-workspace kds-blog-preview" aria-label="Prévia do artigo">
        {previewPost && <>
          <DialogHeader onClose={() => setPreviewPost(null)}><div className="kds-dialog-eyebrow">Blog</div><DialogTitle>Prévia do artigo</DialogTitle></DialogHeader>
          <DialogBody>
            <article className="kds-blog-preview-body">
              <BrandWordmark variant="lockup" />
              <div className="space-y-2">
                <Text size="sm" tone="brand" className="kds-blog-preview-category">{previewPost.category}</Text>
                <Heading level={3} family="display" className="kds-blog-preview-title">{previewPost.title || "Artigo sem título"}</Heading>
                <div className="flex flex-wrap items-center gap-2">
                  <Text size="sm" tone="muted">Por Kifer Saúde{previewPost.published_at && ` · ${new Date(previewPost.published_at).toLocaleDateString("pt-BR")}`}{previewPost.read_time && ` · ${previewPost.read_time} de leitura`}</Text>
                  {!previewPost.published && <Badge tone="warning">Rascunho</Badge>}
                </div>
              </div>
              {previewPost.cover_image_url
                ? <Image src={previewPost.cover_image_url} alt="" className="kds-blog-preview-cover" />
                : <div className="kds-blog-preview-cover" aria-hidden="true"><BookOpen /></div>}
              <Text className="kds-blog-preview-excerpt">{previewPost.excerpt}</Text>
              <RichTextEditor className="kds-rich-text-preview" value={previewPost.content} readOnly modules={{ toolbar: false }} />
            </article>
          </DialogBody>
          <DialogFooter><Text className="kds-blog-preview-note">Prévia somente para leitura.</Text><Button variant="secondary" onClick={() => setPreviewPost(null)}>Fechar</Button></DialogFooter>
        </>}
      </Dialog>
    </>
  );
}
