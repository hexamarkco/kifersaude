import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit2,
  Plus,
  Save,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { configService } from '../../lib/configService';
import { type Operadora } from '../../lib/supabase';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import Button from '../ui/Button';
import Input from '../ui/Input';
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

const metricCardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

export default function OperadorasTab({ embedded = false }: OperadorasTabProps) {
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<OperadoraFormState>(DEFAULT_FORM_DATA);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const loadingUi = useAdaptiveLoading(loading);

  useEffect(() => {
    void loadOperadoras();
  }, []);

  const activeOperadoras = useMemo(() => operadoras.filter((operadora) => operadora.ativo), [operadoras]);
  const bonusEnabledOperadoras = useMemo(
    () => operadoras.filter((operadora) => operadora.bonus_por_vida),
    [operadoras],
  );
  const averageCommission = useMemo(() => {
    if (operadoras.length === 0) {
      return 0;
    }

    return operadoras.reduce((sum, operadora) => sum + operadora.comissao_padrao, 0) / operadoras.length;
  }, [operadoras]);

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
    setShowForm(false);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setFormData(DEFAULT_FORM_DATA);
    setShowForm(true);
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
    setShowForm(true);
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
      description: 'Tem certeza que deseja excluir esta operadora? Esta acao nao pode ser desfeita.',
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

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                <Building2 className="h-3.5 w-3.5" />
                Operadoras
              </div>
              <h3 className="text-2xl font-semibold">Configure regras comerciais sem sair das configuracoes gerais</h3>
              <p className="mt-2 text-sm text-slate-200">
                Cadastre operadoras, ajuste comissao, prazo e bonus em um fluxo unico e mais facil de revisar.
              </p>
            </div>

            <Button onClick={showForm ? resetForm : handleCreateClick} variant={showForm ? 'secondary' : 'primary'}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{showForm ? 'Fechar editor' : 'Nova operadora'}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={metricCardClass}>
            <p className="text-sm font-medium text-slate-500">Operadoras ativas</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{activeOperadoras.length}</p>
            <p className="mt-1 text-sm text-slate-600">de {operadoras.length || 0} cadastradas</p>
          </div>

          <div className={metricCardClass}>
            <p className="text-sm font-medium text-slate-500">Media de comissao</p>
            <div className="mt-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <p className="text-3xl font-semibold text-slate-900">{averageCommission.toFixed(1)}%</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">visao rapida do padrao atual</p>
          </div>

          <div className={metricCardClass}>
            <p className="text-sm font-medium text-slate-500">Com bonus por vida</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{bonusEnabledOperadoras.length}</p>
            <p className="mt-1 text-sm text-slate-600">operadoras com receita adicional recorrente</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">
                  {editingId ? 'Editar operadora' : 'Nova operadora'}
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  Defina regras padrao para comissao, prazo e eventuais bonus.
                </p>
              </div>
              {showForm && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="Fechar formulario"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {!showForm ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-4 text-sm font-medium text-slate-700">Selecione uma operadora para editar</p>
                <p className="mt-1 text-sm text-slate-500">ou crie uma nova com regras comerciais padrao.</p>
                <div className="mt-5">
                  <Button onClick={handleCreateClick}>
                    <Plus className="h-4 w-4" />
                    <span>Comecar cadastro</span>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">Nome da operadora *</label>
                    <Input
                      type="text"
                      value={formData.nome}
                      onChange={(event) => setFormData({ ...formData, nome: event.target.value })}
                      required
                      placeholder="Ex: Unimed"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Comissao padrao (%)</label>
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
                    <p className="mt-1 text-xs text-slate-500">Pode exceder 100% para contratos PJ.</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Prazo de recebimento (dias)</label>
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
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60">
                    <input
                      type="checkbox"
                      checked={formData.bonus_por_vida}
                      onChange={(event) => setFormData({ ...formData, bonus_por_vida: event.target.checked })}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Bonus por vida</p>
                      <p className="mt-1 text-sm text-slate-500">Ative se a operadora tiver bonus recorrente adicional.</p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(event) => setFormData({ ...formData, ativo: event.target.checked })}
                      className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Operadora ativa</p>
                      <p className="mt-1 text-sm text-slate-500">Mantem a operadora disponivel para novos contratos.</p>
                    </div>
                  </label>
                </div>

                {formData.bonus_por_vida && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Bonus padrao (R$)</label>
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">Observacoes</label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                    rows={4}
                    className="min-h-[104px]"
                    placeholder="Notas comerciais, regras especificas ou excecoes..."
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit">
                    <Save className="h-4 w-4" />
                    <span>{editingId ? 'Salvar alteracoes' : 'Criar operadora'}</span>
                  </Button>
                  <Button type="button" onClick={resetForm} variant="secondary">
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Carteira de operadoras</h4>
                <p className="mt-1 text-sm text-slate-600">Revise regras rapidamente e abra a edicao certa sem trocar de aba.</p>
              </div>
              {!showForm && operadoras.length > 0 && (
                <Button onClick={handleCreateClick} variant="secondary">
                  <Plus className="h-4 w-4" />
                  <span>Adicionar</span>
                </Button>
              )}
            </div>

            {operadoras.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-14 text-center">
                <Building2 className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-4 text-sm font-medium text-slate-700">Nenhuma operadora cadastrada</p>
                <p className="mt-1 text-sm text-slate-500">Crie a primeira operadora para liberar configuracoes comerciais.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {operadoras.map((operadora) => {
                  const isEditing = operadora.id === editingId;

                  return (
                    <div
                      key={operadora.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isEditing
                          ? 'border-emerald-300 bg-emerald-50/70'
                          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-base font-semibold text-slate-900">{operadora.nome}</h5>
                            {!operadora.ativo && (
                              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                                Inativa
                              </span>
                            )}
                            {operadora.bonus_por_vida && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Bonus por vida
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-3">
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Comissao</p>
                              <p className="mt-1 font-semibold text-slate-900">{operadora.comissao_padrao}%</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Prazo</p>
                              <p className="mt-1 font-semibold text-slate-900">{operadora.prazo_recebimento_dias} dias</p>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-400">Bonus</p>
                              <p className="mt-1 font-semibold text-slate-900">
                                {operadora.bonus_por_vida ? `R$ ${operadora.bonus_padrao.toFixed(2)}` : 'Nao possui'}
                              </p>
                            </div>
                          </div>

                          {operadora.observacoes && (
                            <p className="mt-3 text-sm text-slate-500">{operadora.observacoes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleEdit(operadora)}
                            variant="secondary"
                            className={isEditing ? 'border-emerald-300 bg-white text-emerald-700' : undefined}
                          >
                            <Edit2 className="h-4 w-4" />
                            <span>{isEditing ? 'Editando' : 'Editar'}</span>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
