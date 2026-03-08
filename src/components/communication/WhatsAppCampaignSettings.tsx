import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play, RefreshCw, Send, Square } from 'lucide-react';
import Button from '../ui/Button';
import { fetchAllPages, getUserManagementId, supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { WhatsAppCampaign, WhatsAppCampaignStatus } from '../../types/whatsappCampaigns';

type CampaignFilters = {
  status: string;
  responsavel: string;
  origem: string;
  canal: string;
};

type LeadPreviewRow = {
  id: string;
  nome_completo: string;
  telefone: string;
  status: string | null;
  responsavel: string | null;
  origem: string | null;
  canal: string | null;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

const DEFAULT_FILTERS: CampaignFilters = {
  status: '',
  responsavel: '',
  origem: '',
  canal: '',
};

const STATUS_LABELS: Record<WhatsAppCampaignStatus, string> = {
  draft: 'Rascunho',
  running: 'Em execucao',
  paused: 'Pausada',
  completed: 'Concluida',
  cancelled: 'Cancelada',
};

const STATUS_CLASSNAMES: Record<WhatsAppCampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  running: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const normalizePhoneForCampaign = (value: string | null | undefined): string => {
  const digitsOnly = (value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';

  if (digitsOnly.startsWith('55') && (digitsOnly.length === 12 || digitsOnly.length === 13)) {
    return digitsOnly;
  }

  if (!digitsOnly.startsWith('55') && (digitsOnly.length === 10 || digitsOnly.length === 11)) {
    return `55${digitsOnly}`;
  }

  return digitsOnly;
};

const buildChatIdFromPhoneDigits = (digits: string): string => `${digits}@s.whatsapp.net`;

const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('pt-BR');
};

const toSortedOptions = (input: Set<string>): string[] =>
  Array.from(input)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));

export default function WhatsAppCampaignSettings() {
  const { user } = useAuth();

  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_FILTERS);

  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [responsavelOptions, setResponsavelOptions] = useState<string[]>([]);
  const [origemOptions, setOrigemOptions] = useState<string[]>([]);
  const [canalOptions, setCanalOptions] = useState<string[]>([]);

  const [previewLeads, setPreviewLeads] = useState<LeadPreviewRow[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [processingCampaignId, setProcessingCampaignId] = useState<string | null>(null);
  const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<MessageState>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const hasRunningCampaign = useMemo(
    () => campaigns.some((campaign) => campaign.status === 'running'),
    [campaigns],
  );

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingCampaigns(true);
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) {
        throw error;
      }

      const nextCampaigns = (data ?? []) as WhatsAppCampaign[];
      setCampaigns(nextCampaigns);
      setSelectedCampaignId((current) => {
        if (current && nextCampaigns.some((campaign) => campaign.id === current)) {
          return current;
        }
        return nextCampaigns[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Erro ao carregar campanhas do WhatsApp:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel carregar as campanhas.' });
    } finally {
      if (!silent) {
        setLoadingCampaigns(false);
      }
    }
  }, []);

  const loadFilterOptions = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const rows = await fetchAllPages(async (from, to) => {
        const response = await supabase
          .from('leads')
          .select('status, responsavel, origem, canal')
          .eq('arquivado', false)
          .range(from, to);
        return { data: response.data, error: response.error };
      }, 1000);

      const statuses = new Set<string>();
      const responsaveis = new Set<string>();
      const origens = new Set<string>();
      const canais = new Set<string>();

      rows.forEach((row) => {
        const status = typeof row.status === 'string' ? row.status : '';
        const responsavel = typeof row.responsavel === 'string' ? row.responsavel : '';
        const origem = typeof row.origem === 'string' ? row.origem : '';
        const canal = typeof row.canal === 'string' ? row.canal : '';

        if (status.trim()) statuses.add(status);
        if (responsavel.trim()) responsaveis.add(responsavel);
        if (origem.trim()) origens.add(origem);
        if (canal.trim()) canais.add(canal);
      });

      setStatusOptions(toSortedOptions(statuses));
      setResponsavelOptions(toSortedOptions(responsaveis));
      setOrigemOptions(toSortedOptions(origens));
      setCanalOptions(toSortedOptions(canais));
    } catch (error) {
      console.error('Erro ao carregar opcoes de filtros das campanhas:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel carregar os filtros de leads.' });
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const recomputeCampaignCounters = useCallback(async (campaignId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_campaign_targets')
      .select('status')
      .eq('campaign_id', campaignId);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Array<{ status: string | null }>;
    const totalTargets = rows.length;
    const pendingTargets = rows.filter((row) => row.status === 'pending' || row.status === 'processing').length;
    const sentTargets = rows.filter((row) => row.status === 'sent').length;
    const failedTargets = rows.filter((row) => row.status === 'failed').length;
    const invalidTargets = rows.filter((row) => row.status === 'invalid').length;

    const { error: updateError } = await supabase
      .from('whatsapp_campaigns')
      .update({
        total_targets: totalTargets,
        pending_targets: pendingTargets,
        sent_targets: sentTargets,
        failed_targets: failedTargets,
        invalid_targets: invalidTargets,
      })
      .eq('id', campaignId);

    if (updateError) {
      throw updateError;
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadFilterOptions();
  }, [loadCampaigns, loadFilterOptions]);

  useEffect(() => {
    if (!hasRunningCampaign) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadCampaigns(true);
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasRunningCampaign, loadCampaigns]);

  const handlePreviewAudience = async () => {
    setLoadingPreview(true);
    setMessageState(null);

    try {
      let query = supabase
        .from('leads')
        .select('id, nome_completo, telefone, status, responsavel, origem, canal')
        .eq('arquivado', false)
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .limit(300);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.responsavel) {
        query = query.eq('responsavel', filters.responsavel);
      }
      if (filters.origem) {
        query = query.eq('origem', filters.origem);
      }
      if (filters.canal) {
        query = query.eq('canal', filters.canal);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setPreviewLeads((data ?? []) as LeadPreviewRow[]);
    } catch (error) {
      console.error('Erro ao gerar preview de publico da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel gerar o preview do publico.' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateCampaign = async () => {
    const normalizedMessage = campaignMessage.trim();
    if (!normalizedMessage) {
      setMessageState({ type: 'error', text: 'Informe a mensagem da campanha.' });
      return;
    }

    if (previewLeads.length === 0) {
      setMessageState({ type: 'error', text: 'Gere o preview de publico antes de criar a campanha.' });
      return;
    }

    setCreatingCampaign(true);
    setMessageState(null);

    try {
      const uniqueTargets = new Map<string, LeadPreviewRow>();

      previewLeads.forEach((lead) => {
        const normalizedPhone = normalizePhoneForCampaign(lead.telefone);
        if (!normalizedPhone) {
          return;
        }

        if (!uniqueTargets.has(normalizedPhone)) {
          uniqueTargets.set(normalizedPhone, lead);
        }
      });

      if (uniqueTargets.size === 0) {
        setMessageState({ type: 'error', text: 'Nenhum lead com telefone valido para campanha.' });
        return;
      }

      const campaignTitle = campaignName.trim() || `Campanha ${new Date().toLocaleDateString('pt-BR')}`;
      const createdBy = getUserManagementId(user);

      const { data: createdCampaign, error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          name: campaignTitle,
          message: normalizedMessage,
          status: 'draft',
          audience_filter: {
            status: filters.status || null,
            responsavel: filters.responsavel || null,
            origem: filters.origem || null,
            canal: filters.canal || null,
          },
          total_targets: uniqueTargets.size,
          pending_targets: uniqueTargets.size,
          sent_targets: 0,
          failed_targets: 0,
          invalid_targets: 0,
          created_by: createdBy,
        })
        .select('*')
        .single();

      if (campaignError || !createdCampaign) {
        throw campaignError || new Error('Erro ao criar campanha.');
      }

      const targetRows = Array.from(uniqueTargets.entries()).map(([phone, lead]) => ({
        campaign_id: createdCampaign.id,
        lead_id: lead.id,
        phone,
        chat_id: buildChatIdFromPhoneDigits(phone),
        status: 'pending',
      }));

      const { error: targetError } = await supabase
        .from('whatsapp_campaign_targets')
        .upsert(targetRows, { onConflict: 'campaign_id,phone' });

      if (targetError) {
        throw targetError;
      }

      await recomputeCampaignCounters(createdCampaign.id);
      await loadCampaigns();

      setSelectedCampaignId(createdCampaign.id);
      setMessageState({ type: 'success', text: 'Campanha criada com sucesso.' });
      setCampaignName('');
      setCampaignMessage('');
    } catch (error) {
      console.error('Erro ao criar campanha do WhatsApp:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel criar a campanha.' });
    } finally {
      setCreatingCampaign(false);
    }
  };

  const updateCampaignStatus = async (
    campaign: WhatsAppCampaign,
    status: WhatsAppCampaignStatus,
    options?: { clearCompletedAt?: boolean; setCompletedAt?: boolean },
  ) => {
    setActionCampaignId(campaign.id);
    setMessageState(null);

    try {
      const nowIso = new Date().toISOString();
      const payload: Record<string, unknown> = {
        status,
      };

      if (status === 'running') {
        payload.started_at = campaign.started_at ?? nowIso;
        payload.last_error = null;
      }

      if (options?.clearCompletedAt) {
        payload.completed_at = null;
      }

      if (options?.setCompletedAt) {
        payload.completed_at = nowIso;
      }

      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update(payload)
        .eq('id', campaign.id);

      if (error) {
        throw error;
      }

      await loadCampaigns();
    } catch (error) {
      console.error('Erro ao atualizar status da campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel atualizar o status da campanha.' });
    } finally {
      setActionCampaignId(null);
    }
  };

  const handleCancelCampaign = async (campaign: WhatsAppCampaign) => {
    setActionCampaignId(campaign.id);
    setMessageState(null);

    try {
      const nowIso = new Date().toISOString();

      const { error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .update({
          status: 'cancelled',
          completed_at: nowIso,
        })
        .eq('id', campaign.id);

      if (campaignError) {
        throw campaignError;
      }

      const { error: targetsError } = await supabase
        .from('whatsapp_campaign_targets')
        .update({
          status: 'cancelled',
          error_message: 'Campanha cancelada manualmente.',
          updated_at: nowIso,
        })
        .eq('campaign_id', campaign.id)
        .in('status', ['pending', 'processing']);

      if (targetsError) {
        throw targetsError;
      }

      await recomputeCampaignCounters(campaign.id);
      await loadCampaigns();

      setMessageState({ type: 'success', text: 'Campanha cancelada com sucesso.' });
    } catch (error) {
      console.error('Erro ao cancelar campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel cancelar a campanha.' });
    } finally {
      setActionCampaignId(null);
    }
  };

  const handleProcessNow = async (campaignId?: string) => {
    setProcessingCampaignId(campaignId || 'all');
    setMessageState(null);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-broadcast', {
        body: {
          action: 'process',
          campaignId: campaignId || null,
          limit: 60,
          source: 'manual-ui',
        },
      });

      if (error) {
        throw error;
      }

      const responseData = (data ?? null) as { error?: string; processed?: number; success?: boolean } | null;
      if (responseData?.error) {
        throw new Error(responseData.error);
      }

      await loadCampaigns();

      const processedCount = typeof responseData?.processed === 'number' ? responseData.processed : 0;
      setMessageState({
        type: 'success',
        text:
          processedCount > 0
            ? `Processamento concluido: ${processedCount} alvo(s) processado(s).`
            : 'Processamento concluido sem novos envios.',
      });
    } catch (error) {
      console.error('Erro ao processar campanhas manualmente:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel processar os envios agora.' });
    } finally {
      setProcessingCampaignId(null);
    }
  };

  return (
    <div className="space-y-5">
      {messageState && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageState.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{messageState.text}</span>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Nova campanha</h3>
            <p className="text-xs text-slate-500">Crie um disparo em massa com mensagem de texto e publico filtrado.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void handleProcessNow();
            }}
            loading={processingCampaignId === 'all'}
          >
            <RefreshCw className="h-4 w-4" />
            Processar fila agora
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            Nome da campanha
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Follow-up de cotacao"
            />
          </label>

          <label className="text-xs font-medium text-slate-600 md:col-span-2">
            Mensagem
            <textarea
              value={campaignMessage}
              onChange={(event) => setCampaignMessage(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Mensagem que sera enviada para todos os leads filtrados"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Responsavel
            <select
              value={filters.responsavel}
              onChange={(event) => setFilters((current) => ({ ...current, responsavel: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {responsavelOptions.map((responsavel) => (
                <option key={responsavel} value={responsavel}>
                  {responsavel}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Origem
            <select
              value={filters.origem}
              onChange={(event) => setFilters((current) => ({ ...current, origem: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todas</option>
              {origemOptions.map((origem) => (
                <option key={origem} value={origem}>
                  {origem}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Canal
            <select
              value={filters.canal}
              onChange={(event) => setFilters((current) => ({ ...current, canal: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {canalOptions.map((canal) => (
                <option key={canal} value={canal}>
                  {canal}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void handlePreviewAudience()} loading={loadingPreview}>
            <Send className="h-4 w-4" />
            Gerar preview
          </Button>
          <Button onClick={() => void handleCreateCampaign()} loading={creatingCampaign}>
            Criar campanha
          </Button>
          <span className="text-xs text-slate-500">
            Preview: <strong>{previewLeads.length}</strong> lead(s)
          </span>
        </div>

        {previewLeads.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leads no preview (max. 300)</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-700">
              {previewLeads.slice(0, 60).map((lead) => (
                <li key={lead.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  {lead.nome_completo} - {lead.telefone}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Campanhas criadas</h3>
          <Button variant="ghost" size="sm" onClick={() => void loadCampaigns()} loading={loadingCampaigns}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {loadingCampaigns ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma campanha cadastrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const isSelected = campaign.id === selectedCampaignId;
              const isActionLoading = actionCampaignId === campaign.id;
              const isProcessing = processingCampaignId === campaign.id;
              const canStart = campaign.status === 'draft' || campaign.status === 'paused';
              const canPause = campaign.status === 'running';
              const canCancel = campaign.status === 'draft' || campaign.status === 'running' || campaign.status === 'paused';

              return (
                <article
                  key={campaign.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected ? 'border-teal-300 bg-teal-50/50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                        <p className="text-xs text-slate-500">Criada em {formatDateTime(campaign.created_at)}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_CLASSNAMES[campaign.status]
                        }`}
                      >
                        {STATUS_LABELS[campaign.status]}
                      </span>
                    </div>
                  </button>

                  <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-5">
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Total: {campaign.total_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Pendentes: {campaign.pending_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Enviadas: {campaign.sent_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Falhas: {campaign.failed_targets}</div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">Invalidos: {campaign.invalid_targets}</div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{campaign.message}</p>

                  {campaign.last_error && (
                    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      Ultimo erro: {campaign.last_error}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() =>
                        void updateCampaignStatus(campaign, 'running', {
                          clearCompletedAt: true,
                        })
                      }
                      disabled={!canStart || isActionLoading || isProcessing}
                    >
                      <Play className="h-4 w-4" />
                      Iniciar
                    </Button>

                    <Button
                      size="sm"
                      variant="warning"
                      onClick={() => void updateCampaignStatus(campaign, 'paused')}
                      disabled={!canPause || isActionLoading || isProcessing}
                    >
                      <Pause className="h-4 w-4" />
                      Pausar
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void handleProcessNow(campaign.id);
                      }}
                      loading={isProcessing}
                      disabled={campaign.status !== 'running' || isActionLoading}
                    >
                      <Send className="h-4 w-4" />
                      Processar agora
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void handleCancelCampaign(campaign);
                      }}
                      disabled={!canCancel || isActionLoading || isProcessing}
                    >
                      <Square className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {selectedCampaign && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Selecionada: {selectedCampaign.name}</span>
              <span>Inicio: {formatDateTime(selectedCampaign.started_at)}</span>
              <span>Fim: {formatDateTime(selectedCampaign.completed_at)}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
