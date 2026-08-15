import { supabase } from './supabase';

export const toggleLeadFavorito = async (leadId: string, nextFavorito: boolean): Promise<void> => {
  const { error } = await supabase.from('leads').update({ favorito: nextFavorito }).eq('id', leadId);
  if (error) {
    throw new Error(error.message || 'Não foi possível atualizar o favorito do lead.');
  }
};
