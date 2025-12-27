import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Info, Loader2, MessageCircle, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  DEFAULT_MESSAGE_FLOW,
  normalizeAutoContactSettings,
  type AutoContactSettings,
  type AutoContactStep,
  type AutoContactTemplate,
} from '../../lib/autoContactService';
import type { IntegrationSetting } from '../../lib/supabase';

type MessageState = { type: 'success' | 'error'; text: string } | null;

type FlowStepUpdate = Partial<Pick<AutoContactStep, 'message' | 'delaySeconds' | 'active'>>;
type TemplateUpdate = Partial<Pick<AutoContactTemplate, 'name' | 'message'>>;

export default function AutoContactFlowSettings() {
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [messageFlowDraft, setMessageFlowDraft] = useState<AutoContactStep[]>(DEFAULT_MESSAGE_FLOW);
  const [messageTemplatesDraft, setMessageTemplatesDraft] = useState<AutoContactTemplate[]>([]);
  const [loadingFlow, setLoadingFlow] = useState(true);
  const [savingFlow, setSavingFlow] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

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
    const flow = normalized.messageFlow.length ? normalized.messageFlow : DEFAULT_MESSAGE_FLOW;
    setMessageFlowDraft(flow);
    setMessageTemplatesDraft(normalized.messageTemplates ?? []);

    setExpandedSteps(new Set(flow.map(step => step.id)));

    setLoadingFlow(false);
  };

  const handleAddFlowStep = () => {
    const newStepId = `step-${Date.now()}`;
    setMessageFlowDraft((previous) => [
      ...previous,
      { id: newStepId, message: '', delaySeconds: 0, active: true },
    ]);
    setExpandedSteps((previous) => new Set([...previous, newStepId]));
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

  const handleAddTemplate = () => {
    const newTemplateId = `template-${Date.now()}`;
    setMessageTemplatesDraft((previous) => [
      ...previous,
      { id: newTemplateId, name: '', message: '' },
    ]);
  };

  const handleUpdateTemplate = (templateId: string, updates: TemplateUpdate) => {
    setMessageTemplatesDraft((previous) =>
      previous.map((template) =>
        template.id === templateId
          ? {
              ...template,
              ...updates,
            }
          : template,
      ),
    );
  };

  const handleRemoveTemplate = (templateId: string) => {
    setMessageTemplatesDraft((previous) => previous.filter((template) => template.id !== templateId));
  };

  const toggleStepExpanded = (stepId: string) => {
    setExpandedSteps((previous) => {
      const next = new Set(previous);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleResetDraft = () => {
    const savedFlow = autoContactSettings?.messageFlow.length
      ? autoContactSettings.messageFlow
      : DEFAULT_MESSAGE_FLOW;

    setMessageFlowDraft(savedFlow);
    setMessageTemplatesDraft(autoContactSettings?.messageTemplates ?? []);
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
    const sanitizedTemplates = messageTemplatesDraft
      .map((template, index) => ({
        id: template.id || `template-${index}`,
        name: template.name?.trim() || `Modelo ${index + 1}`,
        message: template.message || '',
      }))
      .filter((template) => template.message.trim());

    const currentSettings = autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      messageFlow: sanitizedFlow,
      messageTemplates: sanitizedTemplates,
    };

    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: newSettings,
    });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar a configuração. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setMessageFlowDraft(normalized.messageFlow.length ? normalized.messageFlow : DEFAULT_MESSAGE_FLOW);
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setStatusMessage({ type: 'success', text: 'Fluxo de mensagens salvo com sucesso.' });
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-medium mb-4">
            <MessageCircle className="w-5 h-5" />
            Fluxo de Mensagens
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <div className="font-semibold mb-2">Variáveis disponíveis:</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{nome}}'}</code> nome completo</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{primeiro_nome}}'}</code> primeiro nome</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{origem}}'}</code> origem do lead</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{cidade}}'}</code> cidade</span>
              <span><code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{responsavel}}'}</code> responsável</span>
            </div>
          </div>

          <div className="space-y-3">
            {messageFlowDraft.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const previewText = step.message.slice(0, 60) + (step.message.length > 60 ? '...' : '');
            const delaySeconds = Number(step.delaySeconds ?? 0);

              return (
                <div
                  key={step.id}
                  className={`rounded-lg border transition-all ${
                    step.active
                      ? 'border-slate-200 bg-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleStepExpanded(step.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-800">Mensagem {index + 1}</span>
                          {delaySeconds > 0 && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Aguarda {delaySeconds}s
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              step.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {step.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                        {!isExpanded && step.message && (
                          <p className="text-xs text-slate-500 truncate">{previewText}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {messageFlowDraft.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFlowStep(step.id);
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover mensagem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                      <div className="pt-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                          <input
                            type="checkbox"
                            checked={step.active}
                            onChange={(event) => handleUpdateFlowStep(step.id, { active: event.target.checked })}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          Mensagem ativa
                        </label>

                        <textarea
                          value={step.message}
                          onChange={(event) => handleUpdateFlowStep(step.id, { message: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          rows={4}
                          placeholder="Digite a mensagem que será enviada..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Aguardar antes do envio (segundos)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={delaySeconds}
                          onChange={(event) => handleUpdateFlowStep(step.id, { delaySeconds: Number(event.target.value) })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="0"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Tempo de espera antes de enviar esta mensagem após a anterior
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleAddFlowStep}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar mensagem
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleResetDraft}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveFlow}
                className="inline-flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm"
                disabled={savingFlow}
              >
                {savingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {savingFlow ? 'Salvando...' : 'Salvar fluxo de mensagens'}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Modelos de mensagem rápida</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Esses modelos aparecem ao clicar em "Enviar automação" no lead. Escolha um para disparos pontuais (ex: Natal, Ano Novo).
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTemplate}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Novo modelo
              </button>
            </div>

            {messageTemplatesDraft.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                Nenhum modelo cadastrado. Clique em "Novo modelo" para adicionar mensagens rápidas.
              </div>
            ) : (
              <div className="space-y-3">
                {messageTemplatesDraft.map((template, index) => (
                  <div
                    key={template.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">
                          Modelo {index + 1}
                        </span>
                        <input
                          type="text"
                          value={template.name}
                          onChange={(event) => handleUpdateTemplate(template.id, { name: event.target.value })}
                          className="px-2 py-1 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Nome do modelo"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTemplate(template.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={template.message}
                      onChange={(event) => handleUpdateTemplate(template.id, { message: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      rows={3}
                      placeholder="Digite a mensagem rápida..."
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
