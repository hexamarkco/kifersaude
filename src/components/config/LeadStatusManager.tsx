import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  PaintBucket,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { getBadgeStyle } from '../../lib/colorUtils';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';

type Message = { type: 'success' | 'error'; text: string };
type StatusDraft = { nome: string; ordem: string };

export default function LeadStatusManager() {
  const { leadStatuses, refreshLeadStatuses } = useConfig();
  const [newStatus, setNewStatus] = useState({
    nome: '',
    cor: '#3b82f6',
    ordem: leadStatuses.length + 1,
  });
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StatusDraft>>({});
  const [message, setMessage] = useState<Message | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    const nextDrafts: Record<string, StatusDraft> = {};
    leadStatuses.forEach((status) => {
      nextDrafts[status.id] = {
        nome: status.nome,
        ordem: String(status.ordem),
      };
    });
    setDrafts(nextDrafts);
  }, [leadStatuses]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [message]);

  const showMessage = (type: Message['type'], text: string) => {
    setMessage({ type, text });
  };

  const updateDraft = (id: string, updates: Partial<StatusDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        nome: current[id]?.nome ?? '',
        ordem: current[id]?.ordem ?? '',
        ...updates,
      },
    }));
  };

  const handleCreate = async () => {
    if (!newStatus.nome.trim()) {
      showMessage('error', 'Informe o nome do status.');
      return;
    }

    setSaving(true);
    const { error } = await configService.createLeadStatus({
      nome: newStatus.nome.trim(),
      cor: newStatus.cor,
      ordem: newStatus.ordem,
      ativo: true,
      padrao: leadStatuses.length === 0,
    });

    if (error) {
      showMessage('error', 'Erro ao criar status.');
    } else {
      setNewStatus({ nome: '', cor: '#3b82f6', ordem: leadStatuses.length + 2 });
      await refreshLeadStatuses();
      showMessage('success', 'Status criado com sucesso.');
    }

    setSaving(false);
  };

  const handleUpdate = async (
    id: string,
    updates: Partial<{ nome: string; cor: string; ordem: number; ativo: boolean; padrao: boolean }>,
    successMessage?: string,
  ) => {
    setProcessingId(id);
    const { error } = await configService.updateLeadStatus(id, updates);
    if (error) {
      showMessage('error', 'Erro ao atualizar status.');
    } else {
      await refreshLeadStatuses();
      if (successMessage) {
        showMessage('success', successMessage);
      }
    }
    setProcessingId(null);
  };

  const handleNameBlur = async (id: string, originalName: string) => {
    const nextName = drafts[id]?.nome?.trim() ?? '';
    if (!nextName) {
      updateDraft(id, { nome: originalName });
      showMessage('error', 'O nome do status não pode ficar vazio.');
      return;
    }

    if (nextName === originalName) {
      return;
    }

    await handleUpdate(id, { nome: nextName }, 'Nome do status atualizado.');
  };

  const handleOrderBlur = async (id: string, originalOrder: number) => {
    const rawOrder = drafts[id]?.ordem?.trim() ?? '';
    if (!rawOrder) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem válida para o status.');
      return;
    }

    const parsedOrder = Number.parseInt(rawOrder, 10);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem válida para o status.');
      return;
    }

    if (parsedOrder === originalOrder) {
      return;
    }

    await handleUpdate(id, { ordem: parsedOrder }, 'Ordem do status atualizada.');
  };

  const handleDelete = async (id: string) => {
    const status = leadStatuses.find((item) => item.id === id);
    if (!status) {
      return;
    }

    if (status.padrao) {
      showMessage('error', 'Defina outro status como padrão antes de remover este item.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Excluir status',
      description: 'Deseja remover este status? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setProcessingId(id);
    const { error } = await configService.deleteLeadStatus(id);
    if (error) {
      showMessage('error', 'Erro ao remover status.');
    } else {
      await refreshLeadStatuses();
      showMessage('success', 'Status removido com sucesso.');
    }
    setProcessingId(null);
  };

  const handleSetDefault = async (id: string) => {
    const target = leadStatuses.find((item) => item.id === id);
    if (!target) {
      return;
    }

    setProcessingId(id);

    const results = await Promise.all(
      leadStatuses.map((status) => {
        if (status.id === id) {
          return configService.updateLeadStatus(status.id, { padrao: true });
        }
        if (status.padrao) {
          return configService.updateLeadStatus(status.id, { padrao: false });
        }
        return Promise.resolve({ error: null });
      }),
    );

    const hasError = results.some((result) => Boolean(result.error));
    if (hasError) {
      showMessage('error', 'Erro ao definir status padrão.');
      setProcessingId(null);
      return;
    }

    await refreshLeadStatuses();
    showMessage('success', 'Status padrão atualizado.');
    setProcessingId(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Status dos Leads</h3>
          <p className="text-sm text-slate-600">
            Personalize as etapas do funil de leads e defina cores e ordens.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {leadStatuses.map((status) => {
          const isProcessing = processingId === status.id;

          return (
            <div
              key={status.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center space-x-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <span
                      className="rounded-full border px-3 py-1 text-sm font-medium"
                      style={getBadgeStyle(status.cor, 1)}
                    >
                      {status.nome}
                    </span>
                    {status.padrao && (
                      <span className="inline-flex items-center space-x-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs text-amber-600">
                        <Star className="h-3 w-3" />
                        <span>Padrão</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex flex-col text-xs text-slate-600">
                      Nome
                      <Input
                        type="text"
                        value={drafts[status.id]?.nome ?? status.nome}
                        onChange={(event) => updateDraft(status.id, { nome: event.target.value })}
                        onBlur={() => void handleNameBlur(status.id, status.nome)}
                        className="mt-1"
                        disabled={isProcessing}
                      />
                    </label>

                    <label className="flex flex-col text-xs text-slate-600">
                      Cor
                      <div className="mt-1 flex items-center space-x-2">
                        <input
                          type="color"
                          value={status.cor}
                          onChange={(event) =>
                            void handleUpdate(status.id, { cor: event.target.value })
                          }
                          className="h-10 w-16 rounded border border-slate-300"
                          disabled={isProcessing}
                        />
                        <span className="flex items-center space-x-1 text-xs text-slate-500">
                          <PaintBucket className="h-4 w-4 text-slate-400" />
                          <span>{status.cor}</span>
                        </span>
                      </div>
                    </label>

                    <label className="flex flex-col text-xs text-slate-600">
                      Ordem
                      <Input
                        type="number"
                        value={drafts[status.id]?.ordem ?? String(status.ordem)}
                        onChange={(event) => updateDraft(status.id, { ordem: event.target.value })}
                        onBlur={() => void handleOrderBlur(status.id, status.ordem)}
                        className="mt-1"
                        disabled={isProcessing}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={status.ativo}
                    onChange={(event) =>
                      void handleUpdate(status.id, { ativo: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    disabled={isProcessing}
                  />
                  <span>Ativo</span>
                </label>

                <Button
                  onClick={() => void handleSetDefault(status.id)}
                  variant={status.padrao ? 'warning' : 'secondary'}
                  size="sm"
                  disabled={isProcessing}
                >
                  Definir padrão
                </Button>

                <Button
                  onClick={() => void handleDelete(status.id)}
                  variant="danger"
                  size="icon"
                  className="h-9 w-9"
                  title="Remover status"
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">Adicionar novo status</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Nome</label>
            <Input
              type="text"
              value={newStatus.nome}
              onChange={(event) =>
                setNewStatus((current) => ({ ...current, nome: event.target.value }))
              }
              placeholder="Ex: Em negociação"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cor</label>
            <input
              type="color"
              value={newStatus.cor}
              onChange={(event) =>
                setNewStatus((current) => ({ ...current, cor: event.target.value }))
              }
              className="h-10 w-full rounded border border-slate-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Ordem</label>
            <Input
              type="number"
              value={newStatus.ordem}
              onChange={(event) =>
                setNewStatus((current) => ({
                  ...current,
                  ordem: Number.parseInt(event.target.value, 10) || 0,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={() => void handleCreate()}
            loading={saving}
          >
            {!saving && <Plus className="h-4 w-4" />}
            <span>{saving ? 'Salvando...' : 'Adicionar status'}</span>
          </Button>
        </div>
      </div>

      {ConfirmationDialog}
    </div>
  );
}
