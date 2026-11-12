import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../../lib/toast';
import { leadOpportunitiesRepository } from '../data/leadOpportunitiesRepository';
import type { ChangeLeadOpportunity, CreateLeadOpportunity, LeadOpportunitiesSnapshot, RelatedLead } from '../domain/leadOpportunities';

export function useRelatedLeadSearch(query: string) {
  const [results, setResults] = useState<RelatedLead[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retrySearch, setRetrySearch] = useState(0);
  useEffect(() => {
    let active = true;
    setResults([]);
    setSearchError(null);
    if (query.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      void leadOpportunitiesRepository.search(query).then((next) => { if (active) setResults(next); })
        .catch(() => { if (active) setSearchError('Não foi possível buscar os contatos. Tente novamente.'); })
        .finally(() => { if (active) setSearching(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, retrySearch]);
  return { results, searching, searchError, retry: () => setRetrySearch((current) => current + 1) };
}

export function useLeadOpportunities(leadId: string) {
  const [snapshot, setSnapshot] = useState<LeadOpportunitiesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(false);
  const requestId = useRef(0);
  const mutationLock = useRef(false);

  const reload = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await leadOpportunitiesRepository.list(leadId);
      if (mounted.current && current === requestId.current) setSnapshot(next);
      return true;
    } catch (cause) {
      if (mounted.current && current === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os vínculos. Tente novamente.');
      }
      return false;
    } finally {
      if (mounted.current && current === requestId.current) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    mounted.current = true;
    setSnapshot(null);
    void reload();
    return () => { mounted.current = false; requestId.current += 1; };
  }, [reload]);

  const mutate = useCallback(async (input: CreateLeadOpportunity | ChangeLeadOpportunity): Promise<boolean> => {
    if (mutationLock.current || loading || error) return false;
    mutationLock.current = true;
    setSaving(true);
    try {
      if ('clientRequestId' in input) await leadOpportunitiesRepository.create(input);
      else await leadOpportunitiesRepository.change(input);
      if (mounted.current) {
        toast.success('Vínculos da negociação atualizados.');
        await reload();
      }
      return true;
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : 'Não foi possível salvar os vínculos.';
        // Require a fresh read after an uncertain response or a concurrent edit.
        setError(message);
        toast.error(message);
      }
      return false;
    } finally {
      mutationLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }, [error, loading, reload]);

  return { snapshot, loading, error, saving, reload, mutate };
}
