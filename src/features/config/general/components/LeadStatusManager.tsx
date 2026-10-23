import { useEffect, useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useConfig } from '../../../../contexts/ConfigContext';
import { configService } from '../../data/configService';
import { useConfirmationModal } from '../../../../hooks/useConfirmationModal';
import { toast } from '../../../../lib/toast';
import {
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  IconButton,
} from '../../../../design-system';
import { SettingsCatalogList } from './SettingsCatalogList';

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
    <section>
      <SettingsCatalogList
        title="Etapas do funil" description="Organize os nomes, as cores e a etapa inicial dos novos leads."
        hint="Nome e ordem são salvos ao sair do campo. A estrela indica a etapa padrão."
        items={leadStatuses} getId={(status) => status.id} getSearchText={(status) => status.nome}
        initialSortKey="order" gridClassName="md:grid-cols-[minmax(0,1fr)_5rem_4rem_4rem_2.5rem]"
        columns={[
          { key: 'name', label: 'Etapa', getValue: (status) => status.nome },
          { key: 'order', label: 'Ordem', getValue: (status) => status.ordem },
          { key: 'color', label: 'Cor', getValue: (status) => status.cor },
          { key: 'default', label: 'Padrão', getValue: (status) => Number(status.padrao) },
          { key: 'actions', label: 'Ações' },
        ]}
        action={<Button size="sm" onClick={() => setIsCreateModalOpen(true)} disabled={saving}><Plus className="kds-control-icon" aria-hidden="true" />Adicionar etapa</Button>}
        emptyTitle="Seu funil ainda está vazio" emptyDescription="Adicione a primeira etapa para organizar o acompanhamento dos leads."
        renderItem={(status) => {
          const isProcessing = processingId === status.id;
          return <>
            <Input size="sm" aria-label={`Nome da etapa ${status.nome}`} value={drafts[status.id]?.nome ?? status.nome}
              onChange={(event) => updateDraft(status.id, { nome: event.target.value })} onBlur={() => void handleNameBlur(status.id, status.nome)} disabled={isProcessing} />
            <div className="flex flex-wrap items-center justify-end gap-2 md:contents">
              <div className="w-14 md:w-auto"><Input size="sm" type="number" min="0" aria-label={`Ordem da etapa ${status.nome}`} value={drafts[status.id]?.ordem ?? String(status.ordem)}
                onChange={(event) => updateDraft(status.id, { ordem: event.target.value })} onBlur={() => void handleOrderBlur(status.id, status.ordem)} disabled={isProcessing} /></div>
              <div className="w-10"><Input size="sm" type="color" value={status.cor} onChange={(event) => void handleUpdate(status.id, { cor: event.target.value })} disabled={isProcessing} aria-label={`Cor do status ${status.nome}`} /></div>
              <IconButton onClick={() => void handleSetDefault(status.id)} variant={status.padrao ? 'soft' : 'ghost'} disabled={isProcessing || status.padrao} size="sm"
                aria-label={status.padrao ? `${status.nome} é o status padrão` : `Definir ${status.nome} como padrão`} title={status.padrao ? 'Etapa padrão' : 'Definir como padrão'}><Star className={status.padrao ? 'fill-current' : ''} aria-hidden="true" /></IconButton>
              <IconButton onClick={() => void handleDelete(status.id)} variant="danger" disabled={isProcessing} size="sm" aria-label={`Excluir status ${status.nome}`} title="Excluir etapa"><Trash2 aria-hidden="true" /></IconButton>
            </div>
          </>;
        }}
      />
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </section>
  );
}
