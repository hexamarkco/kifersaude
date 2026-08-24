import type { PostgrestError } from '@supabase/supabase-js';

import { supabase, type PublicLinkItem, type PublicLinkPageSettings } from './supabase';

const PAGE_SETTINGS_TABLE = 'public_link_page_settings';
const LINK_ITEMS_TABLE = 'public_link_items';

const toPostgrestError = (error: unknown): PostgrestError => {
  if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
    return error as PostgrestError;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return { message, details: '', hint: '', code: 'UNKNOWN', name: 'Error' };
};

export const linksService = {
  async getLinkPageSettings(): Promise<PublicLinkPageSettings | null> {
    try {
      const { data, error } = await supabase
        .from(PAGE_SETTINGS_TABLE)
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PublicLinkPageSettings | null;
    } catch (error) {
      console.error('Error loading link page settings:', error);
      return null;
    }
  },

  async saveLinkPageSettings(
    payload: Pick<
      PublicLinkPageSettings,
      'title' | 'subtitle' | 'bio' | 'avatar_url' | 'is_verified' | 'is_published'
    >,
    existingId?: string | null,
  ): Promise<{ data: PublicLinkPageSettings | null; error: PostgrestError | null }> {
    try {
      if (existingId) {
        const { data, error } = await supabase
          .from(PAGE_SETTINGS_TABLE)
          .update(payload)
          .eq('id', existingId)
          .select()
          .single();

        return { data: (data as PublicLinkPageSettings) ?? null, error };
      }

      const { data, error } = await supabase
        .from(PAGE_SETTINGS_TABLE)
        .insert([payload])
        .select()
        .single();

      return { data: (data as PublicLinkPageSettings) ?? null, error };
    } catch (error) {
      console.error('Error saving link page settings:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async getLinkItems(): Promise<PublicLinkItem[]> {
    try {
      const { data, error } = await supabase
        .from(LINK_ITEMS_TABLE)
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as PublicLinkItem[] | null) ?? [];
    } catch (error) {
      console.error('Error loading link items:', error);
      return [];
    }
  },

  async createLinkItem(
    payload: Pick<PublicLinkItem, 'title' | 'url' | 'icon'> & Partial<Pick<PublicLinkItem, 'is_active' | 'position'>>,
  ): Promise<{ data: PublicLinkItem | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase
        .from(LINK_ITEMS_TABLE)
        .insert([{ is_active: true, position: 0, ...payload }])
        .select()
        .single();

      return { data: (data as PublicLinkItem) ?? null, error };
    } catch (error) {
      console.error('Error creating link item:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateLinkItem(
    id: string,
    updates: Partial<Pick<PublicLinkItem, 'title' | 'url' | 'icon' | 'is_active' | 'position'>>,
  ): Promise<{ data: PublicLinkItem | null; error: PostgrestError | null }> {
    try {
      const { data, error } = await supabase
        .from(LINK_ITEMS_TABLE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      return { data: (data as PublicLinkItem) ?? null, error };
    } catch (error) {
      console.error('Error updating link item:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async deleteLinkItem(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error } = await supabase.from(LINK_ITEMS_TABLE).delete().eq('id', id);
      return { error };
    } catch (error) {
      console.error('Error deleting link item:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async reorderLinkItems(orderedIds: string[]): Promise<{ error: PostgrestError | null }> {
    try {
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from(LINK_ITEMS_TABLE).update({ position: index }).eq('id', id),
        ),
      );

      const failed = results.find((result) => result.error);
      return { error: failed?.error ?? null };
    } catch (error) {
      console.error('Error reordering link items:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getPublicLinkPage(): Promise<{ settings: PublicLinkPageSettings | null; items: PublicLinkItem[] }> {
    try {
      const [{ data: settings }, { data: items }] = await Promise.all([
        supabase.from(PAGE_SETTINGS_TABLE).select('*').eq('is_published', true).limit(1).maybeSingle(),
        supabase
          .from(LINK_ITEMS_TABLE)
          .select('*')
          .eq('is_active', true)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      return {
        settings: (settings as PublicLinkPageSettings | null) ?? null,
        items: (items as PublicLinkItem[] | null) ?? [],
      };
    } catch (error) {
      console.error('Error loading public link page:', error);
      return { settings: null, items: [] };
    }
  },

  async recordLinkClick(id: string): Promise<void> {
    try {
      await supabase.rpc('increment_public_link_click', { link_id: id });
    } catch (error) {
      console.error('Error recording link click:', error);
    }
  },
};
