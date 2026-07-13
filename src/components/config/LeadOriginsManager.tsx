import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle, Plus, Trash2, X } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import { Alert, Card, Checkbox } from '../../design-system';

type Message = { type: 'success' | 'error'; text: string };

export default function LeadOriginsManager() {
  const { leadOrigins, refreshLeadOrigins } = useConfig();
  const [newOrigin, setNewOrigin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

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
    <Card padding="lg">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="kds-card-title">Origens de Leads</h3>
          <p className="kds-card-subtitle">Gerencie todos os canais de entrada de leads.</p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} disabled={saving}>
          <Plus className="h-4 w-4" />
          <span>Nova origem</span>
        </Button>
      </div>

      {message && (
        <Alert tone={message.type === 'success' ? 'success' : 'danger'} className="mb-4">
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{message.text}</span>
        </Alert>
      )}

      <div className="space-y-3">
        {leadOrigins.map((origin) => {
          const isBusy = busyId === origin.id;

          return (
            <Card
              key={origin.id}
              variant="muted"
              padding="sm"
              className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex-1">
                {editingId === origin.id ? (
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    disabled={isBusy}
                  />
                ) : (
                  <p className="text-sm font-medium text-[var(--text-primary)]">{origin.nome}</p>
                )}

                <div className="mt-1 flex flex-col gap-1">
                  <p className="text-xs text-[var(--text-secondary)]">{origin.ativo ? 'Ativo' : 'Inativo'}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {origin.visivel_para_observadores ? 'Visível para observadores' : 'Oculto para observadores'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                  <Checkbox
                    checked={origin.ativo}
                    onChange={(event) => void handleToggleAtivo(origin.id, event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Ativo</span>
                </label>

                <label className="inline-flex items-center space-x-2 text-sm text-[var(--text-secondary)]">
                  <Checkbox
                    checked={origin.visivel_para_observadores}
                    onChange={(event) => void handleToggleObserverVisibility(origin.id, event.target.checked)}
                    disabled={isBusy}
                  />
                  <span>Visível para observadores</span>
                </label>

                {editingId === origin.id ? (
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => void confirmEditing()} variant="success" size="icon" className="h-9 w-9" disabled={isBusy}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button onClick={cancelEditing} variant="secondary" size="icon" className="h-9 w-9" disabled={isBusy}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => startEditing(origin.id, origin.nome)} variant="secondary" size="sm" disabled={isBusy}>
                      Editar
                    </Button>
                    <Button onClick={() => void handleDelete(origin.id)} variant="danger" size="icon" className="h-9 w-9" disabled={isBusy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <ModalShell
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewOrigin('');
        }}
        title="Nova origem"
        description="Cadastre um novo canal de entrada de leads."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="kds-field-label mb-2 block">Nome da origem</label>
            <Input
              type="text"
              value={newOrigin}
              onChange={(event) => setNewOrigin(event.target.value)}
               placeholder="Ex: Indicação"
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
                setNewOrigin('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </ModalShell>
      {ConfirmationDialog}
    </Card>
  );
}
