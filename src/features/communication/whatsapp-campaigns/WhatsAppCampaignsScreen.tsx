import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Bot, CalendarClock, FileSpreadsheet, Filter, MessageCircle, PauseCircle, Pencil, PlayCircle, Plus, RefreshCw, Send, ShieldCheck, UserCircle, Users, X, type LucideIcon } from 'lucide-react';

import { Badge, Button, Card, Input, PageHeader, Textarea } from '../../../design-system';
import FilterMultiSelect from '../../../components/FilterMultiSelect';
import { useConfig } from '../../../contexts/ConfigContext';
import { toast } from '../../../lib/toast';
import { cx } from '../../../lib/cx';
import {
  commWhatsAppCampaignService,
  type CampaignStats,
  type CommWhatsAppAiIntentSuggestion,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignAudienceSource,
  type CommWhatsAppCampaignStepDraft,
  type CommWhatsAppCsvTargetDraft,
} from './commWhatsAppCampaignService';

type AudienceMode = 'crm' | 'csv';

const statusLabels: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  queued: 'Na fila',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
};

const statusTones: Record<CommWhatsAppCampaign['status'], 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'accent',
  queued: 'warning',
  running: 'success',
  paused: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const splitCsvLine = (line: string) => {
  const delimiter = line.includes(';') ? ';' : ',';
  return line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
};

const parseCsvTargets = (raw: string): CommWhatsAppCsvTargetDraft[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const hasHeader = headers.some((header) => ['nome', 'name', 'telefone', 'phone', 'celular'].includes(header));
  const startIndex = hasHeader ? 1 : 0;
  const nameIndex = hasHeader ? Math.max(headers.indexOf('nome'), headers.indexOf('name')) : 0;
  const phoneIndex = hasHeader
    ? ['telefone', 'phone', 'celular', 'whatsapp'].map((key) => headers.indexOf(key)).find((index) => index >= 0) ?? 1
    : 1;

  return lines.slice(startIndex).flatMap((line) => {
    const values = splitCsvLine(line);
    const phoneNumber = values[phoneIndex] ?? '';
    const displayName = values[nameIndex] ?? '';
    const payload = Object.fromEntries(values.map((value, index) => [hasHeader ? headers[index] || `coluna_${index + 1}` : `coluna_${index + 1}`, value]));

    if (!phoneNumber.trim()) return [];
    return [{ displayName, phoneNumber, payload }];
  });
};

const defaultStats: CampaignStats = {
  total: 0,
  drafts: 0,
  scheduled: 0,
  active: 0,
  aiSuggestionsPending: 0,
};

const readStringArrayFilter = (filters: Record<string, unknown>, pluralKey: string, legacyKey: string) => {
  const pluralValue = filters[pluralKey];
  if (Array.isArray(pluralValue)) return pluralValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const legacyValue = filters[legacyKey];
  return typeof legacyValue === 'string' && legacyValue.trim() ? [legacyValue.trim()] : [];
};

export default function WhatsAppCampaignsScreen() {
  const { leadStatuses, options } = useConfig();
  const [campaigns, setCampaigns] = useState<CommWhatsAppCampaign[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<CommWhatsAppAiIntentSuggestion[]>([]);
  const [stats, setStats] = useState<CampaignStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaignActionId, setCampaignActionId] = useState<string | null>(null);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CommWhatsAppCampaign | null>(null);
  const [loadingCampaignEdit, setLoadingCampaignEdit] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('crm');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [messageText, setMessageText] = useState('');
  const [steps, setSteps] = useState<CommWhatsAppCampaignStepDraft[]>([
    { messageText: '', delayAmount: 0, delayUnit: 'minutes' },
  ]);
  const [leadStatusFilters, setLeadStatusFilters] = useState<string[]>([]);
  const [leadOwnerFilters, setLeadOwnerFilters] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [createLeadsFromCsv, setCreateLeadsFromCsv] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [sendWindowStart, setSendWindowStart] = useState('');
  const [sendWindowEnd, setSendWindowEnd] = useState('');
  const [pacingPerMinute, setPacingPerMinute] = useState(12);

  const csvTargets = useMemo(() => parseCsvTargets(csvText), [csvText]);
  const leadStatusOptions = useMemo(
    () => leadStatuses.filter((status) => status.ativo).map((status) => ({ value: status.nome, label: status.nome })),
    [leadStatuses],
  );
  const leadOwnerOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo).map((option) => ({ value: option.value, label: option.label })),
    [options.lead_responsavel],
  );
  const firstMessageText = steps.find((step) => step.messageText.trim())?.messageText.trim() || messageText.trim();
  const csvValidTargets = useMemo(
    () => csvTargets.filter((target) => commWhatsAppCampaignService.normalizePhoneDigits(target.phoneNumber).length > 0),
    [csvTargets],
  );

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCampaigns, nextStats, nextSuggestions] = await Promise.all([
        commWhatsAppCampaignService.listCampaigns(),
        commWhatsAppCampaignService.getStats(),
        commWhatsAppCampaignService.listPendingAiSuggestions(),
      ]);
      setCampaigns(nextCampaigns);
      setStats(nextStats);
      setAiSuggestions(nextSuggestions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar os disparos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const resetCampaignForm = () => {
    setEditingCampaign(null);
    setAudienceMode('crm');
    setName('');
    setObjective('');
    setMessageText('');
    setSteps([{ messageText: '', delayAmount: 0, delayUnit: 'minutes' }]);
    setLeadStatusFilters([]);
    setLeadOwnerFilters([]);
    setCsvText('');
    setCreateLeadsFromCsv(false);
    setScheduledAt('');
    setSendWindowStart('');
    setSendWindowEnd('');
    setPacingPerMinute(12);
  };

  const openNewCampaignModal = () => {
    resetCampaignForm();
    setCampaignModalOpen(true);
  };

  const closeCampaignModal = () => {
    setCampaignModalOpen(false);
    resetCampaignForm();
  };

  const openEditCampaignModal = async (campaign: CommWhatsAppCampaign) => {
    setLoadingCampaignEdit(true);
    try {
      const campaignSteps = await commWhatsAppCampaignService.listCampaignSteps(campaign.id);
      const filters = campaign.audience_config?.filters && typeof campaign.audience_config.filters === 'object'
        ? campaign.audience_config.filters as Record<string, unknown>
        : {};
      setEditingCampaign(campaign);
      setAudienceMode(campaign.audience_source === 'csv' ? 'csv' : 'crm');
      setName(campaign.name);
      setObjective(campaign.objective ?? '');
      setMessageText(campaign.message_text ?? '');
      setSteps(campaignSteps.length > 0
        ? campaignSteps.map((step) => ({
            messageText: step.message_text,
            delayAmount: step.delay_amount,
            delayUnit: step.delay_unit,
          }))
        : [{ messageText: campaign.message_text ?? '', delayAmount: 0, delayUnit: 'minutes' }]);
      setLeadStatusFilters(readStringArrayFilter(filters, 'statuses', 'status'));
      setLeadOwnerFilters(readStringArrayFilter(filters, 'responsaveis', 'responsavel'));
      setCsvText('');
      setCreateLeadsFromCsv(campaign.create_leads_from_csv);
      setScheduledAt(campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '');
      setSendWindowStart(campaign.send_window_start ? campaign.send_window_start.slice(0, 5) : '');
      setSendWindowEnd(campaign.send_window_end ? campaign.send_window_end.slice(0, 5) : '');
      setPacingPerMinute(campaign.pacing_per_minute || 12);
      setCampaignModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar este disparo para edicao.');
    } finally {
      setLoadingCampaignEdit(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!name.trim()) {
      toast.warning('Informe um nome para o disparo.');
      return;
    }

    if (!firstMessageText) {
      toast.warning('Escreva pelo menos uma mensagem do disparo.');
      return;
    }

    if (!editingCampaign && audienceMode === 'csv' && csvValidTargets.length === 0) {
      toast.warning('Cole ou importe um CSV com pelo menos um telefone valido.');
      return;
    }

    setSaving(true);
    try {
      const audienceSource: CommWhatsAppCampaignAudienceSource = audienceMode;
      const audienceConfig = audienceMode === 'crm'
        ? {
            filters: {
              statuses: leadStatusFilters,
              responsaveis: leadOwnerFilters,
              only_active: true,
              exclude_opt_out: true,
            },
          }
        : {
            csv: {
              parsed_rows: csvTargets.length,
              valid_rows: csvValidTargets.length,
              create_leads: createLeadsFromCsv,
              exclude_opt_out: true,
            },
          };

      const normalizedSteps = steps
        .map((step, index) => ({
          messageText: step.messageText.trim(),
          delayAmount: index === 0 ? 0 : Math.max(Math.floor(step.delayAmount || 0), 0),
          delayUnit: step.delayUnit,
        }))
        .filter((step) => step.messageText.length > 0);

      const payload = {
        name,
        objective,
        audienceSource,
        audienceConfig,
        messageText: firstMessageText,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        pacingPerMinute,
        sendWindowStart: sendWindowStart || null,
        sendWindowEnd: sendWindowEnd || null,
        stopOnReply: true,
        createLeadsFromCsv,
        steps: normalizedSteps,
        csvTargets: !editingCampaign && audienceMode === 'csv' ? csvValidTargets : [],
      };

      if (editingCampaign) {
        await commWhatsAppCampaignService.updateCampaign(editingCampaign.id, payload);
      } else {
        await commWhatsAppCampaignService.createDraft(payload);
      }

      toast.success(editingCampaign ? 'Disparo atualizado.' : 'Disparo salvo.');
      closeCampaignModal();
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o disparo.');
    } finally {
      setSaving(false);
    }
  };

  const updateStep = (index: number, patch: Partial<CommWhatsAppCampaignStepDraft>) => {
    setSteps((current) => current.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step));
  };

  const addStep = () => {
    setSteps((current) => [...current, { messageText: '', delayAmount: 1, delayUnit: 'days' }]);
  };

  const removeStep = (index: number) => {
    setSteps((current) => current.length <= 1 ? current : current.filter((_, stepIndex) => stepIndex !== index));
  };

  const handleActivateCampaign = async (campaign: CommWhatsAppCampaign) => {
    setCampaignActionId(campaign.id);
    try {
      const result = await commWhatsAppCampaignService.activateCampaign(campaign.id);
      toast.success(result.status === 'scheduled' ? 'Disparo agendado e pronto para a fila.' : 'Disparo ativado e colocado na fila.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel ativar o disparo.');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleProcessCampaign = async (campaign: CommWhatsAppCampaign) => {
    setCampaignActionId(campaign.id);
    try {
      const result = await commWhatsAppCampaignService.processCampaign(campaign.id);
      toast.success(`Processamento concluido: ${result.sent ?? 0} enviado(s), ${result.failed ?? 0} falha(s).`);
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel processar o disparo.');
    } finally {
      setCampaignActionId(null);
    }
  };

  const handleAcceptSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.acceptAiSuggestion(suggestion);
      toast.success('Contato bloqueado para proximos disparos.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel bloquear este contato.');
    } finally {
      setSuggestionActionId(null);
    }
  };

  const handleDismissSuggestion = async (suggestion: CommWhatsAppAiIntentSuggestion) => {
    setSuggestionActionId(suggestion.id);
    try {
      await commWhatsAppCampaignService.dismissAiSuggestion(suggestion.id);
      toast.success('Sugestao dispensada.');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel dispensar a sugestao.');
    } finally {
      setSuggestionActionId(null);
    }
  };

  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos WhatsApp"
        description="Crie campanhas conversacionais para leads do CRM ou contatos importados por CSV, com base preparada para opt-out sinalizado por IA."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="whitespace-nowrap" onClick={openNewCampaignModal}>
              <Plus className="h-4 w-4" />
              Novo disparo
            </Button>
            <Button variant="secondary" className="whitespace-nowrap" onClick={() => void loadCampaigns()} loading={loading}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Send} label="Campanhas" value={stats.total} />
        <MetricCard icon={PauseCircle} label="Rascunhos" value={stats.drafts} />
        <MetricCard icon={CalendarClock} label="Agendadas" value={stats.scheduled} />
        <MetricCard icon={PlayCircle} label="Ativas" value={stats.active} />
        <MetricCard icon={Bot} label="Sugestoes IA" value={stats.aiSuggestionsPending} />
      </div>

      {aiSuggestions.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Sinais de IA para revisar</h2>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Respostas de campanhas que podem indicar opt-out, numero errado ou reclamacao. A IA apenas sinaliza; o bloqueio depende da sua confirmacao.</p>
            </div>
            <Badge tone="warning">{aiSuggestions.length} pendente(s)</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {aiSuggestions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{suggestion.chat?.display_name || suggestion.chat?.phone_number || suggestion.phone_digits || 'Contato sem nome'}</h3>
                    <p className="text-xs text-[color:var(--panel-text-muted)]">{suggestion.campaign?.name || 'Campanha sem nome'}</p>
                  </div>
                  <Badge tone={suggestion.intent === 'opt_out' || suggestion.intent === 'wrong_number' ? 'danger' : 'warning'} size="sm">
                    {formatIntentLabel(suggestion.intent)} · {Math.round((suggestion.confidence ?? 0) * 100)}%
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[color:var(--panel-text-soft)]">{suggestion.reason || 'A IA recomendou revisar esta resposta antes de novos disparos.'}</p>
                {suggestion.evidence && (
                  <blockquote className="mt-3 rounded-[var(--kds-radius-md)] border-l-4 border-[color:var(--panel-accent)] bg-[color:var(--panel-surface)] px-3 py-2 text-xs text-[color:var(--panel-text-soft)]">
                    {suggestion.evidence}
                  </blockquote>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="danger" loading={suggestionActionId === suggestion.id} onClick={() => void handleAcceptSuggestion(suggestion)}>
                    Bloquear disparos
                  </Button>
                  <Button size="sm" variant="secondary" loading={suggestionActionId === suggestion.id} onClick={() => void handleDismissSuggestion(suggestion)}>
                    Dispensar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {campaignModalOpen && (
        <div className="fixed inset-0 z-[2147482000] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
          <Card className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="whatsapp-campaign-modal-title">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--panel-border-subtle)] pb-4">
              <div>
                <h2 id="whatsapp-campaign-modal-title" className="text-lg font-semibold text-[color:var(--panel-text)]">{editingCampaign ? 'Editar disparo' : 'Novo disparo'}</h2>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Configure publico, pacote de mensagens, agendamento e ritmo de envio.</p>
              </div>
              <Button variant="icon" size="icon" onClick={closeCampaignModal} aria-label="Fechar modal de disparo">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto py-5 pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <LabelledField label="Nome da campanha">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Reativacao PME maio" />
            </LabelledField>
            <LabelledField label="Objetivo">
              <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Ex: retomar cotacoes paradas" />
            </LabelledField>
          </div>

          <div className="flex flex-wrap gap-2">
            <AudienceButton active={audienceMode === 'crm'} icon={Users} label="Leads do CRM" onClick={() => setAudienceMode('crm')} />
            <AudienceButton active={audienceMode === 'csv'} icon={FileSpreadsheet} label="Importar CSV" onClick={() => setAudienceMode('csv')} />
          </div>

          {audienceMode === 'crm' ? (
            <div className="grid gap-4 rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4 md:grid-cols-2">
              <LabelledField label="Status do lead">
                <FilterMultiSelect icon={Filter} options={leadStatusOptions} placeholder="Todos os status" values={leadStatusFilters} onChange={setLeadStatusFilters} />
              </LabelledField>
              <LabelledField label="Responsavel">
                <FilterMultiSelect icon={UserCircle} options={leadOwnerOptions} placeholder="Todos os responsaveis" values={leadOwnerFilters} onChange={setLeadOwnerFilters} />
              </LabelledField>
              <p className="md:col-span-2 text-xs text-[color:var(--panel-text-muted)]">O worker vai materializar os alvos no momento de ativar a campanha, removendo arquivados, duplicados, numeros invalidos e opt-outs.</p>
            </div>
          ) : (
            <div className="space-y-4 rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">CSV com nome e telefone</p>
                  <p className="text-xs text-[color:var(--panel-text-muted)]">Aceita cabecalhos como nome, telefone, phone, celular ou whatsapp.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-sm font-medium text-[color:var(--panel-text)] transition hover:border-[color:var(--panel-accent)]">
                  <FileSpreadsheet className="h-4 w-4" />
                  Escolher arquivo
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleCsvFile(event)} />
                </label>
              </div>
              <Textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={'nome;telefone\nMaria Silva;(11) 99999-9999'} />
              <label className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600" checked={createLeadsFromCsv} onChange={(event) => setCreateLeadsFromCsv(event.target.checked)} />
                Criar ou atualizar leads no CRM quando o CSV nao encontrar um lead existente.
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{csvTargets.length} linha(s)</Badge>
                <Badge tone={csvValidTargets.length > 0 ? 'success' : 'warning'}>{csvValidTargets.length} telefone(s) validos</Badge>
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">Pacote de mensagens</span>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Configure a sequencia em blocos compactos. A lista abaixo rola separadamente quando houver muitas mensagens.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge tone="neutral">{steps.length} mensagem(ns)</Badge>
                  <Badge tone="neutral">1 inicial</Badge>
                  {steps.length > 1 && <Badge tone="neutral">{steps.length - 1} follow-up(s)</Badge>}
                </div>
              </div>
              <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={addStep}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {steps.map((step, index) => (
                <div key={index} className="rounded-[var(--kds-radius-lg)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-3 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--panel-accent-soft)] px-2 text-xs font-semibold text-[color:var(--panel-accent)]">{index + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--panel-text)]">{index === 0 ? 'Mensagem inicial' : 'Follow-up'}</p>
                        <p className="text-xs text-[color:var(--panel-text-muted)]">{index === 0 ? 'Enviada ao ativar ou no horario agendado.' : 'Enviado depois do intervalo abaixo, se nao houver resposta.'}</p>
                      </div>
                    </div>
                    {steps.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>Remover</Button>
                    )}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <Textarea
                      size="compact"
                      value={step.messageText}
                      onChange={(event) => {
                        updateStep(index, { messageText: event.target.value });
                        if (index === 0) setMessageText(event.target.value);
                      }}
                      placeholder={index === 0 ? 'Oi {{nome}}, tudo bem? Vi que sua cotacao ficou pendente.' : 'Passando novamente por aqui para saber se posso te ajudar.'}
                    />
                    <div className={cx('grid gap-3 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-3 sm:grid-cols-2 lg:grid-cols-1', index === 0 && 'items-center')}>
                      {index === 0 ? (
                        <p className="text-xs text-[color:var(--panel-text-muted)]">Sem atraso nesta etapa.</p>
                      ) : (
                        <>
                          <LabelledField label="Aguardar">
                            <Input type="number" min={0} value={step.delayAmount} onChange={(event) => updateStep(index, { delayAmount: Number(event.target.value) || 0 })} />
                          </LabelledField>
                          <LabelledField label="Unidade">
                            <select
                              value={step.delayUnit}
                              onChange={(event) => updateStep(index, { delayUnit: event.target.value as CommWhatsAppCampaignStepDraft['delayUnit'] })}
                              className="h-10 w-full rounded-[var(--kds-radius-sm)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 text-sm text-[color:var(--panel-text)]"
                            >
                              <option value="seconds">segundos</option>
                              <option value="minutes">minutos</option>
                              <option value="hours">horas</option>
                              <option value="days">dias</option>
                            </select>
                          </LabelledField>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <LabelledField label="Agendar para">
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </LabelledField>
            <LabelledField label="Ritmo por minuto">
              <Input type="number" min={1} max={120} value={pacingPerMinute} onChange={(event) => setPacingPerMinute(Number(event.target.value) || 1)} />
            </LabelledField>
            <LabelledField label="Janela inicio">
              <Input type="time" value={sendWindowStart} onChange={(event) => setSendWindowStart(event.target.value)} />
            </LabelledField>
            <LabelledField label="Janela fim">
              <Input type="time" value={sendWindowEnd} onChange={(event) => setSendWindowEnd(event.target.value)} />
            </LabelledField>
          </div>
            </div>

          <div className="flex shrink-0 flex-col gap-3 border-t border-[color:var(--panel-border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[color:var(--panel-text-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--panel-accent)]" />
              Respostas inbound param novos envios para aquele contato; opt-outs bloqueados serao excluidos da fila.
            </div>
            <Button className="whitespace-nowrap" onClick={() => void handleCreateDraft()} loading={saving}>
              <Send className="h-4 w-4" />
              Salvar
            </Button>
          </div>
          </Card>
        </div>
      )}

      <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Campanhas recentes</h2>
              <p className="text-sm text-[color:var(--panel-text-soft)]">Base criada para ativacao por worker.</p>
            </div>
            <MessageCircle className="h-5 w-5 text-[color:var(--panel-accent)]" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-surface-soft)]" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[var(--kds-radius-xl)] border border-dashed border-[color:var(--panel-border)] p-6 text-center">
              <p className="text-sm font-medium text-[color:var(--panel-text)]">Nenhum disparo criado ainda.</p>
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Crie o primeiro rascunho para validar publico e mensagem.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{campaign.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[color:var(--panel-text-soft)]">{campaign.message_text || 'Sem mensagem definida.'}</p>
                    </div>
                    <Badge tone={statusTones[campaign.status]} size="sm">{statusLabels[campaign.status]}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniStat label="Alvos" value={campaign.total_targets} />
                    <MiniStat label="Enviados" value={campaign.sent_targets} />
                    <MiniStat label="Resp." value={campaign.responded_targets} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" loading={loadingCampaignEdit && campaignActionId === campaign.id} onClick={() => {
                      setCampaignActionId(campaign.id);
                      void openEditCampaignModal(campaign).finally(() => setCampaignActionId(null));
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    {['draft', 'scheduled', 'paused'].includes(campaign.status) && (
                      <Button size="sm" variant="secondary" loading={campaignActionId === campaign.id} onClick={() => void handleActivateCampaign(campaign)}>
                        <PlayCircle className="h-3.5 w-3.5" />
                        Ativar
                      </Button>
                    )}
                    {['queued', 'running', 'scheduled'].includes(campaign.status) && (
                      <Button size="sm" variant="primary" loading={campaignActionId === campaign.id} onClick={() => void handleProcessCampaign(campaign)}>
                        <Send className="h-3.5 w-3.5" />
                        Processar lote
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-accent-soft)] text-[color:var(--panel-accent-strong)]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-lg font-semibold text-[color:var(--panel-text)]">{value}</span>
        <span className="block text-xs text-[color:var(--panel-text-muted)]">{label}</span>
      </span>
    </Card>
  );
}

function LabelledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function AudienceButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded-[var(--kds-radius-md)] border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-[color:var(--panel-accent)] bg-[color:var(--panel-accent-soft)] text-[color:var(--panel-accent-ink)]'
          : 'border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] text-[color:var(--panel-text-soft)] hover:border-[color:var(--panel-accent)]',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] px-2 py-2">
      <span className="block font-semibold text-[color:var(--panel-text)]">{value}</span>
      <span className="block text-[color:var(--panel-text-muted)]">{label}</span>
    </span>
  );
}

function formatIntentLabel(intent: CommWhatsAppAiIntentSuggestion['intent']) {
  const labels: Record<CommWhatsAppAiIntentSuggestion['intent'], string> = {
    opt_out: 'Pedir parar',
    negative_interest: 'Sem interesse',
    angry_or_complaint: 'Reclamacao',
    wrong_number: 'Numero errado',
    continue_conversation: 'Continuar',
    unclear: 'Ambiguo',
  };

  return labels[intent] ?? 'Revisar';
}
