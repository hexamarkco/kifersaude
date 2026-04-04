import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Calculator, FileStack, Plus, Settings2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import CotadorCatalogTab from '../../components/config/CotadorCatalogTab';
import { toast } from '../../lib/toast';
import CotadorCreateQuoteModal from './components/CotadorCreateQuoteModal';
import CotadorWorkspace from './components/CotadorWorkspace';
import { cotadorService } from './services/cotadorService';
import {
  calculateCotadorEstimatedMonthlyTotal,
  buildCotadorQuoteDraft,
  buildCotadorQuoteItemFromCatalogItem,
  catalogMatchesQuoteModality,
  formatCotadorDateTime,
  formatCotadorModality,
  saveCotadorQuotesToStorage,
  sortCotadorQuotesByRecent,
} from './shared/cotadorUtils';
import type {
  CotadorCatalogActor,
  CotadorCatalogFilters,
  CotadorCatalogItem,
  CotadorQuote,
  CotadorQuoteDraft,
  CotadorQuoteInput,
} from './shared/cotadorTypes';
import type { CotadorQuoteModality } from './shared/cotadorConstants';

const DEFAULT_FILTERS: CotadorCatalogFilters = {
  search: '',
  operadoraId: '',
  linhaId: '',
  administradoraId: '',
  entidadeId: '',
  perfilEmpresarial: '',
  coparticipacao: '',
  abrangencia: '',
  acomodacao: '',
  selectedOnly: false,
};

const createWizardState = (mode: 'create' | 'edit', draft: CotadorQuoteDraft) => ({
  isOpen: true,
  mode,
  draft,
});

const buildActorOptions = (actors: CotadorCatalogActor[]) =>
  Array.from(
    new Map(
      actors
        .filter((actor) => actor.name)
        .map((actor) => [actor.id, { value: actor.id, label: actor.name ?? actor.id }]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));

const matchesSearch = (item: CotadorCatalogItem, search: string) => {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const values = [
    item.titulo,
    item.subtitulo,
    item.linha?.name,
    item.tabelaNome,
    item.tabelaCodigo,
    item.operadora.name,
    item.administradora?.name,
    item.modalidade,
    item.perfilEmpresarial,
    item.coparticipacao,
    item.abrangencia,
    item.acomodacao,
    ...item.entidadesClasse.map((entity) => entity.name),
  ];

  return values.some((value) => (value ?? '').toLowerCase().includes(normalizedSearch));
};

const quoteContainsCatalogItem = (quote: CotadorQuote, catalogItemId: string) =>
  quote.selectedItems.some((item) => item.catalogItemKey === catalogItemId);

export default function CotadorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { quoteId } = useParams<{ quoteId?: string }>();
  const isConfigRoute = location.pathname.endsWith('/configuracoes');
  const isDetailRoute = Boolean(quoteId) && !isConfigRoute;

  const [catalogItems, setCatalogItems] = useState<CotadorCatalogItem[]>([]);
  const [quotes, setQuotes] = useState<CotadorQuote[]>([]);
  const [filters, setFilters] = useState<CotadorCatalogFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [wizardState, setWizardState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    draft: CotadorQuoteDraft;
  }>({
    isOpen: false,
    mode: 'create',
    draft: buildCotadorQuoteDraft(),
  });

  useEffect(() => {
    let active = true;

    const loadWorkspace = async () => {
      setLoading(true);
      const [nextCatalog, nextQuotes] = await Promise.all([
        cotadorService.loadCatalog(),
        cotadorService.getQuotes(),
      ]);

      if (!active) return;

      setCatalogItems(nextCatalog);
      setQuotes(nextQuotes);
      setLoading(false);
    };

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveCotadorQuotesToStorage(quotes);
  }, [quotes]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
  }, [quoteId]);

  const activeQuote = useMemo(
    () => (quoteId ? quotes.find((quote) => quote.id === quoteId) ?? null : null),
    [quoteId, quotes],
  );

  const quoteCatalog = useMemo(() => {
    if (!activeQuote) return [];

    return catalogItems
      .filter((item) => catalogMatchesQuoteModality(item.modalidade, activeQuote.modality))
      .map((item) => ({
        ...item,
        estimatedMonthlyTotal: calculateCotadorEstimatedMonthlyTotal(activeQuote.ageDistribution, item.pricesByAgeRange),
      }));
  }, [activeQuote, catalogItems]);

  const filteredItems = useMemo(() => {
    if (!activeQuote) return [];

    return quoteCatalog.filter((item) => {
      if (filters.selectedOnly && !quoteContainsCatalogItem(activeQuote, item.id)) return false;
      if (filters.operadoraId && item.operadora.id !== filters.operadoraId) return false;
      if (filters.linhaId && item.linha?.id !== filters.linhaId) return false;
      if (filters.administradoraId && item.administradora?.id !== filters.administradoraId) return false;
      if (filters.entidadeId && !item.entidadesClasse.some((entity) => entity.id === filters.entidadeId)) return false;
      if (filters.perfilEmpresarial && item.perfilEmpresarial !== filters.perfilEmpresarial) return false;
      if (filters.coparticipacao && item.coparticipacao !== filters.coparticipacao) return false;
      if (filters.abrangencia && item.abrangencia !== filters.abrangencia) return false;
      if (filters.acomodacao && item.acomodacao !== filters.acomodacao) return false;
      if (item.vidasMin !== null && activeQuote.totalLives < item.vidasMin) return false;
      if (item.vidasMax !== null && activeQuote.totalLives > item.vidasMax) return false;

      return matchesSearch(item, filters.search);
    });
  }, [activeQuote, filters, quoteCatalog]);

  const getOptionScopedItems = (target: keyof CotadorCatalogFilters) => {
    if (!activeQuote) return [] as CotadorCatalogItem[];

    return quoteCatalog.filter((item) => {
      if (target !== 'selectedOnly' && filters.selectedOnly && !quoteContainsCatalogItem(activeQuote, item.id)) return false;
      if (target !== 'operadoraId' && filters.operadoraId && item.operadora.id !== filters.operadoraId) return false;
      if (target !== 'linhaId' && filters.linhaId && item.linha?.id !== filters.linhaId) return false;
      if (target !== 'administradoraId' && filters.administradoraId && item.administradora?.id !== filters.administradoraId) return false;
      if (target !== 'entidadeId' && filters.entidadeId && !item.entidadesClasse.some((entity) => entity.id === filters.entidadeId)) return false;
      if (target !== 'perfilEmpresarial' && filters.perfilEmpresarial && item.perfilEmpresarial !== filters.perfilEmpresarial) return false;
      if (target !== 'coparticipacao' && filters.coparticipacao && item.coparticipacao !== filters.coparticipacao) return false;
      if (target !== 'abrangencia' && filters.abrangencia && item.abrangencia !== filters.abrangencia) return false;
      if (target !== 'acomodacao' && filters.acomodacao && item.acomodacao !== filters.acomodacao) return false;
      if (item.vidasMin !== null && activeQuote.totalLives < item.vidasMin) return false;
      if (item.vidasMax !== null && activeQuote.totalLives > item.vidasMax) return false;
      if (target !== 'search' && !matchesSearch(item, filters.search)) return false;
      return true;
    });
  };

  const filterOptions = useMemo(
    () => ({
      operadoras: buildActorOptions(getOptionScopedItems('operadoraId').map((item) => item.operadora)),
      linhas: buildActorOptions(
        getOptionScopedItems('linhaId').map((item) => item.linha).filter((actor): actor is CotadorCatalogActor => actor !== null),
      ),
      administradoras: buildActorOptions(
        getOptionScopedItems('administradoraId').map((item) => item.administradora).filter((actor): actor is CotadorCatalogActor => actor !== null),
      ),
      entidades: buildActorOptions(getOptionScopedItems('entidadeId').flatMap((item) => item.entidadesClasse)),
      perfisEmpresariais: Array.from(
        new Set(getOptionScopedItems('perfilEmpresarial').map((item) => item.perfilEmpresarial).filter((value): value is 'todos' | 'mei' | 'nao_mei' => Boolean(value))),
      ).map((value) => ({ value, label: value === 'mei' ? 'MEI' : value === 'nao_mei' ? 'Não MEI' : 'Todos' })),
      coparticipacoes: Array.from(
        new Set(getOptionScopedItems('coparticipacao').map((item) => item.coparticipacao).filter((value): value is 'sem' | 'parcial' | 'total' => Boolean(value))),
      ).map((value) => ({
        value,
        label: value === 'parcial' ? 'Copart. parcial' : value === 'total' ? 'Copart. total' : 'Sem copart.',
      })),
      abrangencias: Array.from(
        new Set(getOptionScopedItems('abrangencia').map((item) => item.abrangencia).filter((value): value is string => Boolean(value))),
      )
        .sort((left, right) => left.localeCompare(right, 'pt-BR'))
        .map((value) => ({ value, label: value })),
      acomodacoes: Array.from(
        new Set(getOptionScopedItems('acomodacao').map((item) => item.acomodacao).filter((value): value is string => Boolean(value))),
      )
        .sort((left, right) => left.localeCompare(right, 'pt-BR'))
        .map((value) => ({ value, label: value })),
    }),
    [activeQuote, filters, quoteCatalog],
  );

  const hasDetailedProducts = useMemo(
    () => catalogItems.some((item) => item.source === 'cotador_tabela' || item.source === 'cotador_produto' || item.source === 'legacy_produto'),
    [catalogItems],
  );

  const refreshSelectedItems = (quoteBase: CotadorQuote, sourceItems: CotadorQuote['selectedItems']) =>
    sourceItems
      .map((item) => {
        const matchingCatalogItem = catalogItems.find((catalogItem) => catalogItem.id === item.catalogItemKey);
        if (matchingCatalogItem) {
          return buildCotadorQuoteItemFromCatalogItem({
            ...matchingCatalogItem,
            estimatedMonthlyTotal: calculateCotadorEstimatedMonthlyTotal(quoteBase.ageDistribution, matchingCatalogItem.pricesByAgeRange),
          });
        }

        return {
          ...item,
          estimatedMonthlyTotal: calculateCotadorEstimatedMonthlyTotal(quoteBase.ageDistribution, item.pricesByAgeRange),
        };
      })
      .filter((item) => {
        if (!catalogMatchesQuoteModality(item.modalidade, quoteBase.modality)) return false;
        if (item.vidasMin !== null && quoteBase.totalLives < item.vidasMin) return false;
        if (item.vidasMax !== null && quoteBase.totalLives > item.vidasMax) return false;
        return true;
      });

  const openCreateQuote = () => setWizardState(createWizardState('create', buildCotadorQuoteDraft()));

  const openEditQuote = () => {
    if (!activeQuote) return;
    setWizardState(createWizardState('edit', buildCotadorQuoteDraft(activeQuote)));
  };

  const handleWizardSubmit = async (input: CotadorQuoteInput) => {
    setWizardBusy(true);

    if (wizardState.mode === 'create') {
      const { data, error } = await cotadorService.createQuote(input);
      if (error || !data) {
        toast.error('Não foi possível criar a cotação agora.');
        setWizardBusy(false);
        return;
      }

      setQuotes((current) => sortCotadorQuotesByRecent([data, ...current]));
      setWizardState((current) => ({ ...current, isOpen: false }));
      toast.success('Cotação criada com sucesso.');
      setWizardBusy(false);
      navigate(`/painel/cotador/${data.id}`);
      return;
    }

    if (!activeQuote) {
      setWizardBusy(false);
      return;
    }

    const { data, error } = await cotadorService.updateQuote(activeQuote, input);
    if (error || !data) {
      toast.error('Não foi possível atualizar a cotação agora.');
      setWizardBusy(false);
      return;
    }

    const nextSelectedItems = refreshSelectedItems(data, activeQuote.selectedItems);
    const selectionResult = await cotadorService.saveQuoteSelection(activeQuote.id, nextSelectedItems);
    if (selectionResult.error) {
      toast.error('A cotação foi atualizada, mas a shortlist não conseguiu ser sincronizada.');
      setWizardBusy(false);
      return;
    }

    const nextQuote: CotadorQuote = {
      ...data,
      selectedItems: nextSelectedItems,
    };

    setQuotes((current) => sortCotadorQuotesByRecent(current.map((quote) => (quote.id === nextQuote.id ? nextQuote : quote))));
    setWizardState((current) => ({ ...current, isOpen: false }));
    toast.success('Cotação atualizada com sucesso.');
    setWizardBusy(false);
  };

  const handleToggleCatalogItem = async (itemId: string) => {
    if (!activeQuote || selectionBusy) return;

    const catalogItem = quoteCatalog.find((item) => item.id === itemId);
    if (!catalogItem) return;

    const alreadySelected = activeQuote.selectedItems.some((item) => item.catalogItemKey === itemId);
    const nextSelectedItems = alreadySelected
      ? activeQuote.selectedItems.filter((item) => item.catalogItemKey !== itemId)
      : [...activeQuote.selectedItems, buildCotadorQuoteItemFromCatalogItem(catalogItem)];

    setSelectionBusy(true);
    const { error } = await cotadorService.saveQuoteSelection(activeQuote.id, nextSelectedItems);
    if (error) {
      toast.error('Não foi possível atualizar a shortlist.');
      setSelectionBusy(false);
      return;
    }

    setQuotes((current) =>
      sortCotadorQuotesByRecent(
        current.map((quote) =>
          quote.id === activeQuote.id
            ? {
                ...quote,
                selectedItems: nextSelectedItems,
                updatedAt: new Date().toISOString(),
              }
            : quote,
        ),
      ),
    );
    setSelectionBusy(false);
  };

  const handleQuoteModalityChange = async (modality: CotadorQuoteModality) => {
    if (!activeQuote || activeQuote.modality === modality || selectionBusy) return;

    setSelectionBusy(true);
    const { data, error } = await cotadorService.updateQuote(activeQuote, {
      name: activeQuote.name,
      modality,
      ageDistribution: activeQuote.ageDistribution,
    });

    if (error || !data) {
      toast.error('Não foi possível trocar o tipo da cotação.');
      setSelectionBusy(false);
      return;
    }

    const nextSelectedItems = refreshSelectedItems(data, activeQuote.selectedItems);
    const selectionResult = await cotadorService.saveQuoteSelection(activeQuote.id, nextSelectedItems);
    if (selectionResult.error) {
      toast.error('O tipo foi alterado, mas a shortlist não foi atualizada.');
      setSelectionBusy(false);
      return;
    }

    setQuotes((current) =>
      sortCotadorQuotesByRecent(
        current.map((quote) =>
          quote.id === activeQuote.id
            ? {
                ...data,
                selectedItems: nextSelectedItems,
              }
            : quote,
        ),
      ),
    );
    setSelectionBusy(false);
  };

  const renderListScreen = () => (
    <div className="panel-page-shell space-y-6">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.96)_48%,rgba(247,240,231,0.99)_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Calculator className="h-3.5 w-3.5" />
              Cotador
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)] md:text-4xl">Cotações salvas</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/painel/cotador/configuracoes')}>
              <Settings2 className="h-4 w-4" />
              Configurar catálogo
            </Button>
            <Button onClick={openCreateQuote}>
              <Plus className="h-4 w-4" />
              Criar nova cotação
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando cotações...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <FileStack className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
          <h2 className="mt-4 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Nenhuma cotação salva ainda</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/painel/cotador/configuracoes')}>
              Configurar catálogo
            </Button>
            <Button onClick={openCreateQuote}>
              <Plus className="h-4 w-4" />
              Criar primeira cotação
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {quotes.map((quote) => (
            <button
              key={quote.id}
              type="button"
              onClick={() => navigate(`/painel/cotador/${quote.id}`)}
              className="cursor-pointer rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:rgba(255,253,250,0.98)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">{formatCotadorModality(quote.modality)}</p>
                  <h2 className="mt-3 truncate text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</h2>
                </div>
                <span className="rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(246,228,199,0.6)] px-3 py-1 text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)]">
                  {quote.totalLives} vidas
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Faixas</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{Object.values(quote.ageDistribution).filter((value) => value > 0).length} preenchidas</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Shortlist</p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.selectedItems.length} plano(s)</p>
                </div>
              </div>

              <p className="mt-5 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Atualizada em {formatCotadorDateTime(quote.updatedAt)}</p>
            </button>
          ))}
        </section>
      )}
    </div>
  );

  const renderConfigScreen = () => (
    <div className="panel-page-shell space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => navigate('/painel/cotador')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para cotações
        </Button>
        <Button onClick={openCreateQuote}>
          <Plus className="h-4 w-4" />
          Nova cotação
        </Button>
      </div>

      <CotadorCatalogTab />
    </div>
  );

  const renderDetailScreen = () => {
    if (loading) {
      return (
        <div className="panel-page-shell">
          <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
            <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando cotação...</p>
          </div>
        </div>
      );
    }

    if (!activeQuote) {
      return (
        <div className="panel-page-shell space-y-6">
          <Button variant="secondary" onClick={() => navigate('/painel/cotador')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para cotações
          </Button>
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h2 className="mt-4 text-2xl font-semibold text-red-900">Cotação não encontrada</h2>
            <p className="mt-2 text-sm text-red-700">Essa cotação pode ter sido removida ou ainda não foi carregada no módulo.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="panel-page-shell space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/painel/cotador')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para cotações
          </Button>
          <Button variant="secondary" onClick={() => navigate('/painel/cotador/configuracoes')}>
            <Settings2 className="h-4 w-4" />
            Configurar catálogo
          </Button>
        </div>

        <CotadorWorkspace
          quote={activeQuote}
          catalogItems={quoteCatalog}
          filteredItems={filteredItems}
          selectedItems={activeQuote.selectedItems}
          filterOptions={filterOptions}
          filters={filters}
          hasDetailedProducts={hasDetailedProducts}
          busy={selectionBusy}
          onUpdateFilters={(updates) => setFilters((current) => ({ ...current, ...updates }))}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          onToggleCatalogItem={(itemId) => {
            void handleToggleCatalogItem(itemId);
          }}
          onCreateQuote={openCreateQuote}
          onEditQuote={openEditQuote}
          onOpenConfig={() => navigate('/painel/cotador/configuracoes')}
          onChangeQuoteModality={(modality) => {
            void handleQuoteModalityChange(modality);
          }}
        />
      </div>
    );
  };

  return (
    <>
      {isConfigRoute ? renderConfigScreen() : isDetailRoute ? renderDetailScreen() : renderListScreen()}

      <CotadorCreateQuoteModal
        isOpen={wizardState.isOpen}
        mode={wizardState.mode}
        initialDraft={wizardState.draft}
        onClose={() => setWizardState((current) => ({ ...current, isOpen: false }))}
        onSubmit={(input) => {
          void handleWizardSubmit(input);
        }}
        busy={wizardBusy}
      />
    </>
  );
}
