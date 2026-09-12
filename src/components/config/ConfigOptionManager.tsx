import { useEffect, useMemo, useState } from 'react';
import { ListPlus, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService, type ConfigCategory } from '../../features/config/data/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { toast } from '../../lib/toast';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  IconButton,
  Switch,
} from '../../design-system';

type ConfigOptionManagerProps = {
  category: ConfigCategory;
  title: string;
  description?: string;
  placeholder?: string;
};

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

  const showMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
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
      setIsCreateModalOpen(false);
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
    <Card padding="md">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="kds-card-title">{title}</h3>
          {description && <p className="kds-card-subtitle mt-1">{description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{items.length} {items.length === 1 ? 'opção' : 'opções'}</Badge>
            <Badge tone="success">{items.filter((item) => item.ativo).length} ativas</Badge>
          </div>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving} className="w-full sm:w-auto">
          <Plus className="kds-control-icon" />
          <span>Adicionar opção</span>
        </Button>
      </div>

      <p className="mt-4 text-xs text-[var(--text-secondary)]">
        Nome e ordem são salvos automaticamente ao sair do campo.
      </p>

      {items.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<ListPlus aria-hidden="true" />}
          title="Nenhuma opção cadastrada"
          description="Adicione opções para disponibilizá-las nos formulários de leads."
          action={(
            <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
              <Plus className="kds-control-icon" />
              Adicionar primeira opção
            </Button>
          )}
        />
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => {
            const isBusy = busyId === item.id;

            return (
              <Card
                key={item.id}
                variant="muted"
                padding="md"
                className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end"
              >
                <Field label="Nome da opção" htmlFor={`config-option-label-${item.id}`}>
                  <Input
                    id={`config-option-label-${item.id}`}
                    type="text"
                    value={drafts[item.id]?.label ?? item.label}
                    onChange={(event) => updateDraft(item.id, { label: event.target.value })}
                    onBlur={() => void handleLabelBlur(item.id, item.label)}
                    disabled={isBusy}
                  />
                </Field>

                <Field label="Ordem" htmlFor={`config-option-order-${item.id}`}>
                  <Input
                    id={`config-option-order-${item.id}`}
                    type="number"
                    min="0"
                    value={drafts[item.id]?.ordem ?? String(item.ordem)}
                    onChange={(event) => updateDraft(item.id, { ordem: event.target.value })}
                    onBlur={() => void handleOrderBlur(item.id, item.ordem)}
                    disabled={isBusy}
                  />
                </Field>

                <div className="flex items-center justify-between gap-3 xl:justify-end">
                  <div className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 xl:min-w-40">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.ativo ? 'Ativa' : 'Inativa'}</p>
                      <p className="text-xs text-[var(--text-secondary)]">Disponibilidade</p>
                    </div>
                    <Switch
                      size="sm"
                      checked={item.ativo}
                      onChange={(event) => void handleUpdate(item.id, { ativo: event.target.checked })}
                      disabled={isBusy}
                      aria-label={`${item.ativo ? 'Desativar' : 'Ativar'} opção ${item.label}`}
                    />
                  </div>

                  <IconButton
                    onClick={() => void handleDelete(item.id)}
                    variant="danger"
                    title="Remover opção"
                    disabled={isBusy}
                    size="md"
                    aria-label={`Remover opção ${item.label}`}
                  >
                    <Trash2 className="kds-control-icon" aria-hidden="true" />
                  </IconButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setNewLabel('');
          }
        }}
        size="sm"
      >
        <DialogHeader
          onClose={() => {
            setIsCreateModalOpen(false);
            setNewLabel('');
          }}
        >
          <DialogTitle>{`Nova opção${title ? ` - ${title}` : ''}`}</DialogTitle>
          <DialogDescription>Adicione um novo item a esta lista.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            id="config-option-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <Field label="Nome da opção">
              <Input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder={placeholder || 'Nova opção'}
              />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsCreateModalOpen(false);
              setNewLabel('');
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" form="config-option-create-form" disabled={saving}>
            <Plus className="kds-control-icon" />
            <span>{saving ? 'Salvando' : 'Adicionar'}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </Card>
  );
}
