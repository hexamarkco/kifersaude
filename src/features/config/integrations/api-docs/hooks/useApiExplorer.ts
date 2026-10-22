import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../../../contexts/AuthContext';
import { executeApiRequest, leadsApiBaseUrl } from '../data/apiDocsService';
import { apiEndpoints } from '../domain/catalog';
import { createRequestDraft, generateApiCurl, prepareApiRequest, type ApiRequestDraft, type ApiTestResult, type PreparedApiRequest } from '../domain/request';

export function useApiExplorer() {
  const { isAdmin, isObserver } = useAuth();
  const [endpointId, setEndpointId] = useState('health');
  const [drafts, setDrafts] = useState<Record<string, ApiRequestDraft>>({});
  const [result, setResult] = useState<ApiTestResult | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PreparedApiRequest | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const endpoint = apiEndpoints.find((item) => item.id === endpointId) ?? apiEndpoints[0];
  const draft = drafts[endpoint.id] ?? createRequestDraft(endpoint);
  const canExecute = endpoint.access === 'public' || endpoint.access === 'reader' && (isAdmin || isObserver)
    || endpoint.access === 'admin' && isAdmin;

  useEffect(() => () => { controller.current?.abort(); }, []);

  const updateDraft = (patch: Partial<ApiRequestDraft>) => {
    setDrafts((current) => ({ ...current, [endpoint.id]: { ...draft, ...patch } }));
    setError('');
  };

  const selectEndpoint = (id: string) => {
    if (controller.current) return;
    setEndpointId(id);
    setError('');
    setResult(null);
    setPending(null);
  };

  const execute = async (request: PreparedApiRequest) => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setPending(null);
    setRunning(true);
    setResult(null);
    setError('');
    const timeout = window.setTimeout(() => abort.abort('timeout'), 60_000);
    try {
      setResult(await executeApiRequest(request, abort.signal));
    } catch (cause) {
      setError(abort.signal.aborted
        ? abort.signal.reason === 'timeout'
          ? 'O serviço não respondeu em 60 segundos. A operação pode ter sido recebida; confira o CRM antes de repetir.'
          : 'Espera cancelada. Uma operação já recebida pelo servidor pode continuar; confira o CRM antes de repetir.'
        : cause instanceof TypeError
          ? 'Não foi possível conectar. Verifique sua conexão e a disponibilidade do serviço. Detalhes de rede estão no console do navegador.'
          : cause instanceof Error ? cause.message : 'Não foi possível executar a chamada.');
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      setRunning(false);
    }
  };

  const requestExecution = () => {
    if (!canExecute || controller.current) return;
    try {
      const request = prepareApiRequest(leadsApiBaseUrl, endpoint, draft);
      setError('');
      if (endpoint.impact) setPending(request);
      else void execute(request);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise os dados da chamada.');
    }
  };

  const formatBody = () => {
    try { updateDraft({ body: JSON.stringify(JSON.parse(draft.body), null, 2) }); }
    catch { setError('Não foi possível formatar: o corpo precisa conter JSON válido.'); }
  };

  return {
    endpoint, draft, updateDraft, selectEndpoint, result, error, pending, setPending, running,
    canExecute, requestExecution, execute, formatBody,
    cancel: () => controller.current?.abort(),
    reset: () => { updateDraft(createRequestDraft(endpoint)); setResult(null); },
    baseUrl: leadsApiBaseUrl, curl: generateApiCurl(leadsApiBaseUrl, endpoint, draft),
  };
}
