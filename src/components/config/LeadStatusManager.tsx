import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, PaintBucket, Plus, Star, Trash2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { getBadgeStyle } from '../../lib/colorUtils';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardIcon,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from '../../design-system';

type Message = { type: 'success' | 'error'; text: string };
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
  const [message, setMessage] = useState<Message | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    const nextDrafts: Record<string, StatusDraft> = {};
    leadStatuses.forEach((status) => {
      nextDrafts[status.id] = { nome: status.nome, ordem: String(status.ordem) };
    });
    setDrafts(nextDrafts);
  }, [leadStatuses]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const showMessage = (type: Message['type'], text: string) => setMessage({ type, text });

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
    <Card padding="lg">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="kds-card-title">Status dos Leads</h3>
          <p className="kds-card-subtitle">
            Personalize as etapas do funil de leads e defina cores e ordens.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
          <Plus className="h-4 w-4" />
          <span>Novo status</span>
        </Button>
      </div>

      {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'danger'} className="mb-4">
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message.text}</span>
        </Alert>
      )}

      <div className="space-y-3">
        {leadStatuses.map((status) => {
          const isProcessing = processingId === status.id;

          return (
            <Card
              key={status.id}
              variant="muted"
              padding="sm"
              className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-center gap-4">
                <CardIcon>
                  <PaintBucket className="h-4 w-4" style={{ color: status.cor }} />
                </CardIcon>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{status.nome}</span>
                    {status.padrao && (
                      <Badge tone="gold">Padrão</Badge>
                    )}
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={getBadgeStyle(status.cor)}>
                      {status.cor}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Ordem atual: {status.ordem}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto_auto_auto] lg:min-w-[720px]">
                <Input
                  type="text"
                  value={drafts[status.id]?.nome ?? status.nome}
                  onChange={(event) => updateDraft(status.id, { nome: event.target.value })}
                  onBlur={() => void handleNameBlur(status.id, status.nome)}
                  disabled={isProcessing}
                />
                <Input
                  type="number"
                  value={drafts[status.id]?.ordem ?? String(status.ordem)}
                  onChange={(event) => updateDraft(status.id, { ordem: event.target.value })}
                  onBlur={() => void handleOrderBlur(status.id, status.ordem)}
                  disabled={isProcessing}
                />
                <Input
                  type="color"
                  value={status.cor}
                  onChange={(event) => void handleUpdate(status.id, { cor: event.target.value })}
                  disabled={isProcessing}
                />
                <Button onClick={() => void handleSetDefault(status.id)} variant="secondary" disabled={isProcessing || status.padrao}>
                  <Star className="h-4 w-4" />
                  <span>Padrão</span>
                </Button>
                <Button onClick={() => void handleDelete(status.id)} variant="danger" size="icon" disabled={isProcessing}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
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
          <div className="space-y-4">
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

          <div className="flex items-center gap-3">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              <Plus className="h-4 w-4" />
              <span>{saving ? 'Salvando' : 'Adicionar'}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewStatus({ nome: '', cor: getDefaultStatusColor(), ordem: leadStatuses.length + 1 });
              }}
            >
              Cancelar
            </Button>
          </div>
          </div>
        </DialogBody>
      </Dialog>
      {ConfirmationDialog}
    </Card>
  );
}
