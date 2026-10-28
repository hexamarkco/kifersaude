import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useConfig } from '../../../../contexts/ConfigContext';
import { configService } from '../../data/configService';
import { useConfirmationModal } from '../../../../hooks/useConfirmationModal';
import { toast } from '../../../../lib/toast';
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  IconButton,
  Switch,
} from '../../../../design-system';
import { SettingsCatalogList } from './SettingsCatalogList';

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
    <section>
      <SettingsCatalogList
        title="Origens dos leads" description="Defina os canais de entrada e quais deles podem ser vistos por observadores."
        items={leadOrigins} getId={(origin) => origin.id} getSearchText={(origin) => origin.nome}
        initialSortKey="name" gridClassName="md:grid-cols-[minmax(15rem,2fr)_minmax(8rem,0.9fr)_minmax(9rem,1fr)_5rem]"
        columns={[
          { key: 'name', label: 'Origem', getValue: (origin) => origin.nome },
          { key: 'active', label: 'Disponível', getValue: (origin) => Number(origin.ativo) },
          { key: 'observer', label: 'Observadores', getValue: (origin) => Number(origin.visivel_para_observadores) },
          { key: 'actions', label: 'Ações' },
        ]}
        action={<Button size="sm" onClick={() => setIsCreateModalOpen(true)} disabled={saving}><Plus className="kds-control-icon" aria-hidden="true" />Adicionar origem</Button>}
        hideSectionTitle
        emptyTitle="Nenhuma origem cadastrada" emptyDescription="Adicione uma origem para identificar de onde os leads chegam."
        renderItem={(origin) => {
          const isBusy = busyId === origin.id;
          const isEditing = editingId === origin.id;
          return <>
            {isEditing ? <Input size="sm" aria-label={`Nome da origem ${origin.nome}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} disabled={isBusy} />
              : <span className="min-w-0 break-words text-sm text-[var(--text-primary)]">{origin.nome}</span>}
            <div className="flex flex-wrap items-center justify-end gap-3 md:contents">
              <div className="flex items-center gap-2">
                <Switch size="sm" checked={origin.ativo} onChange={(event) => void handleToggleAtivo(origin.id, event.target.checked)} disabled={isBusy} aria-label={`${origin.ativo ? 'Desativar' : 'Ativar'} origem ${origin.nome}`} />
                <span className="text-xs text-[var(--text-secondary)]">{origin.ativo ? 'Ativa' : 'Inativa'}</span>
              </div>
              <div className="flex items-center gap-2" title={origin.visivel_para_observadores ? 'Visível para observadores' : 'Oculta para observadores'}>
                <Switch size="sm" checked={origin.visivel_para_observadores} onChange={(event) => void handleToggleObserverVisibility(origin.id, event.target.checked)} disabled={isBusy} aria-label={`${origin.visivel_para_observadores ? 'Ocultar' : 'Exibir'} ${origin.nome} para observadores`} />
                <span className="text-xs text-[var(--text-secondary)] md:sr-only">Observadores</span>
              </div>
              <ButtonGroup size="sm" role="group" aria-label={`Ações da origem ${origin.nome}`}>
                {isEditing ? <>
                  <IconButton onClick={() => void confirmEditing()} variant="success" disabled={isBusy} size="sm" aria-label={`Salvar origem ${origin.nome}`} title="Salvar origem"><Check aria-hidden="true" /></IconButton>
                  <IconButton onClick={cancelEditing} variant="secondary" disabled={isBusy} size="sm" aria-label={`Cancelar edição de ${origin.nome}`} title="Cancelar edição"><X aria-hidden="true" /></IconButton>
                </> : <>
                  <IconButton onClick={() => startEditing(origin.id, origin.nome)} variant="secondary" size="sm" disabled={isBusy} aria-label={`Editar origem ${origin.nome}`} title="Editar origem"><Pencil aria-hidden="true" /></IconButton>
                  <IconButton onClick={() => void handleDelete(origin.id)} variant="danger" disabled={isBusy} size="sm" aria-label={`Excluir origem ${origin.nome}`} title="Excluir origem"><Trash2 aria-hidden="true" /></IconButton>
                </>}
              </ButtonGroup>
            </div>
          </>;
        }}
      />
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
    </section>
  );
}
