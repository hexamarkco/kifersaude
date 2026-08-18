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
//
// Assina mudanças em leads.favorito em tempo real: sem isso, favoritar um
// lead numa tela só refletia a estrela em outra tela depois de um refetch
// (ex.: F5), já que cada componente carregava a lista uma única vez no mount.
export const useFavoritedLeadIds = (): Set<string> => {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase.from('leads').select('id').eq('favorito', true);
      if (cancelled || error || !data) return;
      setIds(new Set(data.map((row) => row.id as string)));
    })();

    const channel = supabase
      .channel(`lead-favorito-changes-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          const newRow = payload.new as { id?: string; favorito?: boolean } | null;
          const oldRow = payload.old as { id?: string } | null;
          const leadId = newRow?.id ?? oldRow?.id;
          if (!leadId) return;

          setIds((current) => {
            const isFavorito = payload.eventType !== 'DELETE' && Boolean(newRow?.favorito);
            const alreadyIn = current.has(leadId);
            if (isFavorito === alreadyIn) return current;

            const next = new Set(current);
            if (isFavorito) {
              next.add(leadId);
            } else {
              next.delete(leadId);
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return ids;
};
