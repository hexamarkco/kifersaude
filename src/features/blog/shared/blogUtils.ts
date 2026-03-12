import { BLOG_DEFAULT_FORM_DATA } from "./blogConstants";
import type { BlogPost, BlogPostFormData, BlogPostPayload } from "./blogTypes";

export const createEmptyBlogFormData = (): BlogPostFormData => ({
  ...BLOG_DEFAULT_FORM_DATA,
});

export const generateBlogSlug = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const estimateBlogReadTime = (content: string) => {
  const text = content.replace(/<[^>]*>/g, "");
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
};

export const filterBlogPosts = (posts: BlogPost[], searchTerm: string) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return posts;
  }

  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(normalizedSearchTerm) ||
      post.category.toLowerCase().includes(normalizedSearchTerm),
  );
};

export const mapBlogPostToFormData = (post: BlogPost): BlogPostFormData => ({
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  content: post.content,
  cover_image_url: post.cover_image_url || "",
  category: post.category,
  read_time: post.read_time,
  published: post.published,
  meta_title: post.meta_title || post.title,
  meta_description: post.meta_description || post.excerpt,
});

export const buildBlogPostPayload = ({
  authorId,
  formData,
  now = new Date(),
}: {
  authorId?: string;
  formData: BlogPostFormData;
  now?: Date;
}): BlogPostPayload => ({
  ...formData,
  author_id: authorId,
  published_at: formData.published ? now.toISOString() : null,
});
