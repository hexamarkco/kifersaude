import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService, type ConfigCategory } from '../../lib/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

    const timeout = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timeout);
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
      showMessage('error', 'Informe o nome da opcao.');
      return;
    }

    setSaving(true);
    const { error } = await configService.createConfigOption(category, {
      label: newLabel.trim(),
      ordem: items.length + 1,
      ativo: true,
    });

    if (error) {
      showMessage('error', 'Erro ao adicionar opcao.');
    } else {
      setNewLabel('');
      setIsCreateModalOpen(false);
      await refreshCategory(category);
      showMessage('success', 'Opcao adicionada com sucesso.');
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
      showMessage('error', 'Erro ao atualizar opcao.');
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
      showMessage('error', 'O rotulo nao pode ficar vazio.');
      return;
    }

    if (nextLabel === originalLabel) {
      return;
    }

    await handleUpdate(id, { label: nextLabel }, 'Rotulo atualizado com sucesso.');
  };

  const handleOrderBlur = async (id: string, originalOrder: number) => {
    const rawOrder = drafts[id]?.ordem?.trim() ?? '';
    if (!rawOrder) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem valida.');
      return;
    }

    const parsedOrder = Number.parseInt(rawOrder, 10);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      updateDraft(id, { ordem: String(originalOrder) });
      showMessage('error', 'Informe uma ordem valida.');
      return;
    }

    if (parsedOrder === originalOrder) {
      return;
    }

    await handleUpdate(id, { ordem: parsedOrder }, 'Ordem atualizada com sucesso.');
  };

  const handleDelete = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir opcao',
      description: 'Deseja remover esta opcao? Esta acao nao pode ser desfeita.',
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
      showMessage('error', 'Erro ao remover opcao.');
    } else {
      await refreshCategory(category);
      showMessage('success', 'Opcao removida com sucesso.');
    }
    setBusyId(null);
  };

  return (
    <div className="rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[color:var(--panel-text)]">{title}</h3>
          {description && <p className="text-sm text-[color:var(--panel-text-soft)]">{description}</p>}
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
          <Plus className="h-4 w-4" />
          <span>Nova opcao</span>
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const isBusy = busyId === item.id;

          return (
            <div
              key={item.id}
              className="flex flex-col space-y-3 rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-4 py-4 md:flex-row md:items-center md:space-x-3 md:space-y-0"
            >
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col text-xs text-[color:var(--panel-text-soft)]">
                  Rotulo
                  <Input
                    type="text"
                    value={drafts[item.id]?.label ?? item.label}
                    onChange={(event) => updateDraft(item.id, { label: event.target.value })}
                    onBlur={() => void handleLabelBlur(item.id, item.label)}
                    className="mt-1"
                    disabled={isBusy}
                  />
                </label>

                <label className="flex flex-col text-xs text-[color:var(--panel-text-soft)]">
                  Ordem
                  <Input
                    type="number"
                    value={drafts[item.id]?.ordem ?? String(item.ordem)}
                    onChange={(event) => updateDraft(item.id, { ordem: event.target.value })}
                    onBlur={() => void handleOrderBlur(item.id, item.ordem)}
                    className="mt-1"
                    disabled={isBusy}
                  />
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center space-x-2 text-sm text-[color:var(--panel-text-soft)]">
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(event) => void handleUpdate(item.id, { ativo: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    disabled={isBusy}
                  />
                  <span>Ativo</span>
                </label>

                <Button
                  onClick={() => void handleDelete(item.id)}
                  variant="danger"
                  size="icon"
                  className="h-9 w-9"
                  title="Remover opcao"
                  disabled={isBusy}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ModalShell
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewLabel('');
        }}
        title={`Nova opcao${title ? ` - ${title}` : ''}`}
        description="Adicione um novo item a esta lista."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Nome da opcao</label>
            <Input
              type="text"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder={placeholder || 'Nova opcao'}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              <Plus className="h-4 w-4" />
              <span>{saving ? 'Salvando' : 'Adicionar'}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewLabel('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </ModalShell>
      {ConfirmationDialog}
    </div>
  );
}
