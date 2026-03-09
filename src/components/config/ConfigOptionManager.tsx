import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService, type ConfigCategory } from '../../lib/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';

type ConfigOptionManagerProps = {
  category: ConfigCategory;
  title: string;
  description?: string;
  placeholder?: string;
};

type Message = { type: 'success' | 'error'; text: string };
type OptionDraft = { label: string; ordem: string };

export default function ConfigOptionManager({
  category,
  title,
  description,
  placeholder,
}: ConfigOptionManagerProps) {
  const { options, refreshCategory } = useConfig();
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OptionDraft>>({});
  const [message, setMessage] = useState<Message | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const items = useMemo(() => options[category] || [], [category, options]);

  useEffect(() => {
    const nextDrafts: Record<string, OptionDraft> = {};
    items.forEach((item) => {
      nextDrafts[item.id] = {
        label: item.label,
        ordem: String(item.ordem),
      };
    });
    setDrafts(nextDrafts);
  }, [items]);

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

  const updateDraft = (id: string, updates: Partial<OptionDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        label: current[id]?.label ?? '',
        ordem: current[id]?.ordem ?? '',
        ...updates,
      },
    }));
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      showMessage('error', 'Informe o nome da opção.');
      return;
    }

    setSaving(true);
    const { error } = await configService.createConfigOption(category, {
      label: newLabel.trim(),
      ordem: items.length + 1,
      ativo: true,
    });

    if (error) {
      showMessage('error', 'Erro ao adicionar opção.');
    } else {
      setNewLabel('');
      await refreshCategory(category);
      showMessage('success', 'Opção adicionada com sucesso.');
    }
    setSaving(false);
  };

  const handleUpdate = async (
    id: string,
    updates: Partial<{ label: string; ordem: number; ativo: boolean }>,
    successMessage?: string,
  ) => {
    setBusyId(id);
    const { error } = await configService.updateConfigOption(category, id, updates);
    if (error) {
      showMessage('error', 'Erro ao atualizar opção.');
    } else {
      await refreshCategory(category);
      if (successMessage) {
        showMessage('success', successMessage);
      }
    }
    setBusyId(null);
  };

  const handleLabelBlur = async (id: string, originalLabel: string) => {
    const nextLabel = drafts[id]?.label?.trim() ?? '';
    if (!nextLabel) {
      updateDraft(id, { label: originalLabel });
      showMessage('error', 'O rótulo não pode ficar vazio.');
      return;
    }

    if (nextLabel === originalLabel) {
      return;
    }

    await handleUpdate(id, { label: nextLabel }, 'Rótulo atualizado com sucesso.');
  };

  const handleOrderBlur = async (id: string, originalOrder: number) => {
    const rawOrder = drafts[id]?.ordem?.trim() ?? '';
    if (!rawOrder) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem válida.');
      return;
    }

    const parsedOrder = Number.parseInt(rawOrder, 10);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem válida.');
      return;
    }

    if (parsedOrder === originalOrder) {
      return;
    }

    await handleUpdate(id, { ordem: parsedOrder }, 'Ordem atualizada com sucesso.');
  };

  const handleDelete = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir opção',
      description: 'Deseja remover esta opção? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setBusyId(id);
    const { error } = await configService.deleteConfigOption(category, id);
    if (error) {
      showMessage('error', 'Erro ao remover opção.');
    } else {
      await refreshCategory(category);
      showMessage('success', 'Opção removida com sucesso.');
    }
    setBusyId(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-sm text-slate-600">{description}</p>}
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
        {items.map((item) => {
          const isBusy = busyId === item.id;

          return (
            <div
              key={item.id}
              className="flex flex-col space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:space-x-3 md:space-y-0"
            >
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col text-xs text-slate-600">
                  Rótulo
                  <input
                    type="text"
                    value={drafts[item.id]?.label ?? item.label}
                    onChange={(event) => updateDraft(item.id, { label: event.target.value })}
                    onBlur={() => void handleLabelBlur(item.id, item.label)}
                    className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                </label>

                <label className="flex flex-col text-xs text-slate-600">
                  Ordem
                  <input
                    type="number"
                    value={drafts[item.id]?.ordem ?? String(item.ordem)}
                    onChange={(event) => updateDraft(item.id, { ordem: event.target.value })}
                    onBlur={() => void handleOrderBlur(item.id, item.ordem)}
                    className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center space-x-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(event) =>
                      void handleUpdate(item.id, { ativo: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    disabled={isBusy}
                  />
                  <span>Ativo</span>
                </label>

                <button
                  onClick={() => void handleDelete(item.id)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  title="Remover opção"
                  disabled={isBusy}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
            Nenhuma opção cadastrada ainda.
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-6">
        <h4 className="mb-3 text-sm font-semibold text-slate-900">Adicionar nova opção</h4>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Rótulo</label>
            <input
              type="text"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-teal-500"
              placeholder={placeholder || 'Ex: Valor visível para o usuário'}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => void handleCreate()}
            disabled={saving}
            className="inline-flex items-center space-x-2 rounded-lg bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{saving ? 'Salvando...' : 'Adicionar opção'}</span>
          </button>
        </div>
      </div>

      {ConfirmationDialog}
    </div>
  );
}
