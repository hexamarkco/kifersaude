import { useEffect, useState } from 'react';
import { Info, Loader2, MessageCircle, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  DEFAULT_MESSAGE_FLOW,
  normalizeAutoContactSettings,
  type AutoContactSettings,
  type AutoContactStep,
} from '../../lib/autoContactService';
import type { IntegrationSetting } from '../../lib/supabase';

type MessageState = { type: 'success' | 'error'; text: string } | null;

type FlowStepUpdate = Partial<Pick<AutoContactStep, 'message' | 'delaySeconds' | 'active'>>;

export default function AutoContactFlowSettings() {
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [messageFlowDraft, setMessageFlowDraft] = useState<AutoContactStep[]>(DEFAULT_MESSAGE_FLOW);
  const [loadingFlow, setLoadingFlow] = useState(true);
  const [savingFlow, setSavingFlow] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);

  useEffect(() => {
    void loadAutoContactSettings();
  }, []);

  const loadAutoContactSettings = async () => {
    setLoadingFlow(true);
    setStatusMessage(null);

    const integration = await configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG);
    const normalized = normalizeAutoContactSettings(integration?.settings);

    setAutoContactIntegration(integration);
    setAutoContactSettings(normalized);
    setMessageFlowDraft(normalized.messageFlow.length ? normalized.messageFlow : DEFAULT_MESSAGE_FLOW);

    setLoadingFlow(false);
  };

  const handleAddFlowStep = () => {
    setMessageFlowDraft((previous) => [
      ...previous,
      { id: `step-${Date.now()}`, message: '', delaySeconds: 0, active: true },
    ]);
  };

  const handleUpdateFlowStep = (stepId: string, updates: FlowStepUpdate) => {
    setMessageFlowDraft((previous) =>
      previous.map((step) =>
        step.id === stepId
          ? {
              ...step,
              ...updates,
              delaySeconds:
                updates.delaySeconds !== undefined && Number.isFinite(updates.delaySeconds)
                  ? Math.max(0, Number(updates.delaySeconds))
                  : step.delaySeconds,
            }
          : step,
      ),
    );
  };

  const handleRemoveFlowStep = (stepId: string) => {
    setMessageFlowDraft((previous) => previous.filter((step) => step.id !== stepId));
  };

  const handleResetDraft = () => {
    const savedFlow = autoContactSettings?.messageFlow.length
      ? autoContactSettings.messageFlow
      : DEFAULT_MESSAGE_FLOW;

    setMessageFlowDraft(savedFlow);
    setStatusMessage(null);
  };

  const handleSaveFlow = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({ type: 'error', text: 'Integração de automação não configurada.' });
      return;
    }

    setSavingFlow(true);
    setStatusMessage(null);

    const sanitizedFlow = messageFlowDraft.map((step, index) => ({
      id: step.id || `step-${index}`,
      message: step.message || '',
      delaySeconds: Number.isFinite(step.delaySeconds) ? Math.max(0, Math.round(step.delaySeconds)) : 0,
      active: step.active !== false,
    }));

    const currentSettings = autoContactIntegration.settings ?? {};
    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: { ...currentSettings, messageFlow: sanitizedFlow },
    });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar o fluxo de mensagens. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setMessageFlowDraft(normalized.messageFlow.length ? normalized.messageFlow : DEFAULT_MESSAGE_FLOW);
      setStatusMessage({ type: 'success', text: 'Fluxo salvo com sucesso.' });
    }

    setSavingFlow(false);
  };

  if (loadingFlow) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-3 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando fluxo de automação...</span>
      </div>
    );
  }

  if (!autoContactIntegration) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 mt-1" />
        <div className="space-y-1 text-sm text-orange-800">
          <p className="font-semibold">Integração de automação não encontrada.</p>
          <p>Execute as migrações mais recentes e configure o serviço antes de definir o fluxo de mensagens.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-teal-100 text-teal-700">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Fluxo de automação do WhatsApp</h3>
            <p className="text-sm text-slate-600">
              Edite a sequência de mensagens enviada pelo botão de automação. Utilize variáveis como
              <span className="font-semibold"> {'{{primeiro_nome}}'} </span>
              para personalizar o texto.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleResetDraft}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
            Desfazer alterações
          </button>
          <button
            type="button"
            onClick={handleAddFlowStep}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Adicionar mensagem
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {messageFlowDraft.map((step, index) => (
          <div key={step.id} className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-800">Mensagem {index + 1}</span>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={step.active}
                    onChange={(event) => handleUpdateFlowStep(step.id, { active: event.target.checked })}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Ativa
                </label>
              </div>
              {messageFlowDraft.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveFlowStep(step.id)}
                  className="inline-flex items-center gap-2 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              )}
            </div>

            <textarea
              value={step.message}
              onChange={(event) => handleUpdateFlowStep(step.id, { message: event.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              placeholder="Digite a mensagem que será enviada"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-slate-700 flex flex-col gap-1">
                Aguardar antes do envio (minutos)
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={Number(step.delaySeconds ?? 0) / 60}
                  onChange={(event) => handleUpdateFlowStep(step.id, { delaySeconds: Number(event.target.value) * 60 })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </label>
              <div className="text-xs text-slate-600 bg-white rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-700 mb-1">Variáveis disponíveis</p>
                <div className="space-y-1">
                  <p><span className="font-semibold">{'{{nome}}'}</span>: nome completo</p>
                  <p><span className="font-semibold">{'{{primeiro_nome}}'}</span>: primeiro nome</p>
                  <p>
                    <span className="font-semibold">{'{{Saudacao}}'}</span>: saudação com inicial maiúscula (Bom dia/Boa tarde/Boa
                    noite)
                  </p>
                  <p>
                    <span className="font-semibold">{'{{saudacao}}'}</span>: saudação em minúsculas (bom dia/boa tarde/boa noite)
                  </p>
                  <p><span className="font-semibold">{'{{origem}}'}</span>: origem do lead</p>
                  <p><span className="font-semibold">{'{{cidade}}'}</span>: cidade</p>
                  <p><span className="font-semibold">{'{{responsavel}}'}</span>: responsável</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>O fluxo de mensagens é salvo para toda a equipe.</span>
        </div>
        <div className="flex gap-3 sm:justify-end">
          <button
            type="button"
            onClick={handleSaveFlow}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            disabled={savingFlow}
          >
            {savingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingFlow ? 'Salvando...' : 'Salvar fluxo'}
          </button>
        </div>
      </div>
    </div>
  );
}
