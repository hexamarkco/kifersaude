import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle, Plus, Trash2, X } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

type Message = { type: 'success' | 'error'; text: string };

export default function LeadOriginsManager() {
  const { leadOrigins, refreshLeadOrigins } = useConfig();
  const [newOrigin, setNewOrigin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

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

  const handleCreate = async () => {
    if (!newOrigin.trim()) {
      showMessage('error', 'Informe o nome da origem.');
      return;
    }

    setSaving(true);
    const { error } = await configService.createLeadOrigem({
      nome: newOrigin.trim(),
      ativo: true,
      visivel_para_observadores: true,
    });

    if (error) {
      showMessage('error', 'Erro ao adicionar origem.');
    } else {
      setNewOrigin('');
      await refreshLeadOrigins();
      showMessage('success', 'Origem adicionada com sucesso.');
    }

    setSaving(false);
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    setBusyId(id);
    const { error } = await configService.updateLeadOrigem(id, { ativo });
    if (error) {
      showMessage('error', 'Erro ao atualizar origem.');
    } else {
      await refreshLeadOrigins();
    }
    setBusyId(null);
  };

  const handleToggleObserverVisibility = async (id: string, visivel: boolean) => {
    setBusyId(id);
    const { error } = await configService.updateLeadOrigem(id, {
      visivel_para_observadores: visivel,
    });
    if (error) {
      showMessage('error', 'Erro ao atualizar visibilidade para observadores.');
    } else {
      await refreshLeadOrigins();
    }
    setBusyId(null);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir origem',
      description: 'Deseja remover esta origem? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setBusyId(id);
    const { error } = await configService.deleteLeadOrigem(id);
    if (error) {
      showMessage('error', 'Erro ao remover origem.');
    } else {
      await refreshLeadOrigins();
      showMessage('success', 'Origem removida com sucesso.');
    }
    setBusyId(null);
  };

  const startEditing = (id: string, nome: string) => {
    setEditingId(id);
    setEditingName(nome);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const confirmEditing = async () => {
    if (!editingId) {
      return;
    }

    if (!editingName.trim()) {
      showMessage('error', 'Informe o nome da origem.');
      return;
    }

    setBusyId(editingId);
    const { error } = await configService.updateLeadOrigem(editingId, {
      nome: editingName.trim(),
    });
    if (error) {
      showMessage('error', 'Erro ao atualizar origem.');
    } else {
      await refreshLeadOrigins();
      cancelEditing();
      showMessage('success', 'Origem atualizada com sucesso.');
    }
    setBusyId(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Origens de Leads</h3>
          <p className="text-sm text-slate-600">Gerencie todos os canais de entrada de leads.</p>
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

      <div className="space-y-3">
        {leadOrigins.map((origin) => {
          const isBusy = busyId === origin.id;

          return (
            <div
              key={origin.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="flex-1">
                {editingId === origin.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-900">{origin.nome}</p>
                )}

                <div className="mt-1 flex flex-col gap-1">
                  <p className="text-xs text-slate-500">{origin.ativo ? 'Ativo' : 'Inativo'}</p>
                  <p className="text-xs text-slate-500">
                    {origin.visivel_para_observadores
                      ? 'Visível para observadores'
                      : 'Oculto para observadores'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={origin.ativo}
                    onChange={(event) =>
                      void handleToggleAtivo(origin.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                  <span>Ativo</span>
                </label>

                <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={origin.visivel_para_observadores}
                    onChange={(event) =>
                      void handleToggleObserverVisibility(origin.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                  <span>Visível para observadores</span>
                </label>

                {editingId === origin.id ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => void confirmEditing()}
                      className="rounded-lg p-2 text-green-600 hover:bg-green-50"
                      title="Salvar"
                      disabled={isBusy}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      title="Cancelar"
                      disabled={isBusy}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEditing(origin.id, origin.nome)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                      disabled={isBusy}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => void handleDelete(origin.id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      title="Remover"
                      disabled={isBusy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">Adicionar nova origem</h4>
        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:space-x-3 md:space-y-0">
          <input
            type="text"
            value={newOrigin}
            onChange={(event) => setNewOrigin(event.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-teal-500"
            placeholder="Ex: Indicação"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-lg bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? 'Salvando...' : 'Adicionar origem'}</span>
          </button>
        </div>
      </div>

      {ConfirmationDialog}
    </div>
  );
}
