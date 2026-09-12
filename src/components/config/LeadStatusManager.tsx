import { useEffect, useState } from 'react';
import { PaintBucket, Plus, Star, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../features/config/data/configService';
import { getBadgeStyle } from '../../lib/colorUtils';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { toast } from '../../lib/toast';
import {
  Badge,
  Button,
  ButtonGroup,
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
} from '../../design-system';

type StatusDraft = { nome: string; ordem: string };

const getDefaultStatusColor = () => {
  if (typeof document === 'undefined') return '';

  return getComputedStyle(
    document.querySelector<HTMLElement>('.painel-theme.kifer-ds') ?? document.documentElement,
  )
    .getPropertyValue('--brand-primary')
    .trim();
};

export default function LeadStatusManager() {
  const { leadStatuses, refreshLeadStatuses } = useConfig();
  const [newStatus, setNewStatus] = useState({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 1 });
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StatusDraft>>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    const nextDrafts: Record<string, StatusDraft> = {};
    leadStatuses.forEach((status) => {
      nextDrafts[status.id] = { nome: status.nome, ordem: String(status.ordem) };
    });
    setDrafts(nextDrafts);
  }, [leadStatuses]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
  };

  const updateDraft = (id: string, updates: Partial<StatusDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: { nome: current[id]?.nome ?? '', ordem: current[id]?.ordem ?? '', ...updates },
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
      setNewStatus({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 2 });
      setIsCreateModalOpen(false);
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

    if (results.some((result) => Boolean(result.error))) {
      showMessage('error', 'Erro ao definir status padrão.');
      setProcessingId(null);
      return;
    }

    await refreshLeadStatuses();
    showMessage('success', 'Status padrão atualizado.');
    setProcessingId(null);
  };

  return (
    <Card padding="md">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="kds-card-title">Etapas do funil</h3>
          <p className="kds-card-subtitle mt-1">
            Organize os status, suas cores e a etapa inicial para novos leads.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{leadStatuses.length} {leadStatuses.length === 1 ? 'etapa' : 'etapas'}</Badge>
            <Badge tone="success">{leadStatuses.filter((status) => status.ativo).length} ativas</Badge>
          </div>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving} className="w-full sm:w-auto">
          <Plus className="kds-control-icon" />
          <span>Adicionar etapa</span>
        </Button>
      </div>

      {leadStatuses.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<PaintBucket aria-hidden="true" />}
          title="Seu funil ainda está vazio"
          description="Adicione a primeira etapa para organizar o acompanhamento dos leads."
          action={(
            <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
              <Plus className="kds-control-icon" />
              Adicionar primeira etapa
            </Button>
          )}
        />
      ) : (
        <div className="mt-5 space-y-3">
          {leadStatuses.map((status) => {
            const isProcessing = processingId === status.id;

            return (
              <Card
                key={status.id}
                variant="muted"
                padding="md"
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                      style={getBadgeStyle(status.cor)}
                      aria-hidden="true"
                    >
                      <PaintBucket className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Etapa {status.ordem}
                      </span>
                      {status.padrao ? <Badge tone="gold">Padrão do funil</Badge> : null}
                    </div>
                  </div>

                  <ButtonGroup role="group" aria-label={`Ações do status ${status.nome}`}>
                    <IconButton
                      onClick={() => void handleSetDefault(status.id)}
                      variant={status.padrao ? 'soft' : 'ghost'}
                      disabled={isProcessing || status.padrao}
                      size="md"
                      aria-label={status.padrao ? `${status.nome} é o status padrão` : `Definir ${status.nome} como padrão`}
                      title={status.padrao ? 'Status padrão' : 'Definir como padrão'}
                    >
                      <Star className={status.padrao ? 'kds-control-icon fill-current' : 'kds-control-icon'} aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      onClick={() => void handleDelete(status.id)}
                      variant="danger"
                      disabled={isProcessing}
                      size="md"
                      aria-label={`Excluir status ${status.nome}`}
                      title="Excluir status"
                    >
                      <Trash2 className="kds-control-icon" aria-hidden="true" />
                    </IconButton>
                  </ButtonGroup>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px_112px]">
                  <Field label="Nome do status">
                    <Input
                      type="text"
                      value={drafts[status.id]?.nome ?? status.nome}
                      onChange={(event) => updateDraft(status.id, { nome: event.target.value })}
                      onBlur={() => void handleNameBlur(status.id, status.nome)}
                      disabled={isProcessing}
                    />
                  </Field>
                  <Field label="Ordem">
                    <Input
                      type="number"
                      min="0"
                      value={drafts[status.id]?.ordem ?? String(status.ordem)}
                      onChange={(event) => updateDraft(status.id, { ordem: event.target.value })}
                      onBlur={() => void handleOrderBlur(status.id, status.ordem)}
                      disabled={isProcessing}
                    />
                  </Field>
                  <Field label="Cor">
                    <Input
                      type="color"
                      value={status.cor}
                      onChange={(event) => void handleUpdate(status.id, { cor: event.target.value })}
                      disabled={isProcessing}
                      aria-label={`Cor do status ${status.nome}`}
                    />
                  </Field>
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
            setNewStatus({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 1 });
          }
        }}
        size="sm"
      >
        <DialogHeader
          onClose={() => {
            setIsCreateModalOpen(false);
            setNewStatus({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 1 });
          }}
        >
          <DialogTitle>Novo status</DialogTitle>
          <DialogDescription>Crie uma nova etapa para o funil de leads.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            id="lead-status-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
            className="space-y-4"
          >
            <Field label="Nome do status">
              <Input
                type="text"
                value={newStatus.nome}
                onChange={(event) => setNewStatus((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Ex: Em negociação"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor">
                <Input
                  type="color"
                  value={newStatus.cor}
                  onChange={(event) => setNewStatus((current) => ({ ...current, cor: event.target.value }))}
                />
              </Field>

              <Field label="Ordem">
                <Input
                  type="number"
                  value={newStatus.ordem}
                  onChange={(event) => setNewStatus((current) => ({ ...current, ordem: Number.parseInt(event.target.value, 10) || 1 }))}
                />
              </Field>
            </div>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsCreateModalOpen(false);
              setNewStatus({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 1 });
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" form="lead-status-create-form" disabled={saving}>
            <Plus className="kds-control-icon" />
            <span>{saving ? 'Salvando' : 'Adicionar'}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </Card>
  );
}
