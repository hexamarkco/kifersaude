import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit2,
  Plus,
  Search,
  Save,
  Trash2,
} from 'lucide-react';
import { configService } from '../../lib/configService';
import { type Operadora } from '../../lib/supabase';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import Textarea from '../ui/Textarea';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { OperadorasSkeleton } from '../ui/panelSkeletons';

type OperadorasTabProps = {
  embedded?: boolean;
};

type OperadoraFormState = {
  nome: string;
  comissao_padrao: number;
  prazo_recebimento_dias: number;
  bonus_por_vida: boolean;
  bonus_padrao: number;
  observacoes: string;
  ativo: boolean;
};

const DEFAULT_FORM_DATA: OperadoraFormState = {
  nome: '',
  comissao_padrao: 8,
  prazo_recebimento_dias: 30,
  bonus_por_vida: false,
  bonus_padrao: 0,
  observacoes: '',
  ativo: true,
};

export default function OperadorasTab({ embedded = false }: OperadorasTabProps) {
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OperadoraFormState>(DEFAULT_FORM_DATA);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const loadingUi = useAdaptiveLoading(loading);

  useEffect(() => {
    void loadOperadoras();
  }, []);

  const loadOperadoras = async () => {
    setLoading(true);
    const data = await configService.getOperadoras();
    setOperadoras(data);
    setLoading(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingId(null);
    setIsModalOpen(false);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsModalOpen(true);
  };

  const handleEdit = (operadora: Operadora) => {
    setFormData({
      nome: operadora.nome,
      comissao_padrao: operadora.comissao_padrao,
      prazo_recebimento_dias: operadora.prazo_recebimento_dias,
      bonus_por_vida: operadora.bonus_por_vida,
      bonus_padrao: operadora.bonus_padrao,
      observacoes: operadora.observacoes || '',
      ativo: operadora.ativo,
    });
    setEditingId(operadora.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (editingId) {
      const { error } = await configService.updateOperadora(editingId, formData);

      if (error) {
        showMessage('error', 'Erro ao atualizar operadora.');
        return;
      }

      showMessage('success', 'Operadora atualizada com sucesso.');
    } else {
      const { error } = await configService.createOperadora(formData);

      if (error) {
        showMessage('error', 'Erro ao criar operadora.');
        return;
      }

      showMessage('success', 'Operadora criada com sucesso.');
    }

    resetForm();
    await loadOperadoras();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir operadora',
      description: 'Tem certeza que deseja excluir esta operadora? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const { error } = await configService.deleteOperadora(id);

    if (error) {
      showMessage('error', 'Erro ao excluir operadora.');
      return;
    }

    showMessage('success', 'Operadora excluida com sucesso.');
    await loadOperadoras();
  };

  const hasOperadorasSnapshot = operadoras.length > 0;
  const containerClass = embedded
    ? 'space-y-6'
    : 'panel-page-shell space-y-6';

  const filteredOperadoras = useMemo(() => {
    const normalizedSearch = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!normalizedSearch) return operadoras;

    return operadoras.filter((operadora) => {
      const haystack = [
        operadora.nome,
        operadora.observacoes,
        operadora.bonus_por_vida ? 'bonus por vida' : '',
      ]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [operadoras, search]);

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasOperadorasSnapshot}
      skeleton={<OperadorasSkeleton />}
      stageLabel="Carregando operadoras..."
      overlayLabel="Atualizando operadoras..."
      stageClassName="min-h-[420px]"
    >
      <div className={containerClass}>
        {message && (
          <div
            className={`flex items-center space-x-3 rounded-xl border p-4 ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        <div className="rounded-3xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Organização de operadoras</p>
              <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text)]">Operadoras</h4>
            </div>
            <div className="flex w-full gap-3 lg:w-auto lg:min-w-[460px]">
              <div className="flex-1 lg:min-w-[300px]">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar operadora"
                  leftIcon={Search}
                />
              </div>
              <Button onClick={handleCreateClick}>
                <Plus className="h-4 w-4" />
                <span>Nova operadora</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] shadow-sm">
            {filteredOperadoras.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[var(--panel-surface-soft)] py-14 text-center">
                <Building2 className="mx-auto h-12 w-12 text-[color:var(--panel-text-muted)]" />
                <p className="mt-4 text-sm font-medium text-[color:var(--panel-text)]">{operadoras.length === 0 ? 'Nenhuma operadora cadastrada' : 'Nenhuma operadora encontrada'}</p>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">{operadoras.length === 0 ? 'Crie a primeira operadora para liberar configurações comerciais.' : 'Ajuste a busca para localizar a operadora desejada.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                {filteredOperadoras.map((operadora) => {
                  const isEditing = operadora.id === editingId;

                  return (
                    <article
                      key={operadora.id}
                      className={`flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between ${
                        isEditing
                          ? 'bg-[var(--panel-surface-soft)]'
                          : 'bg-[var(--panel-surface)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="text-base font-semibold text-[color:var(--panel-text)]">{operadora.nome}</h5>
                          {!operadora.ativo && (
                            <span className="rounded-full border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--panel-text-soft)]">
                              Inativa
                            </span>
                          )}
                          {operadora.bonus_por_vida && (
                            <span className="rounded-full border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-2.5 py-1 text-xs font-medium text-[color:var(--panel-text-soft)]">
                              Bônus por vida
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft)]">
                          <span className="rounded-full border border-[color:var(--panel-border-subtle)] px-2.5 py-1">
                            Comissão: <span className="font-semibold text-[color:var(--panel-text)]">{operadora.comissao_padrao}%</span>
                          </span>
                          <span className="rounded-full border border-[color:var(--panel-border-subtle)] px-2.5 py-1">
                            Prazo: <span className="font-semibold text-[color:var(--panel-text)]">{operadora.prazo_recebimento_dias} dias</span>
                          </span>
                          <span className="rounded-full border border-[color:var(--panel-border-subtle)] px-2.5 py-1">
                            Bônus: <span className="font-semibold text-[color:var(--panel-text)]">{operadora.bonus_por_vida ? `R$ ${operadora.bonus_padrao.toFixed(2)}` : 'Não possui'}</span>
                          </span>
                        </div>

                        {operadora.observacoes && (
                          <p className="mt-3 text-sm text-[color:var(--panel-text-soft)]">{operadora.observacoes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <Button variant="icon" size="icon" className="h-10 w-10 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => handleEdit(operadora)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => void handleDelete(operadora.id)}
                          variant="icon"
                          size="icon"
                          className="h-10 w-10 text-red-600 hover:bg-red-50"
                          title="Excluir operadora"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
        </div>
        <ModalShell
          isOpen={isModalOpen}
          onClose={resetForm}
          title={editingId ? 'Editar operadora' : 'Nova operadora'}
          description="Defina regras padrão para comissão, prazo e eventuais bônus."
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Nome da operadora *</label>
                <Input
                  type="text"
                  value={formData.nome}
                  onChange={(event) => setFormData({ ...formData, nome: event.target.value })}
                  required
                  placeholder="Ex: Unimed"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Comissão padrão (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="500"
                  value={formData.comissao_padrao}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      comissao_padrao: Number.parseFloat(event.target.value) || 0,
                    })
                  }
                />
                <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Pode exceder 100% para contratos PJ.</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Prazo de recebimento (dias)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.prazo_recebimento_dias}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      prazo_recebimento_dias: Number.parseInt(event.target.value, 10) || 30,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4 transition-colors hover:border-[color:var(--panel-accent-emerald-border)]">
                <input
                  type="checkbox"
                  checked={formData.bonus_por_vida}
                  onChange={(event) => setFormData({ ...formData, bonus_por_vida: event.target.checked })}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">Bônus por vida</p>
                  <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Ative se a operadora tiver bônus recorrente adicional.</p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4 transition-colors hover:border-[color:var(--panel-border)]">
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(event) => setFormData({ ...formData, ativo: event.target.checked })}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                />
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">Operadora ativa</p>
                  <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Mantém a operadora disponível para novos contratos.</p>
                </div>
              </label>
            </div>

            {formData.bonus_por_vida && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Bônus padrão (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonus_padrao}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      bonus_padrao: Number.parseFloat(event.target.value) || 0,
                    })
                  }
                  placeholder="Valor em reais"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft)]">Observações</label>
              <Textarea
                value={formData.observacoes}
                onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                rows={4}
                className="min-h-[104px]"
                placeholder="Notas comerciais, regras específicas ou exceções..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">
                <Save className="h-4 w-4" />
                <span>{editingId ? 'Salvar alterações' : 'Criar operadora'}</span>
              </Button>
              <Button type="button" onClick={resetForm} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        </ModalShell>
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
