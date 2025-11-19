import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Activity,
  MessageSquare,
  Paperclip,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase, type Lead } from '../lib/supabase';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import type {
  WhatsappCampaignMetricsSummary,
  WhatsappCampaignStep,
  WhatsappCampaignStepConfig,
  WhatsappCampaignStepType,
  WhatsappCampaignTarget,
  WhatsappCampaignWithRelations,
} from '../types/whatsappCampaigns';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em execução',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

type EditableStep = {
  id?: string;
  name: string;
  step_type: WhatsappCampaignStepType;
  config: WhatsappCampaignStepConfig;
};

type AudienceFilter = {
  status: string;
  responsavel: string;
  startDate: string;
  endDate: string;
  excludeToday: boolean;
};

const cloneConfig = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const defaultStepConfig: Record<WhatsappCampaignStepType, WhatsappCampaignStepConfig> = {
  message: { message: { body: '' } },
  attachment: {
    attachment: {
      attachmentType: 'document',
      payload: '',
      caption: '',
      fileName: '',
      mimeType: '',
    },
  },
  wait_condition: {
    wait: {
      strategy: 'duration',
      durationSeconds: 300,
      timeoutSeconds: 900,
    },
  },
};

const initialFilter: AudienceFilter = {
  status: '',
  responsavel: '',
  startDate: '',
  endDate: '',
  excludeToday: false,
};

const TARGET_STATUS_LABELS: Record<keyof WhatsappCampaignMetricsSummary, string> = {
  pending: 'Pendentes',
  in_progress: 'Em andamento',
  waiting: 'Aguardando condição',
  paused: 'Pausadas',
  completed: 'Concluídas',
  failed: 'Falhas',
};

const MESSAGE_VARIABLES = [
  {
    token: '{{saudacao}}',
    description: 'Saudação automática de acordo com o horário (bom dia/boa tarde/boa noite).',
  },
  {
    token: '{{greeting}}',
    description: 'Alias de {{saudacao}}.',
  },
  { token: '{{nome}}', description: 'Nome completo do lead.' },
  { token: '{{lead_nome}}', description: 'Alias de {{nome}}.' },
  { token: '{{primeiro_nome}}', description: 'Primeiro nome do lead.' },
  { token: '{{lead_primeiro_nome}}', description: 'Alias de {{primeiro_nome}}.' },
  { token: '{{telefone}}', description: 'Telefone do lead.' },
  { token: '{{lead_status}}', description: 'Status atual do lead.' },
  { token: '{{lead_origem}}', description: 'Origem do lead.' },
  { token: '{{lead_tipo_contratacao}}', description: 'Tipo de contratação do lead.' },
  { token: '{{lead_responsavel}}', description: 'Responsável pelo lead.' },
  { token: '{{lead_data_cadastro}}', description: 'Data de cadastro do lead.' },
  { token: '{{campanha_nome}}', description: 'Nome da campanha atual.' },
  { token: '{{data_envio}}', description: 'Data em que a mensagem é enviada.' },
  { token: '{{hora_envio}}', description: 'Hora em que a mensagem é enviada.' },
  { token: '{{contrato_codigo}}', description: 'Código do contrato do lead.' },
  { token: '{{contrato_status}}', description: 'Status do contrato do lead.' },
  { token: '{{contrato_modalidade}}', description: 'Modalidade do contrato do lead.' },
  { token: '{{contrato_operadora}}', description: 'Operadora do contrato do lead.' },
  { token: '{{contrato_plano}}', description: 'Plano/produto do contrato do lead.' },
  { token: '{{contrato_mensalidade}}', description: 'Mensalidade formatada do contrato do lead.' },
  { token: '{{contrato_criado_em}}', description: 'Data de criação do contrato do lead.' },
  {
    token: '{{meta_<campo>}}',
    description:
      'Metadados enviados com o lead (ex.: {{meta_cor}}, {{meta_uf}}). Útil para campos personalizados.',
  },
];

const MESSAGE_VARIABLE_HINTS = MESSAGE_VARIABLES.slice(0, 8).map(variable => variable.token);

const summarizeTargets = (targets: WhatsappCampaignTarget[] | undefined): WhatsappCampaignMetricsSummary => {
  const summary: WhatsappCampaignMetricsSummary = {
    pending: 0,
    in_progress: 0,
    waiting: 0,
    paused: 0,
    completed: 0,
    failed: 0,
  };

  (targets ?? []).forEach(target => {
    summary[target.status] = (summary[target.status] ?? 0) + 1;
  });

  return summary;
};

export default function WhatsappCampaignsPage() {
  const [campaigns, setCampaigns] = useState<WhatsappCampaignWithRelations[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsDraft, setStepsDraft] = useState<EditableStep[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [leadsPreview, setLeadsPreview] = useState<Lead[]>([]);
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>(initialFilter);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showVariableList, setShowVariableList] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);
  const [campaignEditor, setCampaignEditor] = useState<{ name: string; description: string } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const loadCampaigns = useCallback(async () => {
    setCampaignLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*, targets:whatsapp_campaign_targets(*)')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      const records = (data ?? []) as WhatsappCampaignWithRelations[];
      setCampaigns(records);
      if (!selectedCampaignId && records.length > 0) {
        setSelectedCampaignId(records[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
      setErrorMessage('Não foi possível carregar as campanhas.');
    } finally {
      setCampaignLoading(false);
    }
  }, [selectedCampaignId]);

  const loadLeadsMetadata = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('status, responsavel')
        .eq('arquivado', false);

      if (error) {
        throw error;
      }

      const statuses = new Set<string>();
      const owners = new Set<string>();

      (data ?? []).forEach(entry => {
        if (entry.status) {
          statuses.add(entry.status);
        }
        if (entry.responsavel) {
          owners.add(entry.responsavel);
        }
      });

      setAvailableStatuses(Array.from(statuses));
      setAvailableOwners(Array.from(owners));
    } catch (err) {
      console.error('Erro ao carregar metadados de leads:', err);
    }
  }, []);

  const loadSteps = useCallback(async (campaignId: string) => {
    setStepsLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaign_steps')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order_index', { ascending: true });

      if (error) {
        throw error;
      }

      const editableSteps = (data ?? []).map(step => ({
        id: step.id,
        name: step.name,
        step_type: step.step_type as WhatsappCampaignStepType,
        config: step.config as WhatsappCampaignStepConfig,
      }));

      setStepsDraft(editableSteps);
    } catch (err) {
      console.error('Erro ao carregar passos da campanha:', err);
      setErrorMessage('Não foi possível carregar os passos.');
      setStepsDraft([]);
    } finally {
      setStepsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadLeadsMetadata();
  }, [loadCampaigns, loadLeadsMetadata]);

  useEffect(() => {
    if (selectedCampaignId) {
      const selected = campaigns.find(entry => entry.id === selectedCampaignId) ?? null;
      if (selected) {
        setCampaignEditor({ name: selected.name, description: selected.description ?? '' });
        void loadSteps(selected.id);
      }
    } else {
      setCampaignEditor(null);
      setStepsDraft([]);
    }
  }, [selectedCampaignId, campaigns, loadSteps]);

  const selectedCampaign = useMemo(
    () => campaigns.find(entry => entry.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const handleCreateCampaign = useCallback(async () => {
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          name: `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
          description: 'Nova campanha automática.',
          status: 'draft',
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      await loadCampaigns();
      setSelectedCampaignId(data?.id ?? null);
      setFeedbackMessage('Campanha criada com sucesso.');
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setErrorMessage('Não foi possível criar a campanha.');
    }
  }, [loadCampaigns]);

  const handleCampaignInfoSave = useCallback(async () => {
    if (!selectedCampaignId || !campaignEditor) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const { error } = await supabase
        .from('whatsapp_campaigns')
        .update({ name: campaignEditor.name, description: campaignEditor.description })
        .eq('id', selectedCampaignId);

      if (error) {
        throw error;
      }

      setFeedbackMessage('Informações atualizadas com sucesso.');
      await loadCampaigns();
    } catch (err) {
      console.error('Erro ao atualizar campanha:', err);
      setErrorMessage('Não foi possível atualizar a campanha.');
    }
  }, [campaignEditor, selectedCampaignId, loadCampaigns]);

  const handleCampaignStatusChange = useCallback(
    async (status: WhatsappCampaignWithRelations['status']) => {
      if (!selectedCampaignId) {
        return;
      }

      setErrorMessage(null);
      setFeedbackMessage(null);
      setUpdatingStatus(true);

      try {
        const { error } = await supabase
          .from('whatsapp_campaigns')
          .update({ status })
          .eq('id', selectedCampaignId);

        if (error) {
          throw error;
        }

        await loadCampaigns();
        setFeedbackMessage(
          status === 'running'
            ? 'Campanha iniciada com sucesso.'
            : status === 'paused'
              ? 'Campanha pausada com sucesso.'
              : 'Status atualizado com sucesso.',
        );
      } catch (err) {
        console.error('Erro ao atualizar status da campanha:', err);
        setErrorMessage('Não foi possível atualizar o status da campanha.');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [loadCampaigns, selectedCampaignId],
  );

  const handleDeleteCampaign = useCallback(async () => {
    if (!selectedCampaignId) {
      return;
    }

    const confirmation = await requestConfirmation({
      title: 'Excluir campanha',
      description: 'Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir campanha',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmation) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      await supabase.from('whatsapp_campaign_steps').delete().eq('campaign_id', selectedCampaignId);
      await supabase.from('whatsapp_campaign_targets').delete().eq('campaign_id', selectedCampaignId);

      const { error } = await supabase.from('whatsapp_campaigns').delete().eq('id', selectedCampaignId);

      if (error) {
        throw error;
      }

      setSelectedCampaignId(null);
      setCampaignEditor(null);
      setStepsDraft([]);
      setLeadsPreview([]);
      await loadCampaigns();
      setFeedbackMessage('Campanha excluída com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir campanha:', err);
      setErrorMessage('Não foi possível excluir a campanha.');
    }
  }, [loadCampaigns, requestConfirmation, selectedCampaignId]);

  const handleAddStep = (stepType: WhatsappCampaignStepType) => {
    setStepsDraft(prev => [
      ...prev,
      {
        name: `Passo ${prev.length + 1}`,
        step_type: stepType,
        config: cloneConfig(defaultStepConfig[stepType]),
      },
    ]);
  };

  const updateStep = (index: number, updater: (step: EditableStep) => EditableStep) => {
    setStepsDraft(prev => prev.map((step, idx) => (idx === index ? updater(step) : step)));
  };

  const removeStep = (index: number) => {
    setStepsDraft(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveSteps = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setSavingSteps(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await supabase
        .from('whatsapp_campaign_steps')
        .delete()
        .eq('campaign_id', selectedCampaignId);

      if (stepsDraft.length > 0) {
        const payload: Partial<WhatsappCampaignStep>[] = stepsDraft.map((step, index) => ({
          campaign_id: selectedCampaignId,
          name: step.name || `Passo ${index + 1}`,
          step_type: step.step_type,
          order_index: index,
          config: step.config,
        }));

        const { error } = await supabase.from('whatsapp_campaign_steps').insert(payload);
        if (error) {
          throw error;
        }
      }

      setFeedbackMessage('Fluxo salvo com sucesso.');
      await loadSteps(selectedCampaignId);
    } catch (err) {
      console.error('Erro ao salvar passos da campanha:', err);
      setErrorMessage('Não foi possível salvar os passos.');
    } finally {
      setSavingSteps(false);
    }
  };

  const handlePreviewAudience = async () => {
    if (!selectedCampaignId) {
      return;
    }

    setLeadsLoading(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      let query = supabase.from('leads').select('*').eq('arquivado', false).limit(100);
      if (audienceFilter.status) {
        query = query.eq('status', audienceFilter.status);
      }
      if (audienceFilter.responsavel) {
        query = query.eq('responsavel', audienceFilter.responsavel);
      }
      if (audienceFilter.excludeToday) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.lt('created_at', today.toISOString());
      } else {
        if (audienceFilter.startDate) {
          const startDate = new Date(audienceFilter.startDate);
          if (!Number.isNaN(startDate.getTime())) {
            startDate.setHours(0, 0, 0, 0);
            query = query.gte('created_at', startDate.toISOString());
          }
        }
        if (audienceFilter.endDate) {
          const endDate = new Date(audienceFilter.endDate);
          if (!Number.isNaN(endDate.getTime())) {
            endDate.setHours(0, 0, 0, 0);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('created_at', endDate.toISOString());
          }
        }
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      setLeadsPreview((data ?? []) as Lead[]);
    } catch (err) {
      console.error('Erro ao filtrar leads:', err);
      setErrorMessage('Não foi possível buscar os leads.');
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleSyncAudience = async () => {
    if (!selectedCampaignId || leadsPreview.length === 0) {
      return;
    }

    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const payload = leadsPreview
        .filter(lead => lead.telefone)
        .map(lead => ({
          campaign_id: selectedCampaignId,
          lead_id: lead.id,
          phone: lead.telefone,
          status: 'pending',
        }));

      if (payload.length === 0) {
        setErrorMessage('Nenhum lead com telefone válido para adicionar.');
        return;
      }

      const { error } = await supabase
        .from('whatsapp_campaign_targets')
        .upsert(payload, { onConflict: 'campaign_id,lead_id' });

      if (error) {
        throw error;
      }

      setFeedbackMessage('Público atualizado com sucesso.');
      await loadCampaigns();
    } catch (err) {
      console.error('Erro ao atualizar público:', err);
      setErrorMessage('Não foi possível atualizar o público.');
    }
  };

  const metricsSummary = summarizeTargets(selectedCampaign?.targets);
  const canStartCampaign = selectedCampaign?.status === 'draft' || selectedCampaign?.status === 'paused';
  const canPauseCampaign = selectedCampaign?.status === 'running';

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <Helmet>
        <title>Campanhas WhatsApp</title>
      </Helmet>
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white lg:max-w-xs lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Campanhas</h2>
            <button
              type="button"
              onClick={handleCreateCampaign}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" /> Novo
            </button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-4rem)]">
            {campaignLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">Carregando...</p>
            ) : campaigns.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">Nenhuma campanha cadastrada.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {campaigns.map(campaign => {
                  const isActive = campaign.id === selectedCampaignId;
                  const summary = summarizeTargets(campaign.targets);
                  return (
                    <li key={campaign.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignId(campaign.id)}
                        className={`w-full px-4 py-3 text-left transition ${
                          isActive ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-semibold">{campaign.name}</p>
                        <p className="text-xs text-slate-500">{STATUS_LABELS[campaign.status] ?? campaign.status}</p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Público: {(campaign.targets ?? []).length} • Em fila: {summary.pending}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {errorMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            {feedbackMessage ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedbackMessage}
              </div>
            ) : null}

            {!selectedCampaign ? (
              <p className="text-sm text-slate-500">Selecione ou crie uma campanha para começar.</p>
            ) : (
              <>
                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nome da campanha
                      </label>
                      <input
                        type="text"
                        value={campaignEditor?.name ?? ''}
                        onChange={event =>
                          setCampaignEditor(previous => ({
                            ...(previous ?? { name: '', description: '' }),
                            name: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {STATUS_LABELS[selectedCampaign.status] ?? selectedCampaign.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canPauseCampaign ? (
                          <button
                            type="button"
                            onClick={() => handleCampaignStatusChange('paused')}
                            disabled={updatingStatus}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
                          >
                            <PauseCircle className="h-4 w-4" /> Pausar campanha
                          </button>
                        ) : null}
                        {canStartCampaign ? (
                          <button
                            type="button"
                            onClick={() => handleCampaignStatusChange('running')}
                            disabled={updatingStatus}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                          >
                            <PlayCircle className="h-4 w-4" />
                            {selectedCampaign.status === 'paused' ? 'Retomar campanha' : 'Iniciar campanha'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Descrição
                    </label>
                    <textarea
                      value={campaignEditor?.description ?? ''}
                      onChange={event =>
                        setCampaignEditor(previous => ({
                          ...(previous ?? { name: '', description: '' }),
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleDeleteCampaign}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" /> Excluir campanha
                    </button>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleCampaignInfoSave}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                      >
                        <RefreshCw className="h-4 w-4" /> Salvar informações
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Fluxo de passos</h3>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleAddStep('message')}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
                      >
                        <MessageSquare className="h-4 w-4" /> Mensagem
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStep('attachment')}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
                      >
                        <Paperclip className="h-4 w-4" /> Anexo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddStep('wait_condition')}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
                      >
                        <Activity className="h-4 w-4" /> Espera
                      </button>
                    </div>
                  </div>
                  {stepsLoading ? (
                    <p className="mt-4 text-sm text-slate-500">Carregando passos...</p>
                  ) : stepsDraft.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">Nenhum passo configurado.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {stepsDraft.map((step, index) => (
                        <div key={`${step.step_type}-${index}`} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{step.name}</p>
                              <p className="text-xs text-slate-500">
                                {step.step_type === 'message'
                                  ? 'Mensagem personalizada'
                                  : step.step_type === 'attachment'
                                  ? 'Envio de anexo'
                                  : 'Espera condicional'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeStep(index)}
                              className="text-xs font-semibold text-red-500"
                            >
                              Remover
                            </button>
                          </div>
                          <div className="mt-3 space-y-3 text-sm text-slate-600">
                            {step.step_type === 'message' ? (
                              <div className="space-y-2">
                                <textarea
                                  value={step.config?.message?.body ?? ''}
                                  onChange={event =>
                                    updateStep(index, previous => ({
                                      ...previous,
                                      config: {
                                        ...previous.config,
                                        message: { body: event.target.value },
                                      },
                                    }))
                                  }
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                                  placeholder="Mensagem que será enviada ao lead"
                                />
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-xs text-slate-500">
                                    Use variáveis como{' '}
                                    {MESSAGE_VARIABLE_HINTS.map((token, hintIndex) => (
                                      <code
                                        key={`${token}-${hintIndex}`}
                                        className="mr-1 rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700"
                                      >
                                        {token}
                                      </code>
                                    ))}
                                    para personalizar com nome, saudação, datas e contratos.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setShowVariableList(previous => !previous)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-700 sm:w-auto"
                                  >
                                    {showVariableList ? 'Ocultar variáveis' : 'Ver todas as variáveis'}
                                  </button>
                                </div>
                                {showVariableList ? (
                                  <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-slate-700">Variáveis disponíveis</p>
                                      <button
                                        type="button"
                                        onClick={() => setShowVariableList(false)}
                                        className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
                                      >
                                        Fechar
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      {MESSAGE_VARIABLES.map(variable => (
                                        <div
                                          key={variable.token}
                                          className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                                        >
                                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                                            {variable.token}
                                          </code>
                                          <p className="mt-1 text-[11px] leading-snug text-slate-600">
                                            {variable.description}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {step.step_type === 'attachment' ? (
                              <div className="space-y-2">
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Tipo de anexo
                                  <select
                                    value={step.config?.attachment?.attachmentType ?? 'document'}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          attachment: {
                                            ...(previous.config?.attachment ?? defaultStepConfig.attachment.attachment!),
                                            attachmentType: event.target.value as 'document' | 'image' | 'video' | 'audio',
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  >
                                    <option value="document">Documento</option>
                                    <option value="image">Imagem</option>
                                    <option value="video">Vídeo</option>
                                    <option value="audio">Áudio</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Conteúdo (URL ou base64)
                                  <textarea
                                    value={step.config?.attachment?.payload ?? ''}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          attachment: {
                                            ...(previous.config?.attachment ?? defaultStepConfig.attachment.attachment!),
                                            payload: event.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    rows={2}
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Texto de apoio
                                  <input
                                    type="text"
                                    value={step.config?.attachment?.caption ?? ''}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          attachment: {
                                            ...(previous.config?.attachment ?? defaultStepConfig.attachment.attachment!),
                                            caption: event.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  />
                                </label>
                              </div>
                            ) : null}

                            {step.step_type === 'wait_condition' ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Estratégia
                                  <select
                                    value={step.config?.wait?.strategy ?? 'duration'}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          wait: {
                                            ...(previous.config?.wait ?? defaultStepConfig['wait_condition'].wait!),
                                            strategy: event.target.value as 'duration' | 'reply',
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  >
                                    <option value="duration">Tempo fixo</option>
                                    <option value="reply">Até resposta</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Duração (segundos)
                                  <input
                                    type="number"
                                    value={step.config?.wait?.durationSeconds ?? 300}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          wait: {
                                            ...(previous.config?.wait ?? defaultStepConfig['wait_condition'].wait!),
                                            durationSeconds: Number(event.target.value),
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                                  Tempo máximo aguardando resposta (segundos)
                                  <input
                                    type="number"
                                    value={step.config?.wait?.timeoutSeconds ?? 900}
                                    onChange={event =>
                                      updateStep(index, previous => ({
                                        ...previous,
                                        config: {
                                          ...previous.config,
                                          wait: {
                                            ...(previous.config?.wait ?? defaultStepConfig['wait_condition'].wait!),
                                            timeoutSeconds: Number(event.target.value),
                                          },
                                        },
                                      }))
                                    }
                                    className="rounded-lg border border-slate-200 px-3 py-2"
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSteps}
                      disabled={savingSteps}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                    >
                      <RefreshCw className="h-4 w-4" /> Salvar fluxo
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Público alvo</h3>
                    <span className="text-xs text-slate-500">
                      Leads ativos: {(selectedCampaign.targets ?? []).length}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      Status do lead
                      <select
                        value={audienceFilter.status}
                        onChange={event =>
                          setAudienceFilter(previous => ({ ...previous, status: event.target.value }))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Todos</option>
                        {availableStatuses.map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                      Responsável
                      <select
                        value={audienceFilter.responsavel}
                        onChange={event =>
                          setAudienceFilter(previous => ({ ...previous, responsavel: event.target.value }))
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Todos</option>
                        {availableOwners.map(owner => (
                          <option key={owner} value={owner}>
                            {owner}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:col-span-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        Criados a partir de
                        <input
                          type="date"
                          value={audienceFilter.startDate}
                          onChange={event =>
                            setAudienceFilter(previous => ({
                              ...previous,
                              excludeToday: false,
                              startDate: event.target.value,
                            }))
                          }
                          disabled={audienceFilter.excludeToday}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
                        Criados até
                        <input
                          type="date"
                          value={audienceFilter.endDate}
                          onChange={event =>
                            setAudienceFilter(previous => ({
                              ...previous,
                              excludeToday: false,
                              endDate: event.target.value,
                            }))
                          }
                          disabled={audienceFilter.excludeToday}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={audienceFilter.excludeToday}
                        onChange={event =>
                          setAudienceFilter(previous => ({
                            ...previous,
                            excludeToday: event.target.checked,
                            startDate: event.target.checked ? '' : previous.startDate,
                            endDate: event.target.checked ? '' : previous.endDate,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Excluir leads criados hoje
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewAudience}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      <Users className="h-4 w-4" /> Filtrar leads
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncAudience}
                      disabled={leadsPreview.length === 0}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                    >
                      Sincronizar público
                    </button>
                  </div>
                  <div className="mt-4">
                    {leadsLoading ? (
                      <p className="text-sm text-slate-500">Carregando leads...</p>
                    ) : leadsPreview.length === 0 ? (
                      <p className="text-sm text-slate-400">Nenhum lead selecionado.</p>
                    ) : (
                      <ul className="space-y-2">
                        {leadsPreview.map(lead => (
                          <li key={lead.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            {lead.nome_completo} • {lead.telefone}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Métricas</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    {Object.entries(TARGET_STATUS_LABELS).map(([status, label]) => (
                      <div key={status} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                        <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                        <p className="text-lg font-semibold text-slate-800">
                          {metricsSummary[status as keyof typeof TARGET_STATUS_LABELS]}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
      {ConfirmationDialog}
    </div>
  );
}
