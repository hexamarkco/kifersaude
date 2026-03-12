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
import { supabase } from "../../lib/supabase";
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

    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`Erro ao carregar posts: ${error.message}`);
      setLoading(false);
      return;
    }

    setPosts(data || []);
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
      toast.warning("Preencha todos os campos obrigatorios.");
      return;
    }

    const postData = buildBlogPostPayload({
      authorId: user?.id,
      formData,
    });

    if (editingPost) {
      const { error } = await supabase
        .from("blog_posts")
        .update(postData)
        .eq("id", editingPost.id);

      if (error) {
        toast.error(`Erro ao atualizar post: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("blog_posts").insert([postData]);

      if (error) {
        toast.error(`Erro ao criar post: ${error.message}`);
        return;
      }
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
          "Tem certeza que deseja excluir este post? Esta acao nao pode ser desfeita.",
        confirmLabel: "Excluir post",
        cancelLabel: "Cancelar",
        tone: "danger",
      });

      if (!confirmed) {
        return;
      }

      const { error } = await supabase.from("blog_posts").delete().eq("id", id);

      if (error) {
        toast.error(`Erro ao excluir post: ${error.message}`);
        return;
      }

      await loadPosts();
    },
    [loadPosts, requestConfirmation],
  );

  const handleTogglePublish = useCallback(
    async (post: BlogPost) => {
      const { error } = await supabase
        .from("blog_posts")
        .update({
          published: !post.published,
          published_at: !post.published ? new Date().toISOString() : null,
        })
        .eq("id", post.id);

      if (error) {
        toast.error(`Erro ao atualizar status: ${error.message}`);
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

      toast.error(result.error || "Erro ao fazer upload da imagem.");
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

      toast.error(result.error || "Erro ao fazer upload da imagem.");
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
