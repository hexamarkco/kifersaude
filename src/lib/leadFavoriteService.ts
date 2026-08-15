import { useEffect, useState } from 'react';

import { supabase } from './supabase';

export const toggleLeadFavorito = async (leadId: string, nextFavorito: boolean): Promise<void> => {
  const { error } = await supabase.from('leads').update({ favorito: nextFavorito }).eq('id', leadId);
  if (error) {
    throw new Error(error.message || 'Não foi possível atualizar o favorito do lead.');
  }
};

// Para telas que só têm o lead_id (ex.: um chat do WhatsApp, um alvo de
// campanha) e não carregam o objeto Lead completo — buscar o id de todo
// lead favorito é bem mais simples do que buscar/juntar favorito por linha,
// já que favoritar é seletivo (poucos leads promissores, não a base toda).
export const useFavoritedLeadIds = (): Set<string> => {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.from('leads').select('id').eq('favorito', true);
      if (cancelled || error || !data) return;
      setIds(new Set(data.map((row) => row.id as string)));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return ids;
};
