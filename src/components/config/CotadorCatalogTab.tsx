import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Edit2,
  Layers3,
  MapPin,
  Network,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import type { CotadorAgeRange } from '../../features/cotador/shared/cotadorConstants';
import { COTADOR_AGE_RANGES } from '../../features/cotador/shared/cotadorConstants';
import {
  cotadorService,
  type CotadorLineManagerRecord,
  type CotadorPriceRowInput,
  type CotadorProductManagerInput,
  type CotadorProductManagerRecord,
  type CotadorTableManagerInput,
  type CotadorTableManagerRecord,
} from '../../features/cotador/services/cotadorService';
import type { CotadorAdministradora, CotadorEntidadeClasse, Operadora } from '../../lib/supabase';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import Tabs from '../ui/Tabs';
import Textarea from '../ui/Textarea';
import FilterSingleSelect from '../FilterSingleSelect';
import MultiSelectDropdown from './MultiSelectDropdown';
import OperadorasTab from './OperadorasTab';

type CotadorCatalogTabProps = {
  embedded?: boolean;
};

type CatalogTabId = 'operadoras' | 'linhas' | 'produtos' | 'tabelas' | 'administradoras' | 'entidades';

type Message = {
  type: 'success' | 'error';
  text: string;
};

type BaseCatalogForm = {
  nome: string;
  ativo: boolean;
  observacoes: string;
};

type LineFormState = BaseCatalogForm & {
  operadoraId: string;
};

type ProductFormState = {
  nome: string;
  linhaId: string;
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

type TableFormState = {
  produtoId: string;
  nome: string;
  codigo: string;
  modalidade: 'PF' | 'ADESAO' | 'PME';
  perfilEmpresarial: 'todos' | 'mei' | 'nao_mei';
  coparticipacao: 'sem' | 'parcial' | 'total';
  acomodacao: string;
  vidasMin: string;
  vidasMax: string;
  pricesByAgeRange: Record<CotadorAgeRange, string>;
  ativo: boolean;
  observacoes: string;
};

const tabs: Array<{ id: CatalogTabId; label: string }> = [
  { id: 'operadoras', label: 'Operadoras' },
  { id: 'linhas', label: 'Linhas' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'tabelas', label: 'Tabelas' },
  { id: 'administradoras', label: 'Administradoras' },
  { id: 'entidades', label: 'Entidades' },
];

const DEFAULT_BASE_FORM: BaseCatalogForm = {
  nome: '',
  ativo: true,
  observacoes: '',
};

const DEFAULT_LINE_FORM: LineFormState = {
  operadoraId: '',
  ...DEFAULT_BASE_FORM,
};

const DEFAULT_PRODUCT_FORM: ProductFormState = {
  nome: '',
  linhaId: '',
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

const createEmptyTablePrices = () =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    accumulator[range] = '';
    return accumulator;
  }, {} as Record<CotadorAgeRange, string>);

const DEFAULT_TABLE_FORM: TableFormState = {
  produtoId: '',
  nome: '',
  codigo: '',
  modalidade: 'PME',
  perfilEmpresarial: 'todos',
  coparticipacao: 'sem',
  acomodacao: '',
  vidasMin: '',
  vidasMax: '',
  pricesByAgeRange: createEmptyTablePrices(),
  ativo: true,
  observacoes: '',
};

const modalidadeOptions = [
  { value: 'PF', label: 'PF' },
  { value: 'ADESAO', label: 'Adesao' },
  { value: 'PME', label: 'PME' },
] as const;

const perfilEmpresarialOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'mei', label: 'MEI' },
  { value: 'nao_mei', label: 'Não MEI' },
] as const;

const coparticipacaoOptions = [
  { value: 'sem', label: 'Sem copart.' },
  { value: 'parcial', label: 'Copart. parcial' },
  { value: 'total', label: 'Copart. total' },
] as const;

const formatPerfilEmpresarial = (value: 'todos' | 'mei' | 'nao_mei') => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Não MEI';
  return 'Todos';
};

const formatCoparticipacao = (value: 'sem' | 'parcial' | 'total') => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  return 'Sem copart.';
};

const normalizeCodeToken = (value?: string | null, maxLength = 10) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, maxLength);

const buildCoparticipacaoCode = (value: TableFormState['coparticipacao']) => {
  if (value === 'parcial') return 'CPARC';
  if (value === 'total') return 'CTOT';
  return 'SEMCP';
};

const buildPerfilCode = (value: TableFormState['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'NMEI';
  return 'TODOS';
};

const buildLivesCode = (vidasMin: string, vidasMax: string) => {
  const min = vidasMin.trim() || '1';
  const max = vidasMax.trim() || 'MAX';
  return `${min}A${max}`;
};

function FeedbackBanner({ message }: { message: Message | null }) {
  if (!message) return null;

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
  const [activeTab, setActiveTab] = useState<CatalogTabId>('operadoras');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [administradoras, setAdministradoras] = useState<CotadorAdministradora[]>([]);
  const [entidades, setEntidades] = useState<CotadorEntidadeClasse[]>([]);
  const [linhas, setLinhas] = useState<CotadorLineManagerRecord[]>([]);
  const [produtos, setProdutos] = useState<CotadorProductManagerRecord[]>([]);
  const [tabelas, setTabelas] = useState<CotadorTableManagerRecord[]>([]);
  const [entityModalKind, setEntityModalKind] = useState<'administradoras' | 'entidades' | null>(null);
  const [entityEditingId, setEntityEditingId] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState<BaseCatalogForm>(DEFAULT_BASE_FORM);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineEditingId, setLineEditingId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState<LineFormState>(DEFAULT_LINE_FORM);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableEditingId, setTableEditingId] = useState<string | null>(null);
  const [tableForm, setTableForm] = useState<TableFormState>(DEFAULT_TABLE_FORM);
  const [tableCodeTouched, setTableCodeTouched] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    void loadCatalogData();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const lineOptions = useMemo(
    () => linhas.filter((line) => line.ativo).map((line) => ({ value: line.id, label: `${line.operadora?.nome ?? 'Operadora'} - ${line.nome}` })),
    [linhas],
  );

  const operadoraOptions = useMemo(
    () => operadoras.filter((operadora) => operadora.ativo).map((operadora) => ({ value: operadora.id, label: operadora.nome })),
    [operadoras],
  );

  const productOptions = useMemo(
    () => produtos.filter((product) => product.ativo).map((product) => ({ value: product.id, label: `${product.linha?.nome ?? 'Linha'} - ${product.nome}` })),
    [produtos],
  );

  const administradoraOptions = useMemo(
    () => administradoras.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [administradoras],
  );

  const entidadeOptions = useMemo(
    () => entidades.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [entidades],
  );

  const lineOperadoraById = useMemo(
    () => new Map(linhas.map((line) => [line.id, line.operadora?.id ?? ''])),
    [linhas],
  );

  const modalidadeProductOptions = useMemo(
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

  const selectedTableProduct = useMemo(
    () => produtos.find((product) => product.id === tableForm.produtoId) ?? null,
    [produtos, tableForm.produtoId],
  );

  const autoGeneratedTableCode = useMemo(() => {
    if (!selectedTableProduct) {
      return '';
    }

    const tokens = [
      normalizeCodeToken(selectedTableProduct.operadora?.nome, 6),
      normalizeCodeToken(selectedTableProduct.nome, 12),
      tableForm.modalidade,
      buildPerfilCode(tableForm.perfilEmpresarial),
      buildCoparticipacaoCode(tableForm.coparticipacao),
      tableForm.acomodacao ? normalizeCodeToken(tableForm.acomodacao, 6) : '',
      buildLivesCode(tableForm.vidasMin, tableForm.vidasMax),
    ].filter(Boolean);

    return tokens.join('-');
  }, [selectedTableProduct, tableForm.acomodacao, tableForm.coparticipacao, tableForm.modalidade, tableForm.perfilEmpresarial, tableForm.vidasMax, tableForm.vidasMin]);

  useEffect(() => {
    if (!tableModalOpen || tableCodeTouched) {
      return;
    }

    setTableForm((current) => {
      if (current.codigo === autoGeneratedTableCode) {
        return current;
      }

      return {
        ...current,
        codigo: autoGeneratedTableCode,
      };
    });
  }, [autoGeneratedTableCode, tableCodeTouched, tableModalOpen]);

  const showMessage = (type: Message['type'], text: string) => setMessage({ type, text });

  const loadCatalogData = async () => {
    setLoading(true);
    const [nextOperadoras, nextAdministradoras, nextEntidades, nextLinhas, nextProdutos, nextTabelas] = await Promise.all([
      configService.getOperadoras(),
      cotadorService.getAdministradoras(),
      cotadorService.getEntidadesClasse(),
      cotadorService.getLinhas(),
      cotadorService.getProdutos(),
      cotadorService.getTabelas(),
    ]);

    setOperadoras(nextOperadoras);
    setAdministradoras(nextAdministradoras);
    setEntidades(nextEntidades);
    setLinhas(nextLinhas);
    setProdutos(nextProdutos);
    setTabelas(nextTabelas);
    setLoading(false);
  };

  const resetEntityModal = () => {
    setEntityModalKind(null);
    setEntityEditingId(null);
    setEntityForm(DEFAULT_BASE_FORM);
  };

  const resetLineModal = () => {
    setLineModalOpen(false);
    setLineEditingId(null);
    setLineForm(DEFAULT_LINE_FORM);
  };

  const resetProductModal = () => {
    setProductModalOpen(false);
    setProductEditingId(null);
    setProductForm(DEFAULT_PRODUCT_FORM);
  };

  const resetTableModal = () => {
    setTableModalOpen(false);
    setTableEditingId(null);
    setTableForm(DEFAULT_TABLE_FORM);
    setTableCodeTouched(false);
  };

  const openEntityModal = (kind: 'administradoras' | 'entidades', item?: BaseCatalogForm & { id?: string }) => {
    setEntityModalKind(kind);
    setEntityEditingId(item?.id ?? null);
    setEntityForm({
      nome: item?.nome ?? '',
      ativo: item?.ativo ?? true,
      observacoes: item?.observacoes ?? '',
    });
  };

  const openLineModal = (line?: CotadorLineManagerRecord) => {
    setLineEditingId(line?.id ?? null);
    setLineForm({
      operadoraId: line?.operadora_id ?? '',
      nome: line?.nome ?? '',
      ativo: line?.ativo ?? true,
      observacoes: line?.observacoes ?? '',
    });
    setLineModalOpen(true);
  };

  const openProductModal = (product?: CotadorProductManagerRecord) => {
    setProductEditingId(product?.id ?? null);
    setProductForm({
      nome: product?.nome ?? '',
      linhaId: product?.linha_id ?? '',
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

  const openTableModal = (table?: CotadorTableManagerRecord) => {
    const priceFields = createEmptyTablePrices();
    COTADOR_AGE_RANGES.forEach((range) => {
      const value = table?.pricesByAgeRange[range];
      if (typeof value === 'number') {
        priceFields[range] = String(value);
      }
    });

    setTableEditingId(table?.id ?? null);
    setTableForm({
      produtoId: table?.produto_id ?? '',
      nome: table?.nome ?? '',
      codigo: table?.codigo ?? '',
      modalidade: table?.modalidade ?? 'PME',
      perfilEmpresarial: table?.perfil_empresarial ?? 'todos',
      coparticipacao: table?.coparticipacao ?? 'sem',
      acomodacao: table?.acomodacao ?? table?.produto?.acomodacao ?? '',
      vidasMin: table?.vidas_min ? String(table.vidas_min) : '',
      vidasMax: table?.vidas_max ? String(table.vidas_max) : '',
      pricesByAgeRange: priceFields,
      ativo: table?.ativo ?? true,
      observacoes: table?.observacoes ?? '',
    });
    setTableCodeTouched(Boolean(table?.codigo));
    setTableModalOpen(true);
  };

  const handleEntitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!entityModalKind) return;

    setSubmitting(true);
    const result = entityModalKind === 'administradoras'
      ? entityEditingId
        ? await cotadorService.updateAdministradora(entityEditingId, entityForm)
        : await cotadorService.createAdministradora(entityForm)
      : entityEditingId
        ? await cotadorService.updateEntidadeClasse(entityEditingId, entityForm)
        : await cotadorService.createEntidadeClasse(entityForm);

    if (result.error) {
      showMessage('error', 'Erro ao salvar item do catálogo.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Item salvo com sucesso.');
    setSubmitting(false);
    resetEntityModal();
  };

  const handleLineSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lineForm.operadoraId) {
      showMessage('error', 'Selecione a operadora da linha.');
      return;
    }

    setSubmitting(true);
    const payload = {
      operadora_id: lineForm.operadoraId,
      nome: lineForm.nome,
      ativo: lineForm.ativo,
      observacoes: lineForm.observacoes,
    };
    const result = lineEditingId
      ? await cotadorService.updateLinha(lineEditingId, payload)
      : await cotadorService.createLinha(payload);

    if (result.error) {
      showMessage('error', 'Erro ao salvar linha de produto.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Linha salva com sucesso.');
    setSubmitting(false);
    resetLineModal();
  };

  const handleProductSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!productForm.linhaId) {
      showMessage('error', 'Selecione a linha do produto.');
      return;
    }

    const operadoraId = lineOperadoraById.get(productForm.linhaId);
    if (!operadoraId) {
      showMessage('error', 'Não foi possivel resolver a operadora desta linha.');
      return;
    }

    const payload: CotadorProductManagerInput = {
      operadora_id: operadoraId,
      linha_id: productForm.linhaId,
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

  const handleTableSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tableForm.produtoId) {
      showMessage('error', 'Selecione o produto da tabela.');
      return;
    }

    const pricesByAgeRange = Object.entries(tableForm.pricesByAgeRange).reduce((accumulator, [range, value]) => {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        accumulator[range as CotadorAgeRange] = parsed;
      }
      return accumulator;
    }, {} as CotadorPriceRowInput);

    const payload: CotadorTableManagerInput = {
      produto_id: tableForm.produtoId,
      nome: tableForm.nome,
      codigo: tableForm.codigo || null,
      modalidade: tableForm.modalidade,
      perfil_empresarial: tableForm.perfilEmpresarial,
      coparticipacao: tableForm.coparticipacao,
      acomodacao: tableForm.acomodacao || null,
      vidas_min: tableForm.vidasMin ? Number.parseInt(tableForm.vidasMin, 10) : null,
      vidas_max: tableForm.vidasMax ? Number.parseInt(tableForm.vidasMax, 10) : null,
      observacoes: tableForm.observacoes,
      ativo: tableForm.ativo,
      pricesByAgeRange,
    };

    setSubmitting(true);
    const result = tableEditingId
      ? await cotadorService.updateTabela(tableEditingId, payload)
      : await cotadorService.createTabela(payload);

    if (result.error) {
      showMessage('error', 'Erro ao salvar tabela comercial.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Tabela salva com sucesso.');
    setSubmitting(false);
    resetTableModal();
  };

  const handleDelete = async (
    kind: 'administradoras' | 'entidades' | 'linhas' | 'produtos' | 'tabelas',
    id: string,
    title: string,
    description: string,
  ) => {
    const confirmed = await requestConfirmation({
      title,
      description,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result =
      kind === 'administradoras'
        ? await cotadorService.deleteAdministradora(id)
        : kind === 'entidades'
          ? await cotadorService.deleteEntidadeClasse(id)
          : kind === 'linhas'
            ? await cotadorService.deleteLinha(id)
            : kind === 'produtos'
              ? await cotadorService.deleteProduto(id)
              : await cotadorService.deleteTabela(id);

    if (result.error) {
      showMessage('error', 'Erro ao excluir item do catálogo.');
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Item removido com sucesso.');
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
              Catálogo do Cotador
            </div>
            <h3 className="text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Modele operadora, linha, produto e tabela do jeito que o mercado pede</h3>
            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              Exemplo real: operadora Amil, linhas diferentes, produtos como Bronze ou S750 e tabelas separadas por MEI, coparticipação e faixa de vidas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTab === 'linhas' && (
              <Button onClick={() => openLineModal()}>
                <Plus className="h-4 w-4" />
                Nova linha
              </Button>
            )}
            {activeTab === 'produtos' && (
              <Button onClick={() => openProductModal()}>
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            )}
            {activeTab === 'tabelas' && (
              <Button onClick={() => openTableModal()}>
                <Plus className="h-4 w-4" />
                Nova tabela
              </Button>
            )}
            {(activeTab === 'administradoras' || activeTab === 'entidades') && (
              <Button onClick={() => openEntityModal(activeTab, undefined)}>
                <Plus className="h-4 w-4" />
                {activeTab === 'administradoras' ? 'Nova administradora' : 'Nova entidade'}
              </Button>
            )}
          </div>
        </div>

        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} variant="panel" className="mt-6" />
      </div>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando catálogo do Cotador...</p>
        </div>
      ) : activeTab === 'operadoras' ? (
        <OperadorasTab embedded />
      ) : activeTab === 'administradoras' ? (
        administradoras.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhuma administradora cadastrada" description="Cadastre administradoras para suportar adesão e produtos com elegibilidade institucional." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {administradoras.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                    {item.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEntityModal('administradoras', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}><Edit2 className="h-4 w-4" />Editar</Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('administradoras', item.id, 'Excluir administradora', 'Essa ação remove a administradora do catálogo do Cotador.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : activeTab === 'entidades' ? (
        entidades.length === 0 ? (
          <EmptyState icon={Sparkles} title="Nenhuma entidade cadastrada" description="Cadastre entidades, sindicatos e associações para relacionar elegibilidade por produto." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {entidades.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                    {item.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEntityModal('entidades', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}><Edit2 className="h-4 w-4" />Editar</Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('entidades', item.id, 'Excluir entidade', 'Essa ação remove a entidade do catálogo do Cotador.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : activeTab === 'linhas' ? (
        linhas.length === 0 ? (
          <EmptyState icon={Network} title="Nenhuma linha cadastrada" description="Cadastre linhas como Amil, Selecionada ou outras famílias comerciais antes de cadastrar os produtos." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {linhas.map((line) => (
              <article key={line.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{line.nome}</h4>
                    <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Operadora: {line.operadora?.nome ?? 'Não encontrada'}</p>
                    {line.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{line.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openLineModal(line)}><Edit2 className="h-4 w-4" />Editar</Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('linhas', line.id, 'Excluir linha', 'Essa ação remove a linha e pode impactar os produtos vinculados.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : activeTab === 'produtos' ? (
        produtos.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum produto cadastrado" description="Cadastre produtos como Bronze, Ouro, S380 ou S750 R1 e depois crie as tabelas comerciais por perfil e vidas." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {produtos.map((product) => (
              <article key={product.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{product.nome}</h4>
                    <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{product.operadora?.nome ?? 'Operadora'} / {product.linha?.nome ?? 'Linha não definida'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                      {product.modalidade && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.modalidade}</span>}
                      {product.acomodacao && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">Base: {product.acomodacao}</span>}
                      {product.administradora?.nome && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.administradora.nome}</span>}
                      {product.entidadesClasse.length > 0 && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.entidadesClasse.length} entidade(s)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openProductModal(product)}><Edit2 className="h-4 w-4" />Editar</Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('produtos', product.id, 'Excluir produto', 'Essa ação remove o produto do catálogo do Cotador, mas snapshots de cotações permanecem preservados.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : tabelas.length === 0 ? (
        <EmptyState icon={Table2} title="Nenhuma tabela cadastrada" description="Crie tabelas por produto para separar MEI, não MEI, coparticipação, acomodação e faixas de vidas como 2 a 2, 3 a 5 ou 6 a 29." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tabelas.map((table) => (
            <article key={table.id} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{table.nome}</h4>
                  <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                    {table.produto?.operadora?.nome ?? 'Operadora'} / {table.produto?.linha?.nome ?? 'Linha'} / {table.produto?.nome ?? 'Produto'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{table.modalidade}</span>
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{formatPerfilEmpresarial(table.perfil_empresarial)}</span>
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{formatCoparticipacao(table.coparticipacao)}</span>
                    {table.acomodacao && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{table.acomodacao}</span>}
                    {(table.vidas_min || table.vidas_max) && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">Vidas: {table.vidas_min ?? 1} a {table.vidas_max ?? '...'}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => openTableModal(table)}><Edit2 className="h-4 w-4" />Editar</Button>
                  <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('tabelas', table.id, 'Excluir tabela', 'Essa ação remove a tabela comercial, mas snapshots já usados em cotações permanecem preservados.') }><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {COTADOR_AGE_RANGES.map((range) => (
                  <div key={range} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-2 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{range}</p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                      {typeof table.pricesByAgeRange[range] === 'number' ? `R$ ${table.pricesByAgeRange[range]?.toFixed(2)}` : '-'}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <ModalShell
        isOpen={entityModalKind !== null}
        onClose={resetEntityModal}
        title={entityEditingId ? 'Editar item institucional' : 'Novo item institucional'}
        description="Cadastre administradoras e entidades que compõem a elegibilidade e distribuição comercial do Cotador."
        size="md"
      >
        <form onSubmit={handleEntitySubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome *</label>
            <Input value={entityForm.nome} onChange={(event) => setEntityForm((current) => ({ ...current, nome: event.target.value }))} required />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={entityForm.ativo} onChange={(event) => setEntityForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Registro ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Mantém o registro disponível para uso no catálogo.</p>
            </div>
          </label>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={entityForm.observacoes} onChange={(event) => setEntityForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar</Button>
            <Button type="button" variant="secondary" onClick={resetEntityModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={lineModalOpen}
        onClose={resetLineModal}
        title={lineEditingId ? 'Editar linha de produto' : 'Nova linha de produto'}
        description="Cadastre linhas como Amil, Selecionada ou outras famílias comerciais da operadora."
        size="md"
      >
        <form onSubmit={handleLineSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Operadora *</label>
            <FilterSingleSelect icon={Building2} options={operadoraOptions} placeholder="Selecione a operadora" value={lineForm.operadoraId} onChange={(value) => setLineForm((current) => ({ ...current, operadoraId: value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome da linha *</label>
            <Input value={lineForm.nome} onChange={(event) => setLineForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex: Amil ou Selecionada" required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={lineForm.observacoes} onChange={(event) => setLineForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={lineForm.ativo} onChange={(event) => setLineForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Linha ativa</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Linhas inativas saem do cadastro de produtos e do seletor do Cotador.</p>
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar linha</Button>
            <Button type="button" variant="secondary" onClick={resetLineModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={productModalOpen}
        onClose={resetProductModal}
        title={productEditingId ? 'Editar produto do Cotador' : 'Novo produto do Cotador'}
        description="Cadastre produtos como Bronze, Ouro, Platinum, Black, S380, S450, S580 ou S750."
        size="lg"
      >
        <form onSubmit={handleProductSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Linha *</label>
              <FilterSingleSelect icon={Network} options={lineOptions} placeholder="Selecione a linha" value={productForm.linhaId} onChange={(value) => setProductForm((current) => ({ ...current, linhaId: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Administradora</label>
              <FilterSingleSelect icon={ShieldCheck} options={administradoraOptions} placeholder="Sem administradora" value={productForm.administradoraId} onChange={(value) => setProductForm((current) => ({ ...current, administradoraId: value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome do produto *</label>
              <Input value={productForm.nome} onChange={(event) => setProductForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex: Bronze, Bronze Mais, S750 R1" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Modalidade base</label>
              <FilterSingleSelect icon={Layers3} options={modalidadeProductOptions} placeholder="Selecione a modalidade" value={productForm.modalidade} onChange={(value) => setProductForm((current) => ({ ...current, modalidade: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Abrangência</label>
              <FilterSingleSelect icon={MapPin} options={abrangenciaOptions} placeholder="Selecione a abrangência" value={productForm.abrangencia} onChange={(value) => setProductForm((current) => ({ ...current, abrangencia: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Acomodação base (opcional)</label>
              <FilterSingleSelect icon={Sparkles} options={acomodacaoOptions} placeholder="Selecione a acomodação" value={productForm.acomodacao} onChange={(value) => setProductForm((current) => ({ ...current, acomodacao: value }))} />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use só quando a acomodação for padrão do produto. Se variar por tabela, configure isso na tabela comercial.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Comissão sugerida (%)</label>
              <Input type="number" step="0.01" min="0" value={productForm.comissaoSugerida} onChange={(event) => setProductForm((current) => ({ ...current, comissaoSugerida: Number.parseFloat(event.target.value) || 0 }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Bônus por vida (R$)</label>
              <Input type="number" step="0.01" min="0" value={productForm.bonusPorVidaValor} onChange={(event) => setProductForm((current) => ({ ...current, bonusPorVidaValor: Number.parseFloat(event.target.value) || 0 }))} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Entidades elegiveis</label>
            <MultiSelectDropdown options={entidadeOptions} values={productForm.entidadeIds} onChange={(values) => setProductForm((current) => ({ ...current, entidadeIds: values }))} placeholder="Vincule entidades quando o produto exigir elegibilidade" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={productForm.observacoes} onChange={(event) => setProductForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={productForm.ativo} onChange={(event) => setProductForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Produto ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Produtos inativos saem da criação de novas tabelas e do seletor.</p>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar produto</Button>
            <Button type="button" variant="secondary" onClick={resetProductModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={tableModalOpen}
        onClose={resetTableModal}
        title={tableEditingId ? 'Editar tabela comercial' : 'Nova tabela comercial'}
        description="Separe a tabela por modalidade, acomodação, perfil empresarial, coparticipação e faixa de vidas."
        size="xl"
      >
        <form onSubmit={handleTableSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Produto *</label>
              <FilterSingleSelect icon={Building2} options={productOptions} placeholder="Selecione o produto" value={tableForm.produtoId} onChange={(value) => setTableForm((current) => ({ ...current, produtoId: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome da tabela *</label>
              <Input value={tableForm.nome} onChange={(event) => setTableForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex: PME MEI Copart Total 2 a 2 vidas" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Codigo da tabela</label>
              <Input
                value={tableForm.codigo}
                onChange={(event) => {
                  setTableCodeTouched(true);
                  setTableForm((current) => ({ ...current, codigo: event.target.value }));
                }}
                placeholder="Gerado automaticamente"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                <span>{autoGeneratedTableCode ? `Sugestão: ${autoGeneratedTableCode}` : 'Escolha um produto para gerar o código.'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTableCodeTouched(false);
                    setTableForm((current) => ({ ...current, codigo: autoGeneratedTableCode }));
                  }}
                  className="font-semibold text-[var(--panel-accent-ink,#6f3f16)] transition-opacity hover:opacity-80"
                  disabled={!autoGeneratedTableCode}
                >
                  Usar código automático
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Modalidade *</label>
              <FilterSingleSelect icon={Layers3} options={[...modalidadeOptions]} placeholder="Selecione a modalidade" value={tableForm.modalidade} onChange={(value) => setTableForm((current) => ({ ...current, modalidade: value as TableFormState['modalidade'] }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Perfil empresarial (opcional)</label>
              <FilterSingleSelect icon={Network} options={[...perfilEmpresarialOptions]} placeholder="Selecione o perfil" value={tableForm.perfilEmpresarial} onChange={(value) => setTableForm((current) => ({ ...current, perfilEmpresarial: value as TableFormState['perfilEmpresarial'] }))} />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use `Todos` quando a operadora não separar MEI e não MEI nesta tabela.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Coparticipação</label>
              <FilterSingleSelect icon={Sparkles} options={[...coparticipacaoOptions]} placeholder="Selecione a coparticipação" value={tableForm.coparticipacao} onChange={(value) => setTableForm((current) => ({ ...current, coparticipacao: value as TableFormState['coparticipacao'] }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Acomodação da tabela</label>
              <FilterSingleSelect icon={Sparkles} options={acomodacaoOptions} placeholder="Selecione a acomodação" value={tableForm.acomodacao} onChange={(value) => setTableForm((current) => ({ ...current, acomodacao: value }))} />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use esta definição quando o mesmo produto tiver versões de enfermaria e apartamento.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Vidas min.</label>
              <Input type="number" min="1" value={tableForm.vidasMin} onChange={(event) => setTableForm((current) => ({ ...current, vidasMin: event.target.value }))} placeholder="Ex: 2" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Vidas max.</label>
              <Input type="number" min="1" value={tableForm.vidasMax} onChange={(event) => setTableForm((current) => ({ ...current, vidasMax: event.target.value }))} placeholder="Ex: 29" />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
              <Table2 className="h-4 w-4" />
              Precos por faixa etária
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {COTADOR_AGE_RANGES.map((range) => (
                <div key={range} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{range}</p>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tableForm.pricesByAgeRange[range]}
                    onChange={(event) =>
                      setTableForm((current) => ({
                        ...current,
                        pricesByAgeRange: {
                          ...current.pricesByAgeRange,
                          [range]: event.target.value,
                        },
                      }))
                    }
                    className="mt-2"
                    placeholder="0,00"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={tableForm.observacoes} onChange={(event) => setTableForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={tableForm.ativo} onChange={(event) => setTableForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Tabela ativa</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Tabelas inativas saem da vitrine do Cotador, mas continuam preservadas no histórico.</p>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar tabela</Button>
            <Button type="button" variant="secondary" onClick={resetTableModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      {ConfirmationDialog}
    </div>
  );
}
