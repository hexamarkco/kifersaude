import { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, MessageCircle, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  DEFAULT_MESSAGE_TEMPLATES,
  normalizeAutoContactSettings,
  type AutoContactSettings,
  type AutoContactTemplate,
} from '../../lib/autoContactService';
import type { IntegrationSetting } from '../../lib/supabase';

type MessageState = { type: 'success' | 'error'; text: string } | null;

type TemplateUpdate = Partial<Pick<AutoContactTemplate, 'name' | 'message'>>;

export default function AutoContactFlowSettings() {
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [messageTemplatesDraft, setMessageTemplatesDraft] = useState<AutoContactTemplate[]>(DEFAULT_MESSAGE_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
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
    setMessageTemplatesDraft(normalized.messageTemplates ?? []);
    setSelectedTemplateId(normalized.selectedTemplateId);

    setLoadingFlow(false);
  };

  const handleAddTemplate = () => {
    const newTemplateId = `template-${Date.now()}`;
    setMessageTemplatesDraft((previous) => [
      ...previous,
      { id: newTemplateId, name: '', message: '' },
    ]);
    setSelectedTemplateId((previous) => previous || newTemplateId);
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
    setMessageTemplatesDraft((previous) => {
      const nextTemplates = previous.filter((template) => template.id !== templateId);
      const fallbackId = nextTemplates[0]?.id ?? '';
      setSelectedTemplateId((current) => (current === templateId ? fallbackId : current));
      return nextTemplates;
    });
  };

  const handleResetDraft = () => {
    const savedTemplates = autoContactSettings?.messageTemplates?.length
      ? autoContactSettings.messageTemplates
      : DEFAULT_MESSAGE_TEMPLATES;

    setMessageTemplatesDraft(savedTemplates);
    setSelectedTemplateId(autoContactSettings?.selectedTemplateId ?? savedTemplates[0]?.id ?? '');
    setStatusMessage(null);
  };

  const handleSaveFlow = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({ type: 'error', text: 'Integração de automação não configurada.' });
      return;
    }

    setSavingFlow(true);
    setStatusMessage(null);

    const sanitizedTemplates = messageTemplatesDraft
      .map((template, index) => ({
        id: template.id || `template-${index}`,
        name: template.name?.trim() || `Modelo ${index + 1}`,
        message: template.message || '',
      }))
      .filter((template) => template.message.trim());
    const normalizedSelectedTemplateId =
      sanitizedTemplates.find((template) => template.id === selectedTemplateId)?.id ??
      sanitizedTemplates[0]?.id ??
      '';

    const currentSettings = autoContactSettings || normalizeAutoContactSettings(null);
    const newSettings = {
      ...currentSettings,
      messageTemplates: sanitizedTemplates,
      selectedTemplateId: normalizedSelectedTemplateId,
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
      setMessageTemplatesDraft(normalized.messageTemplates ?? []);
      setSelectedTemplateId(normalized.selectedTemplateId);
      setStatusMessage({ type: 'success', text: 'Modelos de automação salvos com sucesso.' });
    }

    setSavingFlow(false);
  };

  const selectedTemplate = useMemo(
    () => messageTemplatesDraft.find((template) => template.id === selectedTemplateId) ?? null,
    [messageTemplatesDraft, selectedTemplateId],
  );

  if (loadingFlow) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-3 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando templates de automação...</span>
      </div>
    );
  }

  if (!autoContactIntegration) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 mt-1" />
        <div className="space-y-1 text-sm text-orange-800">
          <p className="font-semibold">Integração de automação não encontrada.</p>
          <p>Execute as migrações mais recentes e configure o serviço antes de definir os templates de automação.</p>
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
            Templates da automação
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

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Template selecionado para a automação</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Este é o modelo que será enviado quando a automação for disparada automaticamente.
                </p>
              </div>
            </div>

            {messageTemplatesDraft.length === 0 ? (
              <div className="text-sm text-slate-500">
                Nenhum template cadastrado. Crie um novo modelo abaixo para ativar a automação.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Template de automação</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => setSelectedTemplateId(event.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white"
                  >
                    {messageTemplatesDraft.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name || 'Modelo sem nome'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Prévia
                  </label>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                    {selectedTemplate?.message ? (
                      <p className="whitespace-pre-wrap">{selectedTemplate.message}</p>
                    ) : (
                      <p>Nenhuma mensagem definida neste template.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Biblioteca de templates</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Crie e edite templates pré-fabricados para usar na automação ou em disparos manuais.
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

          <div className="flex items-center justify-end pt-4 border-t border-slate-200">
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
                {savingFlow ? 'Salvando...' : 'Salvar templates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
