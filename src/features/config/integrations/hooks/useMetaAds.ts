import { useCallback, useEffect, useRef, useState } from 'react';
import { loadMetaAds, loadMetaHistory, requeueMetaReceipt, requeueMetaEvent, saveMetaReview } from '../data/metaAdsApi';
import type { MetaReviewInput, MetaSnapshot } from '../domain/metaAds';

export function useMetaAds() {
  const [snapshot, setSnapshot] = useState<MetaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [historyEnd, setHistoryEnd] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError(null);
    try {
      const data = await loadMetaAds(query);
      if (request === requestId.current) { setSnapshot(data); setHistoryEnd(false); }
    }
    catch (e) { if (request === requestId.current) setError(e instanceof Error ? e.message : 'Não foi possível consultar a integração.'); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [query]);
  useEffect(() => {
    const requestState = requestId;
    void refresh();
    return () => { requestState.current++; };
  }, [refresh]);
  const mutate = async (operation: () => Promise<void>, success: string) => {
    setSaving(true); setMessage(null); setError(null);
    try { await operation(); setMessage(success); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };
  return {
    snapshot, loading, saving, error, message, refresh,historyEnd,historyLoading,
    search: (term: string) => setQuery(term.trim()),
    loadHistory: async () => {
      const before = snapshot?.history[snapshot.history.length - 1]?.id;
      if (!before || historyLoading) return;
      const request = requestId.current;
      setHistoryLoading(true);
      try {
        const rows = await loadMetaHistory(before);
        if (request === requestId.current) {
          setSnapshot((previous) => previous ? { ...previous,history: [...previous.history,...rows] } : previous);
          setHistoryEnd(rows.length<50);
        }
      } catch { setError('Não foi possível consultar o histórico anterior.'); }
      finally { setHistoryLoading(false); }
    },
    review: (input: MetaReviewInput) => mutate(() => saveMetaReview(input), 'Avaliação registrada. Os sinais preparados dependem de liberação para envio.'),
    requeue: (id: string) => mutate(() => requeueMetaReceipt(id), 'Recebimento recolocado na fila. Aguarde o processamento.'),
    requeueEvent: (id: string) => mutate(() => requeueMetaEvent(id), 'Sinal retido para revisão. Uma nova liberação pelo administrador do servidor é necessária antes do envio.'),
  };
}
