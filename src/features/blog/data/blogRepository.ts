import { databaseClient } from '../../../infrastructure/supabase';
import type { BlogPost, BlogPostPayload } from '../shared/blogTypes';

export async function listBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await databaseClient
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as BlogPost[];
}

export async function saveBlogPost(
  payload: BlogPostPayload,
  postId?: string,
): Promise<void> {
  const query = postId
    ? databaseClient.from('blog_posts').update(payload).eq('id', postId)
    : databaseClient.from('blog_posts').insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteBlogPost(postId: string): Promise<void> {
  const { error } = await databaseClient.from('blog_posts').delete().eq('id', postId);
  if (error) throw error;
}


export async function setBlogPostPublished(post: BlogPost, published: boolean): Promise<void> {
  const { error } = await databaseClient
    .from('blog_posts')
    .update({
      published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq('id', post.id);
  if (error) throw error;
}
