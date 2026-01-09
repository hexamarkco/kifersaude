import { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  File,
  Film,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  Mic,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  composeTemplateMessage,
  DEFAULT_MESSAGE_TEMPLATES,
  getTemplateMessages,
  normalizeAutoContactSettings,
  type AutoContactSettings,
  type AutoContactTemplate,
  type TemplateMessage,
  type TemplateMessageType,
} from '../../lib/autoContactService';
import type { IntegrationSetting } from '../../lib/supabase';

type MessageState = { type: 'success' | 'error'; text: string } | null;
type TemplateDraft = {
  id: string;
  name: string;
  messages: TemplateMessage[];
};

export default function AutoContactFlowSettings() {
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [messageTemplatesDraft, setMessageTemplatesDraft] = useState<AutoContactTemplate[]>(DEFAULT_MESSAGE_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingFlow, setLoadingFlow] = useState(true);
  const [savingFlow, setSavingFlow] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<'create' | 'edit'>('create');
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);

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

  const createMessageDraft = (type: TemplateMessageType = 'text'): TemplateMessage => ({
    id: `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text: '',
    mediaUrl: '',
    caption: '',
  });

  const openTemplateModal = (mode: 'create' | 'edit', template?: AutoContactTemplate | null) => {
    const draftMessages = template ? getTemplateMessages(template) : [];
    const normalizedMessages = draftMessages.length > 0 ? draftMessages : [createMessageDraft()];
    setTemplateDraft({
      id: template?.id ?? `template-${Date.now()}`,
      name: template?.name ?? '',
      messages: normalizedMessages,
    });
    setTemplateModalMode(mode);
    setIsTemplateModalOpen(true);
  };

  const handleAddTemplate = () => {
    openTemplateModal('create');
  };

  const handleEditTemplate = (templateId: string) => {
    const template = messageTemplatesDraft.find((item) => item.id === templateId);
    if (!template) return;
    openTemplateModal('edit', template);
  };

  const handleUpdateTemplateDraft = (updates: Partial<TemplateDraft>) => {
    setTemplateDraft((previous) => (previous ? { ...previous, ...updates } : previous));
  };

  const handleUpdateDraftMessage = (messageId: string, updates: Partial<TemplateMessage>) => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        messages: previous.messages.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updates,
              }
            : message,
        ),
      };
    });
  };

  const handleAddDraftMessage = (type: TemplateMessageType = 'text') => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        messages: [...previous.messages, createMessageDraft(type)],
      };
    });
  };

  const handleRemoveDraftMessage = (messageId: string) => {
    setTemplateDraft((previous) => {
      if (!previous) return previous;
      const nextMessages = previous.messages.filter((message) => message.id !== messageId);
      return {
        ...previous,
        messages: nextMessages.length ? nextMessages : [createMessageDraft()],
      };
    });
  };

  const handleSaveTemplateDraft = () => {
    if (!templateDraft) return;
    const normalizedMessages = templateDraft.messages.map((message, index) => ({
      id: message.id?.trim() ? message.id : `message-${templateDraft.id}-${index}`,
      type: message.type,
      text: message.text ?? '',
      mediaUrl: message.mediaUrl ?? '',
      caption: message.caption ?? '',
    }));
    const composedMessage = composeTemplateMessage(normalizedMessages);
    const newTemplate: AutoContactTemplate = {
      id: templateDraft.id,
      name: templateDraft.name,
      messages: normalizedMessages,
      message: composedMessage,
    };

    setMessageTemplatesDraft((previous) => {
      if (templateModalMode === 'edit') {
        return previous.map((template) => (template.id === newTemplate.id ? newTemplate : template));
      }
      return [...previous, newTemplate];
    });

    setSelectedTemplateId((current) => current || newTemplate.id);
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setTemplateDraft(null);
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
      .map((template, index) => {
        const normalizedMessages = getTemplateMessages(template).map((message, messageIndex) => ({
          id: message.id?.trim() ? message.id : `message-${template.id}-${messageIndex}`,
          type: message.type,
          text: message.text ?? '',
          mediaUrl: message.mediaUrl ?? '',
          caption: message.caption ?? '',
        }));
        const composedMessage = composeTemplateMessage(normalizedMessages);
        const hasContent = normalizedMessages.some(
          (message) =>
            message.text?.trim() ||
            message.caption?.trim() ||
            message.mediaUrl?.trim(),
        );

        return {
          id: template.id || `template-${index}`,
          name: template.name?.trim() || `Modelo ${index + 1}`,
          messages: normalizedMessages,
          message: composedMessage,
          hasContent,
        };
      })
      .filter((template) => template.message.trim() || template.hasContent)
      .map(({ hasContent: _hasContent, ...template }) => template);
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
  const selectedTemplateMessages = useMemo(
    () => getTemplateMessages(selectedTemplate),
    [selectedTemplate],
  );
  const messageTypeLabels: Record<TemplateMessageType, string> = {
    text: 'Texto',
    image: 'Imagem',
    video: 'Vídeo',
    audio: 'Áudio',
    document: 'Documento',
  };

  const messageTypeIcons: Record<TemplateMessageType, typeof MessageCircle> = {
    text: MessageCircle,
    image: ImageIcon,
    video: Film,
    audio: Mic,
    document: File,
  };

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
                    {selectedTemplateMessages.length > 0 ? (
                      <div className="space-y-3">
                        {selectedTemplateMessages.map((message, index) => {
                          const Icon = messageTypeIcons[message.type];
                          const content =
                            message.type === 'text'
                              ? message.text?.trim()
                              : message.caption?.trim() || message.mediaUrl?.trim() || 'Conteúdo pendente';
                          return (
                            <div key={message.id} className="flex gap-2">
                              <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
                              <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase">
                                  {messageTypeLabels[message.type]} {index + 1}
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-slate-700">{content || 'Sem conteúdo'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
              <div className="grid gap-4 md:grid-cols-2">
                {messageTemplatesDraft.map((template, index) => {
                  const previewMessages = getTemplateMessages(template).slice(0, 2);
                  return (
                    <div
                      key={template.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-slate-800">
                              {template.name?.trim() || `Modelo ${index + 1}`}
                            </h4>
                            {selectedTemplateId === template.id && (
                              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                                Em uso
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {getTemplateMessages(template).length} mensagens configuradas
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(template.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTemplate(template.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover modelo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {previewMessages.length > 0 ? (
                          previewMessages.map((message, messageIndex) => {
                            const Icon = messageTypeIcons[message.type];
                            const content =
                              message.type === 'text'
                                ? message.text?.trim()
                                : message.caption?.trim() || message.mediaUrl?.trim() || 'Conteúdo pendente';
                            return (
                              <div
                                key={message.id}
                                className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
                                <div>
                                  <div className="text-[11px] uppercase font-semibold text-slate-500">
                                    {messageTypeLabels[message.type]} {messageIndex + 1}
                                  </div>
                                  <p className="text-xs text-slate-600 whitespace-pre-wrap">
                                    {content || 'Sem conteúdo'}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500">
                            Nenhuma mensagem configurada ainda. Abra para editar.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
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
        {isTemplateModalOpen && templateDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60" onClick={handleCloseTemplateModal} />
            <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">
                    {templateModalMode === 'create' ? 'Novo template' : 'Editar template'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nome do template</label>
                  <input
                    type="text"
                    value={templateDraft.name}
                    onChange={(event) => handleUpdateTemplateDraft({ name: event.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    placeholder="Ex.: Boas-vindas VIP"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Mensagens do template</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Combine textos, mídias, áudios e documentos em uma sequência completa.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('text')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Texto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('image')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Imagem
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('video')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Film className="w-3.5 h-3.5" />
                        Vídeo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('audio')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Áudio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDraftMessage('document')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <File className="w-3.5 h-3.5" />
                        Documento
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {templateDraft.messages.map((message, index) => {
                      const Icon = messageTypeIcons[message.type];
                      const mediaLabel =
                        message.type === 'image'
                          ? 'URL da imagem'
                          : message.type === 'video'
                          ? 'URL do vídeo'
                          : message.type === 'audio'
                          ? 'URL do áudio'
                          : message.type === 'document'
                          ? 'URL do documento'
                          : 'URL da mídia';
                      return (
                        <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-semibold text-slate-500 uppercase">
                                Mensagem {index + 1}
                              </span>
                              <select
                                value={message.type}
                                onChange={(event) =>
                                  handleUpdateDraftMessage(message.id, {
                                    type: event.target.value as TemplateMessageType,
                                  })
                                }
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              >
                                {Object.entries(messageTypeLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftMessage(message.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remover
                            </button>
                          </div>

                          {message.type === 'text' ? (
                            <textarea
                              value={message.text ?? ''}
                              onChange={(event) => handleUpdateDraftMessage(message.id, { text: event.target.value })}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                              rows={3}
                              placeholder="Digite a mensagem..."
                            />
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                  {mediaLabel}
                                </label>
                                <input
                                  type="text"
                                  value={message.mediaUrl ?? ''}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, { mediaUrl: event.target.value })
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                  placeholder="https://..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">
                                  Legenda ou descrição
                                </label>
                                <input
                                  type="text"
                                  value={message.caption ?? ''}
                                  onChange={(event) =>
                                    handleUpdateDraftMessage(message.id, { caption: event.target.value })
                                  }
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                  placeholder="Ex.: Guia em PDF, áudio de explicação..."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplateDraft}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  Salvar template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
