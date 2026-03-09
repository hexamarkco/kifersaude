import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import ReactFlow, { Background, Controls, MarkerType, MiniMap, Position, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import Button from '../ui/Button';
import { fetchAllPages, getUserManagementId, supabase } from '../../lib/supabase';
import { getAcceptedFileTypesByStepType, uploadWhatsAppCampaignMedia } from '../../lib/whatsappCampaignMediaService';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import type {
  WhatsAppCampaign,
  WhatsAppCampaignFlowStep,
  WhatsAppCampaignFlowStepType,
  WhatsAppCampaignStatus,
} from '../../types/whatsappCampaigns';

type CampaignFilters = {
  statusId: string;
  responsavelId: string;
  origemId: string;
  canal: string;
};

type LeadPreviewRow = {
  id: string;
  nome_completo: string;
  telefone: string;
  status_id: string | null;
  responsavel_id: string | null;
  origem_id: string | null;
  canal?: string | null;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

type FlowNodeData = {
  label: string;
  description: string;
};

type SelectOption = {
  id: string;
  label: string;
};

const DEFAULT_FILTERS: CampaignFilters = {
  statusId: '',
  responsavelId: '',
  origemId: '',
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

const FLOW_STEP_LABELS: Record<WhatsAppCampaignFlowStepType, string> = {
  text: 'Mensagem',
  image: 'Imagem',
  video: 'Video',
  audio: 'Audio',
  document: 'PDF / Documento',
};

const FLOW_STEP_ICONS: Record<WhatsAppCampaignFlowStepType, typeof MessageCircle> = {
  text: MessageCircle,
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
};

const FLOW_STEP_NODE_COLORS: Record<WhatsAppCampaignFlowStepType, string> = {
  text: '#0f766e',
  image: '#0284c7',
  video: '#7c3aed',
  audio: '#4338ca',
  document: '#b45309',
};

const createUniqueStepId = (): string => `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createFlowStep = (type: WhatsAppCampaignFlowStepType = 'text'): WhatsAppCampaignFlowStep => ({
  id: createUniqueStepId(),
  type,
  text: type === 'text' ? '' : undefined,
  mediaUrl: type === 'text' ? undefined : '',
  caption: type === 'text' ? undefined : '',
  filename: type === 'document' ? '' : undefined,
});

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

const summarizeStep = (step: WhatsAppCampaignFlowStep): string => {
  if (step.type === 'text') {
    const content = (step.text || '').trim();
    return content ? content.slice(0, 64) : 'Mensagem vazia';
  }

  const media = (step.mediaUrl || '').trim();
  if (!media) {
    return 'Arquivo pendente';
  }
  return media.length > 64 ? `${media.slice(0, 61)}...` : media;
};

const normalizeFlowStepType = (value: unknown): WhatsAppCampaignFlowStepType => {
  if (value === 'image' || value === 'video' || value === 'audio' || value === 'document') {
    return value;
  }
  return 'text';
};

const normalizeFlowSteps = (value: unknown, fallbackMessage: string): WhatsAppCampaignFlowStep[] => {
  if (!Array.isArray(value)) {
    return [
      {
        id: createUniqueStepId(),
        type: 'text',
        text: fallbackMessage || '',
        order: 0,
      },
    ];
  }

  const parsed: WhatsAppCampaignFlowStep[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const row = item as Record<string, unknown>;
    const type = normalizeFlowStepType(row.type);
    const id = typeof row.id === 'string' && row.id.trim() ? row.id : createUniqueStepId();

    parsed.push({
      id,
      type,
      order: typeof row.order === 'number' ? row.order : index,
      text: typeof row.text === 'string' ? row.text : undefined,
      mediaUrl: typeof row.mediaUrl === 'string' ? row.mediaUrl : undefined,
      caption: typeof row.caption === 'string' ? row.caption : undefined,
      filename: typeof row.filename === 'string' ? row.filename : undefined,
    });
  });

  parsed.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

  if (parsed.length === 0) {
    return [
      {
        id: createUniqueStepId(),
        type: 'text',
        text: fallbackMessage || '',
        order: 0,
      },
    ];
  }

  return parsed.map((step, index) => ({ ...step, order: index }));
};

const composeFallbackMessage = (steps: WhatsAppCampaignFlowStep[]): string => {
  const firstText = steps.find((step) => step.type === 'text' && step.text?.trim());
  if (firstText?.text?.trim()) {
    return firstText.text.trim();
  }

  const labels = steps.map((step) => FLOW_STEP_LABELS[step.type]);
  return labels.length > 0 ? `Fluxo: ${labels.join(' -> ')}` : 'Fluxo sem mensagem';
};

const buildFlowNodes = (steps: WhatsAppCampaignFlowStep[], selectedStepId: string | null): Node<FlowNodeData>[] => {
  return steps.map((step, index) => {
    const nodeColor = FLOW_STEP_NODE_COLORS[step.type];
    const selected = selectedStepId === step.id;

    return {
      id: step.id,
      position: {
        x: 80 + index * 250,
        y: 90,
      },
      data: {
        label: `${index + 1}. ${FLOW_STEP_LABELS[step.type]}`,
        description: summarizeStep(step),
      },
      draggable: false,
      selectable: true,
      style: {
        width: 220,
        borderRadius: 14,
        border: `2px solid ${selected ? nodeColor : '#d1d5db'}`,
        background: selected ? `${nodeColor}14` : '#ffffff',
        color: '#0f172a',
        boxShadow: selected ? '0 0 0 3px rgba(13, 148, 136, 0.15)' : '0 1px 2px rgba(15, 23, 42, 0.06)',
        padding: 8,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
};

const buildFlowEdges = (steps: WhatsAppCampaignFlowStep[]): Edge[] => {
  if (steps.length <= 1) {
    return [];
  }

  return steps.slice(0, -1).map((step, index) => ({
    id: `edge-${step.id}-${steps[index + 1].id}`,
    source: step.id,
    target: steps[index + 1].id,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
};

const toSortedOptions = (input: Set<string>): string[] =>
  Array.from(input)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));

const isMissingLeadsCanalColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';

  return code === '42703' && message.includes('leads.canal');
};

export default function WhatsAppCampaignSettings() {
  const { user } = useAuth();
  const { leadStatuses, leadOrigins, options } = useConfig();

  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [campaignName, setCampaignName] = useState('');
  const [filters, setFilters] = useState<CampaignFilters>(DEFAULT_FILTERS);
  const [canalOptions, setCanalOptions] = useState<string[]>([]);
  const [hasCanalColumn, setHasCanalColumn] = useState(true);

  const [flowSteps, setFlowSteps] = useState<WhatsAppCampaignFlowStep[]>(() => [createFlowStep('text')]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [previewLeads, setPreviewLeads] = useState<LeadPreviewRow[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [processingCampaignId, setProcessingCampaignId] = useState<string | null>(null);
  const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<MessageState>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const selectedStep = useMemo(
    () => flowSteps.find((step) => step.id === selectedStepId) ?? flowSteps[0] ?? null,
    [flowSteps, selectedStepId],
  );

  const hasRunningCampaign = useMemo(
    () => campaigns.some((campaign) => campaign.status === 'running'),
    [campaigns],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () =>
      leadStatuses
        .filter((status) => status.ativo)
        .map((status) => ({ id: status.id, label: status.nome }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [leadStatuses],
  );

  const responsavelOptions = useMemo<SelectOption[]>(
    () =>
      options.lead_responsavel
        .filter((option) => option.ativo)
        .map((option) => ({ id: option.id, label: option.label }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [options.lead_responsavel],
  );

  const origemOptions = useMemo<SelectOption[]>(
    () =>
      leadOrigins
        .filter((origin) => origin.ativo)
        .map((origin) => ({ id: origin.id, label: origin.nome }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR', { sensitivity: 'base' })),
    [leadOrigins],
  );

  const statusNameById = useMemo(() => {
    return new Map(statusOptions.map((option) => [option.id, option.label]));
  }, [statusOptions]);

  const responsavelNameById = useMemo(() => {
    return new Map(responsavelOptions.map((option) => [option.id, option.label]));
  }, [responsavelOptions]);

  const origemNameById = useMemo(() => {
    return new Map(origemOptions.map((option) => [option.id, option.label]));
  }, [origemOptions]);

  const flowNodes = useMemo<Node<FlowNodeData>[]>(() => buildFlowNodes(flowSteps, selectedStep?.id ?? null), [flowSteps, selectedStep?.id]);
  const flowEdges = useMemo<Edge[]>(() => buildFlowEdges(flowSteps), [flowSteps]);

  const loadCampaigns = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingCampaigns(true);
    }

    try {
      const { data, error } = await supabase
        .from('whatsapp_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      const nextCampaigns = ((data ?? []) as WhatsAppCampaign[]).map((campaign) => ({
        ...campaign,
        flow_steps: normalizeFlowSteps((campaign as WhatsAppCampaign & { flow_steps?: unknown }).flow_steps, campaign.message),
      }));

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

  const loadCanalOptions = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const rows = await fetchAllPages<{ canal: string | null }>(async (from, to) => {
        const response = await supabase
          .from('leads')
          .select('canal')
          .eq('arquivado', false)
          .range(from, to);
        return { data: response.data, error: response.error };
      }, 1000);

      const canais = new Set<string>();
      rows.forEach((row) => {
        if (typeof row.canal === 'string' && row.canal.trim()) {
          canais.add(row.canal);
        }
      });

      setHasCanalColumn(true);
      setCanalOptions(toSortedOptions(canais));
    } catch (error) {
      if (isMissingLeadsCanalColumnError(error)) {
        setHasCanalColumn(false);
        setCanalOptions([]);
        setFilters((current) => ({ ...current, canal: '' }));
        return;
      }

      console.error('Erro ao carregar canais para filtro de campanha:', error);
      setMessageState({ type: 'error', text: 'Nao foi possivel carregar os canais de leads.' });
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
    void loadCanalOptions();
  }, [loadCampaigns, loadCanalOptions]);

  useEffect(() => {
    if (!selectedStepId && flowSteps[0]) {
      setSelectedStepId(flowSteps[0].id);
    }
  }, [flowSteps, selectedStepId]);

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

  const addFlowStep = (type: WhatsAppCampaignFlowStepType) => {
    const newStep = createFlowStep(type);
    setFlowSteps((current) => [...current, { ...newStep, order: current.length }]);
    setSelectedStepId(newStep.id);
  };

  const updateSelectedStep = (updates: Partial<WhatsAppCampaignFlowStep>) => {
    if (!selectedStep) {
      return;
    }

    setFlowSteps((current) =>
      current.map((step) => {
        if (step.id !== selectedStep.id) {
          return step;
        }

        const nextType = normalizeFlowStepType(updates.type ?? step.type);
        const nextStep: WhatsAppCampaignFlowStep = {
          ...step,
          ...updates,
          type: nextType,
        };

        if (nextType === 'text') {
          nextStep.mediaUrl = undefined;
          nextStep.caption = undefined;
          nextStep.filename = undefined;
        } else {
          if (typeof nextStep.mediaUrl !== 'string') {
            nextStep.mediaUrl = '';
          }
          if (typeof nextStep.caption !== 'string') {
            nextStep.caption = '';
          }
          if (nextType === 'document') {
            if (typeof nextStep.filename !== 'string') {
              nextStep.filename = '';
            }
          } else {
            nextStep.filename = undefined;
          }

          nextStep.text = undefined;
        }

        return nextStep;
      }),
    );
  };

  const removeSelectedStep = () => {
    if (!selectedStep) {
      return;
    }

    setFlowSteps((current) => {
      if (current.length <= 1) {
        const replacement = createFlowStep('text');
        setSelectedStepId(replacement.id);
        return [replacement];
      }

      const remaining = current.filter((step) => step.id !== selectedStep.id).map((step, index) => ({ ...step, order: index }));
      setSelectedStepId(remaining[0]?.id ?? null);
      return remaining;
    });
  };

  const handleUploadFileToSelectedStep = async (file: File) => {
    if (!selectedStep || selectedStep.type === 'text') {
      return;
    }

    setUploadingStepId(selectedStep.id);
    setMessageState(null);

    try {
      const result = await uploadWhatsAppCampaignMedia(selectedStep.type, file);

      if (!result.success || !result.url) {
        setMessageState({
          type: 'error',
          text: result.error || 'Nao foi possivel enviar o arquivo da etapa.',
        });
        return;
      }

      updateSelectedStep({
        mediaUrl: result.url,
        filename: selectedStep.type === 'document' ? result.filename || selectedStep.filename || '' : undefined,
      });

      setMessageState({ type: 'success', text: 'Arquivo enviado com sucesso para a etapa.' });
    } finally {
      setUploadingStepId(null);
    }
  };

  const validateFlowSteps = (steps: WhatsAppCampaignFlowStep[]): string | null => {
    if (steps.length === 0) {
      return 'Adicione ao menos uma etapa no fluxo da campanha.';
    }

    for (const step of steps) {
      if (step.type === 'text') {
        if (!(step.text || '').trim()) {
          return 'Toda etapa de mensagem precisa ter texto preenchido.';
        }
      } else if (!(step.mediaUrl || '').trim()) {
        return `A etapa ${FLOW_STEP_LABELS[step.type]} precisa de arquivo enviado.`;
      }
    }

    return null;
  };

  const handlePreviewAudience = async () => {
    setLoadingPreview(true);
    setMessageState(null);

    try {
      const queryWithoutCanal = async (): Promise<LeadPreviewRow[]> => {
        let fallbackQuery = supabase
          .from('leads')
          .select('id, nome_completo, telefone, status_id, responsavel_id, origem_id')
          .eq('arquivado', false)
          .not('telefone', 'is', null)
          .neq('telefone', '')
          .limit(400);

        if (filters.statusId) {
          fallbackQuery = fallbackQuery.eq('status_id', filters.statusId);
        }
        if (filters.responsavelId) {
          fallbackQuery = fallbackQuery.eq('responsavel_id', filters.responsavelId);
        }
        if (filters.origemId) {
          fallbackQuery = fallbackQuery.eq('origem_id', filters.origemId);
        }

        const { data, error } = await fallbackQuery;
        if (error) {
          throw error;
        }

        return ((data ?? []) as LeadPreviewRow[]).map((lead) => ({
          ...lead,
          canal: null,
        }));
      };

      if (!hasCanalColumn) {
        setPreviewLeads(await queryWithoutCanal());
        return;
      }

      let query = supabase
        .from('leads')
        .select('id, nome_completo, telefone, status_id, responsavel_id, origem_id, canal')
        .eq('arquivado', false)
        .not('telefone', 'is', null)
        .neq('telefone', '')
        .limit(400);

      if (filters.statusId) {
        query = query.eq('status_id', filters.statusId);
      }
      if (filters.responsavelId) {
        query = query.eq('responsavel_id', filters.responsavelId);
      }
      if (filters.origemId) {
        query = query.eq('origem_id', filters.origemId);
      }
      if (filters.canal) {
        query = query.eq('canal', filters.canal);
      }

      const { data, error } = await query;

      if (error) {
        if (isMissingLeadsCanalColumnError(error)) {
          setHasCanalColumn(false);
          setCanalOptions([]);
          setFilters((current) => ({ ...current, canal: '' }));
          setPreviewLeads(await queryWithoutCanal());
          return;
        }

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
    const validationError = validateFlowSteps(flowSteps);
    if (validationError) {
      setMessageState({ type: 'error', text: validationError });
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
      const normalizedSteps = flowSteps.map((step, index) => ({ ...step, order: index }));

      const { data: createdCampaign, error: campaignError } = await supabase
        .from('whatsapp_campaigns')
        .insert({
          name: campaignTitle,
          message: composeFallbackMessage(normalizedSteps),
          flow_steps: normalizedSteps,
          status: 'draft',
          audience_filter: {
            status_id: filters.statusId || null,
            status_label: statusNameById.get(filters.statusId) ?? null,
            responsavel_id: filters.responsavelId || null,
            responsavel_label: responsavelNameById.get(filters.responsavelId) ?? null,
            origem_id: filters.origemId || null,
            origem_label: origemNameById.get(filters.origemId) ?? null,
            canal: hasCanalColumn ? filters.canal || null : null,
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
      setFlowSteps([createFlowStep('text')]);
      setSelectedStepId(null);
      setCampaignName('');
      setMessageState({ type: 'success', text: 'Campanha criada com sucesso.' });
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
      const payload: Record<string, unknown> = { status };

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
          limit: 50,
          source: 'manual-ui',
        },
      });

      if (error) {
        throw error;
      }

      const responseData = (data ?? null) as { error?: string; processed?: number } | null;
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
            <p className="text-xs text-slate-500">Monte o fluxo de mensagens com React Flow e dispare em lote para leads filtrados.</p>
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
          <label className="text-xs font-medium text-slate-600 md:col-span-2">
            Nome da campanha
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Ex: Reengajamento de cotacao"
            />
          </label>
        </div>

        <div className={`mt-4 grid gap-3 md:grid-cols-2 ${hasCanalColumn ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          <label className="text-xs font-medium text-slate-600">
            Status
            <select
              value={filters.statusId}
              onChange={(event) => setFilters((current) => ({ ...current, statusId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Responsavel
            <select
              value={filters.responsavelId}
              onChange={(event) => setFilters((current) => ({ ...current, responsavelId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todos</option>
              {responsavelOptions.map((responsavel) => (
                <option key={responsavel.id} value={responsavel.id}>
                  {responsavel.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600">
            Origem
            <select
              value={filters.origemId}
              onChange={(event) => setFilters((current) => ({ ...current, origemId: event.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={loadingFilters}
            >
              <option value="">Todas</option>
              {origemOptions.map((origem) => (
                <option key={origem.id} value={origem.id}>
                  {origem.label}
                </option>
              ))}
            </select>
          </label>

          {hasCanalColumn && (
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
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fluxo da campanha</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['text', 'image', 'document', 'video', 'audio'] as WhatsAppCampaignFlowStepType[]).map((type) => {
                const Icon = FLOW_STEP_ICONS[type];
                return (
                  <Button key={type} size="sm" variant="ghost" onClick={() => addFlowStep(type)}>
                    <Plus className="h-3.5 w-3.5" />
                    <Icon className="h-3.5 w-3.5" />
                    {FLOW_STEP_LABELS[type]}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white">
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                onNodeClick={(_, node) => setSelectedStepId(node.id)}
                proOptions={{ hideAttribution: true }}
              >
                <MiniMap pannable zoomable nodeStrokeWidth={3} />
                <Controls showInteractive={false} />
                <Background gap={18} size={1} color="#e2e8f0" />
              </ReactFlow>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              {selectedStep ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Etapa selecionada</p>
                    <Button size="sm" variant="danger" onClick={removeSelectedStep}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>

                  <label className="text-xs font-medium text-slate-600">
                    Tipo de envio
                    <select
                      value={selectedStep.type}
                      onChange={(event) => updateSelectedStep({ type: event.target.value as WhatsAppCampaignFlowStepType })}
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {Object.entries(FLOW_STEP_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedStep.type === 'text' ? (
                    <label className="text-xs font-medium text-slate-600">
                      Texto da mensagem
                      <textarea
                        value={selectedStep.text ?? ''}
                        onChange={(event) => updateSelectedStep({ text: event.target.value })}
                        rows={6}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Digite a mensagem desta etapa"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="text-xs font-medium text-slate-600">
                        Arquivo da etapa
                        <input
                          type="file"
                          accept={getAcceptedFileTypesByStepType(selectedStep.type)}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = '';
                            if (!file) {
                              return;
                            }

                            void handleUploadFileToSelectedStep(file);
                          }}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                          disabled={uploadingStepId === selectedStep.id}
                        />
                      </label>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {selectedStep.mediaUrl ? (
                          <span>
                            Arquivo pronto para envio: <strong>{selectedStep.filename || selectedStep.mediaUrl.split('/').pop() || 'arquivo'}</strong>
                          </span>
                        ) : (
                          <span>Nenhum arquivo enviado nesta etapa.</span>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">
                        <Upload className={`h-3.5 w-3.5 ${uploadingStepId === selectedStep.id ? 'animate-pulse' : ''}`} />
                        {uploadingStepId === selectedStep.id ? 'Enviando arquivo...' : 'Selecione um arquivo para upload'}
                      </div>

                      <label className="text-xs font-medium text-slate-600">
                        Legenda (opcional)
                        <textarea
                          value={selectedStep.caption ?? ''}
                          onChange={(event) => updateSelectedStep({ caption: event.target.value })}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Legenda para acompanhar a midia"
                        />
                      </label>

                      {selectedStep.type === 'document' && (
                        <label className="text-xs font-medium text-slate-600">
                          Nome do arquivo (opcional)
                          <input
                            type="text"
                            value={selectedStep.filename ?? ''}
                            onChange={(event) => updateSelectedStep({ filename: event.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="proposta.pdf"
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Selecione uma etapa no fluxo para editar.</p>
              )}
            </div>
          </div>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leads no preview (max. 400)</p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs text-slate-700">
              {previewLeads.slice(0, 80).map((lead) => (
                <li key={lead.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                  {lead.nome_completo} - {lead.telefone}
                  <span className="ml-1 text-slate-500">
                    ({statusNameById.get(lead.status_id || '') || 'Sem status'} / {responsavelNameById.get(lead.responsavel_id || '') || 'Sem responsavel'} /{' '}
                    {origemNameById.get(lead.origem_id || '') || 'Sem origem'})
                  </span>
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

                  <p className="mt-2 text-xs text-slate-600">Etapas do fluxo: {campaign.flow_steps.length}</p>

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
              <span>Etapas: {selectedCampaign.flow_steps.length}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
