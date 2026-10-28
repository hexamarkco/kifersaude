import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
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
import { Badge, Button, Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle, Image, RichTextEditor, Text } from '../../design-system';
import {
  deleteBlogPost,
  listBlogPosts,
  saveBlogPost,
  setBlogPostPublished,
} from "./data/blogRepository";

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
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [previewPost, setPreviewPost] = useState<BlogPost | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [formData, setFormData] = useState(createEmptyBlogFormData);
  const postsRequestIdRef = useRef(0);
  const loadingUi = useAdaptiveLoading(loading);

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

  const handleSave = useCallback(async () => {
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

    const postData = buildBlogPostPayload({
      authorId: user?.id,
      formData,
    });

    try {
      await saveBlogPost(postData, editingPost?.id);
    } catch (error) {
      const action = editingPost ? "atualizar" : "criar";
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível ${action} o post: ${message}`);
      return;
    }

    closeEditor();
    await loadPosts();
  }, [closeEditor, editingPost, formData, loadPosts, user?.id]);

  const handleEdit = useCallback((post: BlogPost) => {
    setEditingPost(post);
    setFormData(mapBlogPostToFormData(post));
    setShowEditor(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await requestConfirmation({
        title: "Excluir post",
        description:
          "Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.",
        confirmLabel: "Excluir post",
        cancelLabel: "Cancelar",
        tone: "danger",
      });

      if (!confirmed) {
        return;
      }

      try {
        await deleteBlogPost(id);
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
      try {
        await setBlogPostPublished(post, !post.published);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Não foi possível atualizar o status: ${message}`);
        return;
      }

      await loadPosts();
    },
    [loadPosts],
  );

  const handleCoverImageUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

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
          onSave={handleSave}
          onTitleChange={handleTitleChange}
          validationAttempted={validationAttempted}
          uploadingContent={uploadingContent}
          uploadingCover={uploadingCover}
        />
      ) : (
        <BlogPostsList
          hasPostsSnapshot={hasPostsSnapshot}
          loading={loading}
          loadError={loadError}
          loadingPhase={loadingUi.phase}
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
      <Dialog open={Boolean(previewPost)} onOpenChange={open => { if (!open) setPreviewPost(null); }} size="lg" aria-label="Prévia do artigo">
        {previewPost && <>
          <DialogHeader onClose={() => setPreviewPost(null)}><div><Text size="sm" tone="brand">Prévia do artigo</Text><DialogTitle>{previewPost.title}</DialogTitle></div></DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><Badge>{previewPost.category}</Badge><Badge tone={previewPost.published ? 'success' : 'neutral'}>{previewPost.published ? 'Publicado' : 'Rascunho'}</Badge><Text size="sm">{previewPost.read_time}</Text></div>
            {previewPost.cover_image_url && <Image src={previewPost.cover_image_url} alt={previewPost.title} className="w-full" />}
            <Text>{previewPost.excerpt}</Text>
            <RichTextEditor className="kds-rich-text-preview" value={previewPost.content} readOnly modules={{ toolbar: false }} />
          </DialogBody>
          <DialogFooter><Button variant="secondary" onClick={() => setPreviewPost(null)}>Fechar</Button></DialogFooter>
        </>}
      </Dialog>
    </>
  );
}
