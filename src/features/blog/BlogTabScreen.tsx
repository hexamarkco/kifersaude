import {
  useCallback,
  useEffect,
  useMemo,
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
import {
  deleteBlogPost,
  listBlogPosts,
  saveBlogPost,
  setBlogPostPublished,
} from "./data/blogRepository";
import "react-quill/dist/quill.snow.css";

export default function BlogTabScreen() {
  const { user } = useAuth();
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingContent, setUploadingContent] = useState(false);
  const [formData, setFormData] = useState(createEmptyBlogFormData);
  const loadingUi = useAdaptiveLoading(loading);

  const loadPosts = useCallback(async () => {
    setLoading(true);

    try {
      setPosts(await listBlogPosts());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Não foi possível carregar os posts: ${message}`);
      setLoading(false);
      return;
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const resetForm = useCallback(() => {
    setFormData(createEmptyBlogFormData());
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
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
      const result = await uploadBlogImage(file);
      setUploadingCover(false);

      if (result.success && result.url) {
        setFormData((currentFormData) => ({
          ...currentFormData,
          cover_image_url: result.url!,
        }));
        return;
      }

      toast.error(result.error || "Não foi possível fazer o upload da imagem.");
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
      const result = await uploadBlogImage(file);
      setUploadingContent(false);

      if (result.success && result.url) {
        const imageHtml = `<img src="${result.url}" alt="Imagem do artigo" />`;
        setFormData((currentFormData) => ({
          ...currentFormData,
          content: `${currentFormData.content}${imageHtml}`,
        }));
        return;
      }

      toast.error(result.error || "Não foi possível fazer o upload da imagem.");
    },
    [],
  );

  const filteredPosts = useMemo(
    () => filterBlogPosts(posts, searchTerm),
    [posts, searchTerm],
  );
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
          uploadingContent={uploadingContent}
          uploadingCover={uploadingCover}
        />
      ) : (
        <BlogPostsList
          hasPostsSnapshot={hasPostsSnapshot}
          loading={loading}
          loadingPhase={loadingUi.phase}
          onCreatePost={() => setShowEditor(true)}
          onDeletePost={handleDelete}
          onEditPost={handleEdit}
          onSearchTermChange={setSearchTerm}
          onTogglePublish={handleTogglePublish}
          posts={filteredPosts}
          searchTerm={searchTerm}
        />
      )}
      {ConfirmationDialog}
    </>
  );
}
