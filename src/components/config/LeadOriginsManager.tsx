import { useState } from 'react';
import { Check, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../features/config/data/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { toast } from '../../lib/toast';
import {
  Button,
  Badge,
  ButtonGroup,
  Card,
  CardIcon,
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

export default function LeadOriginsManager() {
  const { leadOrigins, refreshLeadOrigins } = useConfig();
  const [newOrigin, setNewOrigin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const showMessage = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
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
      setIsCreateModalOpen(false);
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
    const { error } = await configService.updateLeadOrigem(id, { visivel_para_observadores: visivel });
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
    const { error } = await configService.updateLeadOrigem(editingId, { nome: editingName.trim() });
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
    <Card padding="md">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="kds-card-title">Canais de entrada</h3>
          <p className="kds-card-subtitle mt-1">
            Gerencie onde os leads são captados e o que cada perfil pode visualizar.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{leadOrigins.length} {leadOrigins.length === 1 ? 'origem' : 'origens'}</Badge>
            <Badge tone="success">{leadOrigins.filter((origin) => origin.ativo).length} ativas</Badge>
          </div>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving} className="w-full sm:w-auto">
          <Plus className="kds-control-icon" />
          <span>Adicionar origem</span>
        </Button>
      </div>

      {leadOrigins.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<Share2 aria-hidden="true" />}
          title="Nenhum canal cadastrado"
          description="Adicione uma origem para identificar de onde os leads chegam."
          action={(
            <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
              <Plus className="kds-control-icon" />
              Adicionar primeira origem
            </Button>
          )}
        />
      ) : (
        <div className="mt-5 space-y-3">
          {leadOrigins.map((origin) => {
            const isBusy = busyId === origin.id;
            const isEditing = editingId === origin.id;

            return (
              <Card key={origin.id} variant="muted" padding="md" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)_auto] xl:items-center">
                  <div className="flex min-w-0 items-center justify-center gap-3">
                    <CardIcon>
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                    </CardIcon>
                    <div className={`min-w-0 ${isEditing ? 'flex-1' : 'w-fit max-w-full'}`}>
                      {isEditing ? (
                        <Field label="Nome da origem">
                          <Input
                            type="text"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            disabled={isBusy}
                          />
                        </Field>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{origin.nome}</h4>
                          <Badge tone={origin.ativo ? 'success' : 'neutral'}>
                            {origin.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">Origem ativa</p>
                        <p className="text-xs text-[var(--text-secondary)]">Disponível no cadastro</p>
                      </div>
                      <Switch
                        size="sm"
                        checked={origin.ativo}
                        onChange={(event) => void handleToggleAtivo(origin.id, event.target.checked)}
                        disabled={isBusy}
                        aria-label={`${origin.ativo ? 'Desativar' : 'Ativar'} origem ${origin.nome}`}
                      />
                    </div>
                    <div className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">Observadores</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {origin.visivel_para_observadores ? 'Podem visualizar' : 'Visibilidade restrita'}
                        </p>
                      </div>
                      <Switch
                        size="sm"
                        checked={origin.visivel_para_observadores}
                        onChange={(event) => void handleToggleObserverVisibility(origin.id, event.target.checked)}
                        disabled={isBusy}
                        aria-label={`${origin.visivel_para_observadores ? 'Ocultar' : 'Exibir'} ${origin.nome} para observadores`}
                      />
                    </div>
                  </div>

                  {isEditing ? (
                    <ButtonGroup role="group" aria-label={`Salvar ou cancelar edição de ${origin.nome}`}>
                      <IconButton
                        onClick={() => void confirmEditing()}
                        variant="success"
                        disabled={isBusy}
                        size="md"
                        aria-label={`Salvar origem ${origin.nome}`}
                        title="Salvar origem"
                      >
                        <Check className="kds-control-icon" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        onClick={cancelEditing}
                        variant="secondary"
                        disabled={isBusy}
                        size="md"
                        aria-label={`Cancelar edição de ${origin.nome}`}
                        title="Cancelar edição"
                      >
                        <X className="kds-control-icon" aria-hidden="true" />
                      </IconButton>
                    </ButtonGroup>
                  ) : (
                    <div className="flex items-center gap-2 xl:justify-end">
                      <Button
                        onClick={() => startEditing(origin.id, origin.nome)}
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                      >
                        <Pencil className="kds-control-icon" />
                        Editar
                      </Button>
                      <IconButton
                        onClick={() => void handleDelete(origin.id)}
                        variant="danger"
                        disabled={isBusy}
                        size="md"
                        aria-label={`Excluir origem ${origin.nome}`}
                        title="Excluir origem"
                      >
                        <Trash2 className="kds-control-icon" aria-hidden="true" />
                      </IconButton>
                    </div>
                  )}
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
            setNewOrigin('');
          }
        }}
        size="sm"
      >
        <DialogHeader
          onClose={() => {
            setIsCreateModalOpen(false);
            setNewOrigin('');
          }}
        >
          <DialogTitle>Nova origem</DialogTitle>
          <DialogDescription>Cadastre um novo canal de entrada de leads.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            id="lead-origin-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <Field label="Nome da origem">
              <Input
                type="text"
                value={newOrigin}
                onChange={(event) => setNewOrigin(event.target.value)}
                placeholder="Ex: Indicação"
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
              setNewOrigin('');
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" form="lead-origin-create-form" disabled={saving}>
            <Plus className="kds-control-icon" />
            <span>{saving ? 'Salvando' : 'Adicionar'}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </Card>
  );
}
