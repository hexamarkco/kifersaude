import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit2,
  Layers3,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { cotadorService, type CotadorProductManagerInput, type CotadorProductManagerRecord } from '../../features/cotador/services/cotadorService';
import type { CotadorAdministradora, CotadorEntidadeClasse, Operadora } from '../../lib/supabase';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import Tabs from '../ui/Tabs';
import Textarea from '../ui/Textarea';
import FilterSingleSelect from '../FilterSingleSelect';
import MultiSelectDropdown from './MultiSelectDropdown';

type CotadorCatalogTabProps = {
  embedded?: boolean;
};

type CatalogTabId = 'produtos' | 'administradoras' | 'entidades';

type Message = {
  type: 'success' | 'error';
  text: string;
};

type BaseCatalogForm = {
  nome: string;
  ativo: boolean;
  observacoes: string;
};

type ProductFormState = {
  nome: string;
  operadoraId: string;
  administradoraId: string;
  modalidade: string;
  abrangencia: string;
  acomodacao: string;
  entidadeIds: string[];
  comissaoSugerida: number;
  bonusPorVidaValor: number;
  ativo: boolean;
  observacoes: string;
};

const DEFAULT_BASE_FORM: BaseCatalogForm = {
  nome: '',
  ativo: true,
  observacoes: '',
};

const DEFAULT_PRODUCT_FORM: ProductFormState = {
  nome: '',
  operadoraId: '',
  administradoraId: '',
  modalidade: '',
  abrangencia: '',
  acomodacao: '',
  entidadeIds: [],
  comissaoSugerida: 0,
  bonusPorVidaValor: 0,
  ativo: true,
  observacoes: '',
};

const tabs: Array<{ id: CatalogTabId; label: string }> = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'administradoras', label: 'Administradoras' },
  { id: 'entidades', label: 'Entidades' },
];

function FeedbackBanner({ message }: { message: Message | null }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <span>{message.text}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
      <h4 className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{title}</h4>
      <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{description}</p>
    </div>
  );
}

export default function CotadorCatalogTab({ embedded = false }: CotadorCatalogTabProps) {
  const { options } = useConfig();
  const [activeTab, setActiveTab] = useState<CatalogTabId>('produtos');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [administradoras, setAdministradoras] = useState<CotadorAdministradora[]>([]);
  const [entidades, setEntidades] = useState<CotadorEntidadeClasse[]>([]);
  const [produtos, setProdutos] = useState<CotadorProductManagerRecord[]>([]);
  const [entityModalKind, setEntityModalKind] = useState<'administradoras' | 'entidades' | null>(null);
  const [entityEditingId, setEntityEditingId] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState<BaseCatalogForm>(DEFAULT_BASE_FORM);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    void loadCatalogData();
  }, []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const modalidadeOptions = useMemo(
    () => (options.contract_modalidade || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_modalidade],
  );
  const abrangenciaOptions = useMemo(
    () => (options.contract_abrangencia || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_abrangencia],
  );
  const acomodacaoOptions = useMemo(
    () => (options.contract_acomodacao || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_acomodacao],
  );

  const administradoraOptions = useMemo(
    () => administradoras.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [administradoras],
  );
  const entidadeOptions = useMemo(
    () => entidades.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [entidades],
  );
  const operadoraOptions = useMemo(
    () => operadoras.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [operadoras],
  );

  const showMessage = (type: Message['type'], text: string) => {
    setMessage({ type, text });
  };

  const loadCatalogData = async () => {
    setLoading(true);
    const [nextOperadoras, nextAdministradoras, nextEntidades, nextProdutos] = await Promise.all([
      configService.getOperadoras(),
      cotadorService.getAdministradoras(),
      cotadorService.getEntidadesClasse(),
      cotadorService.getProdutos(),
    ]);

    setOperadoras(nextOperadoras);
    setAdministradoras(nextAdministradoras);
    setEntidades(nextEntidades);
    setProdutos(nextProdutos);
    setLoading(false);
  };

  const resetEntityModal = () => {
    setEntityModalKind(null);
    setEntityEditingId(null);
    setEntityForm(DEFAULT_BASE_FORM);
  };

  const resetProductModal = () => {
    setProductModalOpen(false);
    setProductEditingId(null);
    setProductForm(DEFAULT_PRODUCT_FORM);
  };

  const openEntityModal = (kind: 'administradoras' | 'entidades', initial?: BaseCatalogForm & { id?: string }) => {
    setEntityModalKind(kind);
    setEntityEditingId(initial?.id ?? null);
    setEntityForm({
      nome: initial?.nome ?? '',
      ativo: initial?.ativo ?? true,
      observacoes: initial?.observacoes ?? '',
    });
  };

  const openProductModal = (product?: CotadorProductManagerRecord) => {
    setProductEditingId(product?.id ?? null);
    setProductForm({
      nome: product?.nome ?? '',
      operadoraId: product?.operadora_id ?? '',
      administradoraId: product?.administradora_id ?? '',
      modalidade: product?.modalidade ?? '',
      abrangencia: product?.abrangencia ?? '',
      acomodacao: product?.acomodacao ?? '',
      entidadeIds: product?.entidadesClasse.map((entity) => entity.id) ?? [],
      comissaoSugerida: product?.comissao_sugerida ?? 0,
      bonusPorVidaValor: product?.bonus_por_vida_valor ?? 0,
      ativo: product?.ativo ?? true,
      observacoes: product?.observacoes ?? '',
    });
    setProductModalOpen(true);
  };

  const handleEntitySubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!entityModalKind) {
      return;
    }

    setSubmitting(true);

    const action = entityModalKind === 'administradoras'
      ? entityEditingId
        ? cotadorService.updateAdministradora(entityEditingId, entityForm)
        : cotadorService.createAdministradora(entityForm)
      : entityEditingId
        ? cotadorService.updateEntidadeClasse(entityEditingId, entityForm)
        : cotadorService.createEntidadeClasse(entityForm);

    const result = await action;
    if (result.error) {
      showMessage('error', `Erro ao salvar ${entityModalKind === 'administradoras' ? 'administradora' : 'entidade'}.`);
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', `${entityModalKind === 'administradoras' ? 'Administradora' : 'Entidade'} salva com sucesso.`);
    setSubmitting(false);
    resetEntityModal();
  };

  const handleDeleteEntity = async (kind: 'administradoras' | 'entidades', id: string) => {
    const confirmed = await requestConfirmation({
      title: kind === 'administradoras' ? 'Excluir administradora' : 'Excluir entidade',
      description: 'Essa ação remove o registro do catálogo do Cotador. Relações existentes em produtos serão ajustadas automaticamente.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const result = kind === 'administradoras'
      ? await cotadorService.deleteAdministradora(id)
      : await cotadorService.deleteEntidadeClasse(id);

    if (result.error) {
      showMessage('error', 'Erro ao excluir item do catálogo.');
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Item removido com sucesso.');
  };

  const handleProductSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!productForm.operadoraId) {
      showMessage('error', 'Selecione uma operadora para o produto.');
      return;
    }

    const payload: CotadorProductManagerInput = {
      operadora_id: productForm.operadoraId,
      administradora_id: productForm.administradoraId || null,
      nome: productForm.nome,
      modalidade: productForm.modalidade || null,
      abrangencia: productForm.abrangencia || null,
      acomodacao: productForm.acomodacao || null,
      entidadeIds: productForm.entidadeIds,
      comissao_sugerida: productForm.comissaoSugerida,
      bonus_por_vida_valor: productForm.bonusPorVidaValor,
      ativo: productForm.ativo,
      observacoes: productForm.observacoes,
    };

    setSubmitting(true);
    const result = productEditingId
      ? await cotadorService.updateProduto(productEditingId, payload)
      : await cotadorService.createProduto(payload);

    if (result.error) {
      showMessage('error', 'Erro ao salvar produto do Cotador.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Produto salvo com sucesso.');
    setSubmitting(false);
    resetProductModal();
  };

  const handleDeleteProduct = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir produto do Cotador',
      description: 'O produto será removido do catálogo principal do Cotador, mas os snapshots de cotações já geradas permanecem preservados.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    const result = await cotadorService.deleteProduto(id);
    if (result.error) {
      showMessage('error', 'Erro ao excluir produto do Cotador.');
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Produto removido com sucesso.');
  };

  const containerClass = embedded ? 'space-y-6' : 'panel-page-shell space-y-6';

  return (
    <div className={containerClass}>
      <FeedbackBanner message={message} />

      <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Layers3 className="h-3.5 w-3.5" />
              Catalogo do Cotador
            </div>
            <h3 className="text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Estruture operadoras, administradoras, entidades e produtos do jeito certo</h3>
            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              O workspace do Cotador agora consome um catalogo proprio e persistente. Ajuste a base comercial aqui sem acoplar pre-venda ao contrato final.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTab === 'produtos' ? (
              <Button onClick={() => openProductModal()}>
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            ) : (
              <Button onClick={() => openEntityModal(activeTab, undefined)}>
                <Plus className="h-4 w-4" />
                {activeTab === 'administradoras' ? 'Nova administradora' : 'Nova entidade'}
              </Button>
            )}
          </div>
        </div>

        <Tabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          variant="panel"
          className="mt-6"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando catalogo do Cotador...</p>
        </div>
      ) : activeTab === 'administradoras' ? (
        administradoras.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhuma administradora cadastrada"
            description="Cadastre as administradoras que sustentam as carteiras de adesao para liberar o relacionamento no catalogo do Cotador."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {administradoras.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                      {!item.ativo && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">Inativa</span>}
                    </div>
                    {item.observacoes && <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEntityModal('administradoras', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}>
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteEntity('administradoras', item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : activeTab === 'entidades' ? (
        entidades.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma entidade de classe cadastrada"
            description="Cadastre entidades, sindicatos e associacoes para conectar elegibilidade real aos produtos do Cotador."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {entidades.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                      {!item.ativo && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">Inativa</span>}
                    </div>
                    {item.observacoes && <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEntityModal('entidades', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}>
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteEntity('entidades', item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : produtos.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum produto do Cotador cadastrado"
          description="Os produtos antigos foram migrados para o novo catalogo quando a migration roda. Use esta area para criar novos itens ja com administradora e entidades relacionadas."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {produtos.map((product) => (
            <article key={product.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{product.nome}</h4>
                    {!product.ativo && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">Inativo</span>}
                    {product.legacy_produto_plano_id && <span className="rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(246,228,199,0.62)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#6f3f16)]">Migrado do legado</span>}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{product.operadora?.nome ?? 'Operadora nao encontrada'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => openProductModal(product)}>
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteProduct(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Modalidade</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{product.modalidade ?? 'A definir'}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Administradora</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{product.administradora?.nome ?? 'Sem administradora'}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Abrangencia</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{product.abrangencia ?? 'A definir'}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Acomodacao</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{product.acomodacao ?? 'A definir'}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">Comissao: {product.comissao_sugerida ?? 0}%</span>
                <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">Bonus: R$ {product.bonus_por_vida_valor ?? 0}</span>
                <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.entidadesClasse.length} entidade(s)</span>
              </div>

              {(product.entidadesClasse.length > 0 || product.observacoes) && (
                <div className="mt-4 rounded-2xl border border-[color:rgba(157,127,90,0.2)] bg-[color:rgba(255,253,250,0.82)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                  {product.entidadesClasse.length > 0 && (
                    <p>Entidades: {product.entidadesClasse.map((entity) => entity.nome).join(', ')}</p>
                  )}
                  {product.observacoes && <p>{product.observacoes}</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <ModalShell
        isOpen={entityModalKind !== null}
        onClose={resetEntityModal}
        title={entityEditingId ? `Editar ${entityModalKind === 'administradoras' ? 'administradora' : 'entidade'}` : `Nova ${entityModalKind === 'administradoras' ? 'administradora' : 'entidade'}`}
        description="Cadastre a base institucional que sera vinculada aos produtos do Cotador."
        size="md"
      >
        <form onSubmit={handleEntitySubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome *</label>
            <Input value={entityForm.nome} onChange={(event) => setEntityForm((current) => ({ ...current, nome: event.target.value }))} required />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input
              type="checkbox"
              checked={entityForm.ativo}
              onChange={(event) => setEntityForm((current) => ({ ...current, ativo: event.target.checked }))}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Registro ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Mantem o item disponivel para vinculacao em produtos e filtros do Cotador.</p>
            </div>
          </label>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observacoes</label>
            <Textarea value={entityForm.observacoes} onChange={(event) => setEntityForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button type="button" variant="secondary" onClick={resetEntityModal} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={productModalOpen}
        onClose={resetProductModal}
        title={productEditingId ? 'Editar produto do Cotador' : 'Novo produto do Cotador'}
        description="Relacione operadora, administradora e entidades sem depender do contrato final."
        size="lg"
      >
        <form onSubmit={handleProductSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome do produto *</label>
              <Input value={productForm.nome} onChange={(event) => setProductForm((current) => ({ ...current, nome: event.target.value }))} required />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Operadora *</label>
              <FilterSingleSelect
                icon={Building2}
                options={operadoraOptions}
                placeholder="Selecione uma operadora"
                value={productForm.operadoraId}
                onChange={(value) => setProductForm((current) => ({ ...current, operadoraId: value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Administradora</label>
              <FilterSingleSelect
                icon={ShieldCheck}
                options={administradoraOptions}
                placeholder="Sem administradora"
                value={productForm.administradoraId}
                onChange={(value) => setProductForm((current) => ({ ...current, administradoraId: value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Modalidade</label>
              <FilterSingleSelect
                icon={Layers3}
                options={modalidadeOptions}
                placeholder="Selecione a modalidade"
                value={productForm.modalidade}
                onChange={(value) => setProductForm((current) => ({ ...current, modalidade: value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Abrangencia</label>
              <FilterSingleSelect
                icon={MapPin}
                options={abrangenciaOptions}
                placeholder="Selecione a abrangencia"
                value={productForm.abrangencia}
                onChange={(value) => setProductForm((current) => ({ ...current, abrangencia: value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Acomodacao</label>
              <FilterSingleSelect
                icon={Sparkles}
                options={acomodacaoOptions}
                placeholder="Selecione a acomodacao"
                value={productForm.acomodacao}
                onChange={(value) => setProductForm((current) => ({ ...current, acomodacao: value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Comissao sugerida (%)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={productForm.comissaoSugerida}
                onChange={(event) => setProductForm((current) => ({ ...current, comissaoSugerida: Number.parseFloat(event.target.value) || 0 }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Bonus por vida (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={productForm.bonusPorVidaValor}
                onChange={(event) => setProductForm((current) => ({ ...current, bonusPorVidaValor: Number.parseFloat(event.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Entidades elegiveis</label>
            <MultiSelectDropdown
              options={entidadeOptions}
              values={productForm.entidadeIds}
              onChange={(values) => setProductForm((current) => ({ ...current, entidadeIds: values }))}
              placeholder="Vincule entidades quando o produto exigir elegibilidade"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input
              type="checkbox"
              checked={productForm.ativo}
              onChange={(event) => setProductForm((current) => ({ ...current, ativo: event.target.checked }))}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Produto ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Produtos inativos saem da vitrine principal do Cotador, mas permanecem no historico de cotações.</p>
            </div>
          </label>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observacoes</label>
            <Textarea value={productForm.observacoes} onChange={(event) => setProductForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}>
              <Save className="h-4 w-4" />
              Salvar produto
            </Button>
            <Button type="button" variant="secondary" onClick={resetProductModal} disabled={submitting}>
              Cancelar
            </Button>
          </div>
        </form>
      </ModalShell>

      {ConfirmationDialog}
    </div>
  );
}
