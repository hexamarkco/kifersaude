export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url?: string;
  category: string;
  read_time: string;
  author_id: string;
  published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
  views_count: number;
  meta_title?: string;
  meta_description?: string;
}

export interface BlogPostFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  category: string;
  read_time: string;
  published: boolean;
  meta_title: string;
  meta_description: string;
}

export interface BlogPostPayload extends BlogPostFormData {
  author_id?: string;
  published_at: string | null;
}
