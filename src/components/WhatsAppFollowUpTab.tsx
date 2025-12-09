import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  AlertCircle,
  Clock4,
  Info,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { configService } from '../lib/configService';
import type { IntegrationSetting } from '../lib/supabase';
import {
  WHATSAPP_FOLLOWUP_INTEGRATION_SLUG,
  getDefaultFollowUpSettings,
  normalizeWhatsAppFollowUpSettings,
  sanitizeFollowUpSettings,
} from '../lib/whatsappFollowUpService';
import type {
  WhatsAppFollowUpFlow,
  WhatsAppFollowUpSettings,
  WhatsAppFollowUpStep,
} from '../types/whatsappFollowUp';

const buildId = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const delayToHours = (delayMinutes: number) => Number((delayMinutes / 60).toFixed(2));
const hoursToDelay = (hours: number) => Math.max(0, Math.round(hours * 60));

export default function WhatsAppFollowUpTab() {
  const { leadStatuses } = useConfig();
  const [integration, setIntegration] = useState<IntegrationSetting | null>(null);
  const [settings, setSettings] = useState<WhatsAppFollowUpSettings>(getDefaultFollowUpSettings());
  const [draft, setDraft] = useState<WhatsAppFollowUpSettings>(getDefaultFollowUpSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const statusOptions = useMemo(() => leadStatuses.map((status) => status.nome).filter(Boolean), [leadStatuses]);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setMessage(null);

    try {
      let integrationSetting = await configService.getIntegrationSetting(WHATSAPP_FOLLOWUP_INTEGRATION_SLUG);
      let normalizedSettings = normalizeWhatsAppFollowUpSettings(integrationSetting?.settings);

      if (!integrationSetting) {
        const createResult = await configService.createIntegrationSetting({
          slug: WHATSAPP_FOLLOWUP_INTEGRATION_SLUG,
          name: 'Automação de follow-up do WhatsApp',
          description: 'Fluxos de reabordagem automática por status do lead.',
          settings: normalizedSettings,
        });

        if (createResult.error) {
          throw new Error(createResult.error.message || 'Falha ao criar integração.');
        }

        integrationSetting = createResult.data;
        normalizedSettings = normalizeWhatsAppFollowUpSettings(createResult.data?.settings);
      }

      setIntegration(integrationSetting);
      setSettings(normalizedSettings);
      setDraft(normalizedSettings);
    } catch (error) {
      console.error('Erro ao carregar follow-ups do WhatsApp', error);
      setMessage({ type: 'error', text: 'Não foi possível carregar ou criar a integração de follow-up.' });
    } finally {
      setLoading(false);
    }
  };

  const updateFlow = (flowId: string, updates: Partial<WhatsAppFollowUpFlow>) => {
    setDraft((previous) => ({
      ...previous,
      flows: previous.flows.map((flow) => (flow.id === flowId ? { ...flow, ...updates } : flow)),
    }));
  };

  const updateStep = (flowId: string, stepId: string, updates: Partial<WhatsAppFollowUpStep>) => {
    setDraft((previous) => ({
      ...previous,
      flows: previous.flows.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              steps: flow.steps.map((step) =>
                step.id === stepId
                  ? { ...step, ...updates, delayMinutes: updates.delayMinutes ?? step.delayMinutes }
                  : step,
              ),
            }
          : flow,
      ),
    }));
  };

  const addFlow = () => {
    const defaultStop = draft.defaultStopStatuses.length ? draft.defaultStopStatuses : settings.defaultStopStatuses;
    const newFlow: WhatsAppFollowUpFlow = {
      id: buildId(),
      name: 'Novo fluxo de follow-up',
      monitoredStatuses: [],
      stopStatuses: defaultStop,
      stopOnAnyStatusChange: true,
      maxMessages: 5,
      active: true,
      steps: [
        {
          id: buildId(),
          message: 'Qualquer novidade? Estou por aqui para ajudar com sua cotação. 🙂',
          delayMinutes: 180,
          active: true,
        },
      ],
    };

    setDraft((previous) => ({ ...previous, flows: [...previous.flows, newFlow] }));
  };

  const removeFlow = (flowId: string) => {
    setDraft((previous) => ({ ...previous, flows: previous.flows.filter((flow) => flow.id !== flowId) }));
  };

  const addStep = (flowId: string) => {
    setDraft((previous) => ({
      ...previous,
      flows: previous.flows.map((flow) =>
        flow.id === flowId
          ? {
              ...flow,
              steps: [
                ...flow.steps,
                {
                  id: buildId(),
                  message: 'Mensagem adicional de follow-up.',
                  delayMinutes: Math.max(60, (flow.steps.at(-1)?.delayMinutes ?? 0) + 180),
                  active: true,
                },
              ],
            }
          : flow,
      ),
    }));
  };

  const removeStep = (flowId: string, stepId: string) => {
    setDraft((previous) => ({
      ...previous,
      flows: previous.flows.map((flow) =>
        flow.id === flowId ? { ...flow, steps: flow.steps.filter((step) => step.id !== stepId) } : flow,
      ),
    }));
  };

  const toggleStatusInList = (flowId: string, status: string, list: 'monitoredStatuses' | 'stopStatuses') => {
    setDraft((previous) => ({
      ...previous,
      flows: previous.flows.map((flow) => {
        if (flow.id !== flowId) return flow;
        const currentList = new Set(flow[list]);
        if (currentList.has(status)) {
          currentList.delete(status);
        } else {
          currentList.add(status);
        }
        return { ...flow, [list]: Array.from(currentList) };
      }),
    }));
  };

  const toggleDefaultStopStatus = (status: string) => {
    setDraft((previous) => {
      const current = new Set(previous.defaultStopStatuses);
      if (current.has(status)) {
        current.delete(status);
      } else {
        current.add(status);
      }
      return { ...previous, defaultStopStatuses: Array.from(current) };
    });
  };

  const handleSave = async () => {
    if (!integration?.id) {
      setMessage({ type: 'error', text: 'Integração de follow-up não encontrada.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const sanitized = sanitizeFollowUpSettings(draft);

    const { data, error } = await configService.updateIntegrationSetting(integration.id, {
      settings: sanitized,
    });

    if (error) {
      setMessage({ type: 'error', text: 'Não foi possível salvar os fluxos. Tente novamente.' });
    } else {
      const normalized = normalizeWhatsAppFollowUpSettings(data?.settings ?? sanitized);
      setIntegration(data ?? integration);
      setSettings(normalized);
      setDraft(normalized);
      setMessage({ type: 'success', text: 'Automação de follow-up atualizada com sucesso.' });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando automação de follow-up...</span>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 flex items-start gap-3 text-orange-800">
        <AlertCircle className="h-5 w-5 mt-1" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">Não conseguimos iniciar a configuração.</p>
          <p>Verifique se as migrações de integração foram executadas e tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
              <Settings2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fluxos automáticos</p>
              <h2 className="text-xl font-bold text-slate-900">Follow-up no WhatsApp por status</h2>
              <p className="text-sm text-slate-600">
                Defina sequências diferentes para cada status. Os envios param quando o lead muda de status ou atinge o limite de
                mensagens configurado.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Automação ativa
            </label>
            <button
              type="button"
              onClick={addFlow}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Novo fluxo
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Status que sempre interrompem o envio</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const checked = draft.defaultStopStatuses.includes(status);
              return (
                <label
                  key={status}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDefaultStopStatus(status)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {status}
                </label>
              );
            })}
            {statusOptions.length === 0 && (
              <span className="text-xs text-slate-500">Cadastre status em Configurações &gt; Sistema para usá-los aqui.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sempre que um lead entrar em um desses status, qualquer fluxo ativo é interrompido automaticamente.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? <ShieldCheck className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {draft.flows.map((flow) => (
          <div key={flow.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-100 p-2 text-orange-700">
                  <Clock4 className="h-5 w-5" />
                </div>
                <div>
                  <input
                    type="text"
                    value={flow.name}
                    onChange={(event) => updateFlow(flow.id, { name: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                    placeholder="Nome do fluxo"
                  />
                  <p className="text-xs text-slate-500">Monitore e reaborde automaticamente leads nesses status.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={flow.active}
                    onChange={(event) => updateFlow(flow.id, { active: event.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Fluxo ativo
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={flow.stopOnAnyStatusChange}
                    onChange={(event) => updateFlow(flow.id, { stopOnAnyStatusChange: event.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Pausar se o status mudar
                </label>
                <button
                  type="button"
                  onClick={() => addStep(flow.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Plus className="h-4 w-4" />
                  Passo
                </button>
                {draft.flows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFlow(flow.id)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover fluxo
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">Monitorar status</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusOptions.map((status) => {
                    const checked = flow.monitoredStatuses.includes(status);
                    return (
                      <label
                        key={status}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                          checked
                            ? 'border-orange-200 bg-orange-50 text-orange-700'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStatusInList(flow.id, status, 'monitoredStatuses')}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                        {status}
                      </label>
                    );
                  })}
                  {statusOptions.length === 0 && (
                    <span className="text-xs text-slate-500">Cadastre status para habilitar os fluxos.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Parar quando chegar em</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusOptions.map((status) => {
                    const checked = flow.stopStatuses.includes(status);
                    return (
                      <label
                        key={status}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                          checked
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStatusInList(flow.id, status, 'stopStatuses')}
                          className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                        />
                        {status}
                      </label>
                    );
                  })}
                  {flow.stopStatuses
                    .filter((status) => !statusOptions.includes(status))
                    .map((status) => (
                      <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {status}
                      </span>
                    ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-700 flex flex-col gap-1">
                  Quantidade máxima de mensagens
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={flow.maxMessages}
                    onChange={(event) => updateFlow(flow.id, { maxMessages: Number(event.target.value) })}
                    className="w-40 rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {flow.steps.map((step, index) => (
                <div key={step.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                        {index + 1}
                      </span>
                      Mensagem de follow-up
                      <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={step.active}
                          onChange={(event) => updateStep(flow.id, step.id, { active: event.target.checked })}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        Ativa
                      </label>
                    </div>
                    {flow.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(flow.id, step.id)}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" /> Remover mensagem
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className="md:col-span-2 text-sm text-slate-700 flex flex-col gap-1">
                      Conteúdo
                      <textarea
                        value={step.message}
                        onChange={(event) => updateStep(flow.id, step.id, { message: event.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-orange-500"
                        rows={3}
                        placeholder="Mensagem enviada automaticamente"
                      />
                    </label>
                    <label className="text-sm text-slate-700 flex flex-col gap-1">
                      Aguardar (horas) após entrar no status
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={delayToHours(step.delayMinutes)}
                        onChange={(event) =>
                          updateStep(flow.id, step.id, { delayMinutes: hoursToDelay(Number(event.target.value)) })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-orange-500"
                      />
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    <span>
                      Use variáveis como <strong>{'{{primeiro_nome}}'}</strong> ou <strong>{'{{origem}}'}</strong> para personalizar
                      o texto.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          {draft.enabled ? <PlayCircle className="h-5 w-5 text-emerald-600" /> : <PauseCircle className="h-5 w-5 text-slate-500" />}
          <span>
            O envio é interrompido automaticamente quando o lead sai dos status monitorados ou quando atingir o limite definido.
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDraft(settings)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowCounterClockwiseIcon className="h-4 w-4" />
            Desfazer alterações
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar automação'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ArrowCounterClockwiseIcon(props: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 1 9 9" />
      <path d="M3 16v-4h4" />
    </svg>
  );
}
