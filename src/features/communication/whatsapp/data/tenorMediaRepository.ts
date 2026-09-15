import { supabase } from '../../../../infrastructure/supabase';

export type TenorMediaMode = 'gif' | 'sticker';

export type TenorMediaItem = {
  id: string;
  title: string;
  previewUrl: string;
  sendUrl: string;
  mimeType: string;
  sendKind: 'image' | 'video';
};

export const tenorMediaRepository = {
  async search(query: string, mode: TenorMediaMode): Promise<TenorMediaItem[]> {
    const { data, error } = await supabase.functions.invoke('tenor-media', {
      body: { query, mode },
    });

    if (error || !data || !Array.isArray(data.results)) {
      throw new Error('Não foi possível consultar a biblioteca de GIFs e figurinhas.');
    }

    return data.results as TenorMediaItem[];
  },
};
