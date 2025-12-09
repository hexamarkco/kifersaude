import { supabase } from './supabase';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function uploadBlogImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: 'Formato de arquivo não suportado. Use JPG, PNG, WEBP ou GIF.'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: 'Arquivo muito grande. Tamanho máximo: 5MB.'
    };
  }

  const fileExt = file.name.split('.').pop();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const fileName = `${year}/${month}/${timestamp}-${randomString}.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from('blog-images')
      .upload(fileName, file, {
        cacheControl: '31536000',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao fazer upload da imagem.'
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('blog-images')
      .getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      success: false,
      error: 'Erro inesperado ao fazer upload da imagem.'
    };
  }
}

export async function deleteBlogImage(url: string): Promise<boolean> {
  try {
    const path = url.split('/blog-images/').pop();
    if (!path) return false;

    const { error } = await supabase.storage
      .from('blog-images')
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}
