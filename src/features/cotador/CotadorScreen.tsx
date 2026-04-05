import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Calculator, FileStack, Plus, Settings2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import CotadorCatalogTab from '../../components/config/CotadorCatalogTab';
import { fetchAllPages, supabase, type Lead } from '../../lib/supabase';
import { toast } from '../../lib/toast';
import CotadorCreateQuoteModal from './components/CotadorCreateQuoteModal';
import CotadorPlanDetailsPage from './components/CotadorPlanDetailsPage';
import CotadorWorkspace from './components/CotadorWorkspace';
import { cotadorService } from './services/cotadorService';
import {
  calculateCotadorEstimatedMonthlyTotal,
  buildCotadorQuoteDraft,
  buildCotadorQuoteItemFromCatalogItem,
  formatCotadorDateTime,
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

const buildCountedOptions = (values: string[], formatLabel?: (value: string) => string) => {
  const counts = new Map<string, number>();

  values.filter(Boolean).forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((left, right) => left[0].localeCompare(right[0], 'pt-BR'))
    .map(([value, count]) => ({
      value,
      label: `${formatLabel ? formatLabel(value) : value} (${count})`,
    }));
};

const buildCountedActorOptions = (actors: CotadorCatalogActor[]) => {
  const counts = new Map<string, { actor: CotadorCatalogActor; count: number }>();

  actors.filter((actor) => actor.name).forEach((actor) => {
    const current = counts.get(actor.id);
    if (current) {
      current.count += 1;
      return;
    }

    counts.set(actor.id, { actor, count: 1 });
  });

  return Array.from(counts.values())
    .sort((left, right) => (left.actor.name ?? '').localeCompare(right.actor.name ?? '', 'pt-BR'))
    .map(({ actor, count }) => ({
      value: actor.id,
      label: `${actor.name ?? actor.id} (${count})`,
    }));
};

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
  const { quoteId, catalogItemKey } = useParams<{ quoteId?: string; catalogItemKey?: string }>();
  const isConfigRoute = location.pathname.endsWith('/configuracoes');
  const isPlanDetailsRoute = Boolean(quoteId && catalogItemKey) && !isConfigRoute;
  const isDetailRoute = Boolean(quoteId) && !isConfigRoute && !catalogItemKey;

  const [catalogItems, setCatalogItems] = useState<CotadorCatalogItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<CotadorQuote[]>([]);
  const [filters, setFilters] = useState<CotadorCatalogFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [wizardBusy, setWizardBusy] = useState(false);
  const [wizardState, setWizardState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    draft: CotadorQuoteDraft;
  }>({
    isOpen: false,
    mode: 'create',
    draft: buildCotadorQuoteDraft(),
  });
  const selectionSyncingRef = useRef(false);
  const pendingSelectionRef = useRef<{ quoteId: string; items: CotadorQuote['selectedItems'] } | null>(null);

  useEffect(() => {
    let active = true;

    const loadWorkspace = async () => {
      setLoading(true);
      const [nextCatalog, nextQuotes, nextLeads] = await Promise.all([
        cotadorService.loadCatalog(),
        cotadorService.getQuotes(),
        fetchAllPages<Lead>(async (from, to) => {
          const response = await supabase
            .from('leads')
            .select('*')
            .eq('arquivado', false)
            .order('nome_completo')
            .range(from, to);

          return { data: response.data as Lead[] | null, error: response.error };
        }),
      ]);

      if (!active) return;

      setCatalogItems(nextCatalog);
      setLeads(nextLeads);
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

  const activePlanCatalogKey = useMemo(
    () => (catalogItemKey ? decodeURIComponent(catalogItemKey) : null),
    [catalogItemKey],
  );

  const activePlan = useMemo(
    () => (activeQuote && activePlanCatalogKey ? activeQuote.selectedItems.find((item) => item.catalogItemKey === activePlanCatalogKey) ?? null : null),
    [activePlanCatalogKey, activeQuote],
  );

  const leadOptions = useMemo(
    () => leads.map((lead) => ({
      value: lead.id,
      label: [lead.nome_completo, lead.telefone || null, lead.email || null].filter(Boolean).join(' | '),
    })),
    [leads],
  );

  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);

  const activeQuoteLeadLabel = useMemo(() => {
    if (!activeQuote?.leadId) return 'Nao vinculado';
    const lead = leadById.get(activeQuote.leadId);
    if (!lead) return 'Lead vinculado';
    return lead.nome_completo;
  }, [activeQuote?.leadId, leadById]);

  const quoteCatalog = useMemo(() => {
    if (!activeQuote) return [];

    return catalogItems
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
      operadoras: buildCountedActorOptions(getOptionScopedItems('operadoraId').map((item) => item.operadora)),
      linhas: buildCountedActorOptions(
        getOptionScopedItems('linhaId').map((item) => item.linha).filter((actor): actor is CotadorCatalogActor => actor !== null),
      ),
      administradoras: buildCountedActorOptions(
        getOptionScopedItems('administradoraId').map((item) => item.administradora).filter((actor): actor is CotadorCatalogActor => actor !== null),
      ),
      entidades: buildCountedActorOptions(getOptionScopedItems('entidadeId').flatMap((item) => item.entidadesClasse)),
      perfisEmpresariais: buildCountedOptions(
        getOptionScopedItems('perfilEmpresarial')
          .map((item) => item.perfilEmpresarial)
          .filter((value): value is 'todos' | 'mei' | 'nao_mei' => Boolean(value)),
        (value) => (value === 'mei' ? 'MEI' : value === 'nao_mei' ? 'Não MEI' : 'Todos'),
      ),
      coparticipacoes: buildCountedOptions(
        getOptionScopedItems('coparticipacao')
          .map((item) => item.coparticipacao)
          .filter((value): value is 'sem' | 'parcial' | 'total' => Boolean(value)),
        (value) => (value === 'parcial' ? 'Copart. parcial' : value === 'total' ? 'Copart. total' : 'Sem copart.'),
      ),
      abrangencias: buildCountedOptions(
        getOptionScopedItems('abrangencia')
          .map((item) => item.abrangencia)
          .filter((value): value is string => Boolean(value)),
      ),
      acomodacoes: buildCountedOptions(
        getOptionScopedItems('acomodacao')
          .map((item) => item.acomodacao)
          .filter((value): value is string => Boolean(value)),
      ),
    }),
    [activeQuote, filters, quoteCatalog],
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
        if (item.vidasMin !== null && quoteBase.totalLives < item.vidasMin) return false;
        if (item.vidasMax !== null && quoteBase.totalLives > item.vidasMax) return false;
        return true;
      });

  const flushPendingSelection = async () => {
    if (selectionSyncingRef.current) return;

    selectionSyncingRef.current = true;
    try {
      while (pendingSelectionRef.current) {
        const pending = pendingSelectionRef.current;
        pendingSelectionRef.current = null;

        const { error } = await cotadorService.saveQuoteSelection(pending.quoteId, pending.items);
        if (error) {
          toast.error('Não foi possível sincronizar a shortlist. Recarregando os planos da cotação.');
          const refreshedQuotes = await cotadorService.getQuotes();
          setQuotes(refreshedQuotes);
          pendingSelectionRef.current = null;
          break;
        }
      }
    } finally {
      selectionSyncingRef.current = false;
    }
  };

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
    if (!activeQuote) return;

    const catalogItem = quoteCatalog.find((item) => item.id === itemId);
    if (!catalogItem) return;

    const alreadySelected = activeQuote.selectedItems.some((item) => item.catalogItemKey === itemId);
    const nextSelectedItems = alreadySelected
      ? activeQuote.selectedItems.filter((item) => item.catalogItemKey !== itemId)
      : [...activeQuote.selectedItems, buildCotadorQuoteItemFromCatalogItem(catalogItem)];

    const optimisticUpdatedAt = new Date().toISOString();
    setQuotes((current) =>
      sortCotadorQuotesByRecent(
        current.map((quote) =>
          quote.id === activeQuote.id
            ? {
                ...quote,
                selectedItems: nextSelectedItems,
                updatedAt: optimisticUpdatedAt,
              }
            : quote,
        ),
      ),
    );

    pendingSelectionRef.current = {
      quoteId: activeQuote.id,
      items: nextSelectedItems,
    };

    void flushPendingSelection();
  };

  const renderListScreen = () => (
    <div className="panel-page-shell space-y-6">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.96)_48%,rgba(247,240,231,0.99)_100%)] p-6 shadow-sm md:p-8 dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[radial-gradient(circle_at_top_left,rgba(133,77,14,0.24),rgba(28,20,14,0.96)_40%,rgba(20,15,11,0.99)_100%)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(251,191,36,0.18)] dark:bg-[color:rgba(251,191,36,0.12)] dark:text-[color:#fde68a]">
              <Calculator className="h-3.5 w-3.5" />
              Cotador
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)] md:text-4xl dark:text-[color:#fff8ef]">Cotações salvas</h1>
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
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.76)]">Carregando cotações...</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <FileStack className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.66)]" />
          <h2 className="mt-4 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">Nenhuma cotação salva ainda</h2>
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
        <section className="overflow-hidden rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="grid grid-cols-[minmax(0,1fr)_140px_180px_180px] gap-4 border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)] dark:border-[color:rgba(255,255,255,0.08)] dark:text-[color:rgba(255,243,209,0.62)]">
            <span>Cotação</span>
            <span>Vidas</span>
            <span>Criada em</span>
            <span>Atualizada em</span>
          </div>

          <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)] dark:divide-[color:rgba(255,255,255,0.08)]">
            {quotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                onClick={() => navigate(`/painel/cotador/${quote.id}`)}
                className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_140px_180px_180px] gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--panel-surface-soft,#f4ede3)] dark:hover:bg-[color:rgba(255,255,255,0.05)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{quote.name}</p>
                </div>
                <div>
                  <span className="inline-flex rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(246,228,199,0.6)] px-3 py-1 text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(251,191,36,0.18)] dark:bg-[color:rgba(251,191,36,0.12)] dark:text-[color:#fde68a]">
                    {quote.totalLives} vidas
                  </span>
                </div>
                <div className="text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.76)]">
                  {formatCotadorDateTime(quote.createdAt)}
                </div>
                <div className="text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.76)]">
                  {formatCotadorDateTime(quote.updatedAt)}
                </div>
              </button>
            ))}
          </div>
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
        </div>

        <CotadorWorkspace
          quote={activeQuote}
          linkedLeadLabel={activeQuoteLeadLabel}
          catalogItems={quoteCatalog}
          filteredItems={filteredItems}
          selectedItems={activeQuote.selectedItems}
          filterOptions={filterOptions}
          filters={filters}
          onUpdateFilters={(updates) => setFilters((current) => ({ ...current, ...updates }))}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          onToggleCatalogItem={(itemId) => {
            void handleToggleCatalogItem(itemId);
          }}
          onOpenPlanDetails={(itemKey) => navigate(`/painel/cotador/${activeQuote.id}/plano/${encodeURIComponent(itemKey)}`)}
          onEditQuote={openEditQuote}
        />
      </div>
    );
  };

  const renderPlanDetailsScreen = () => {
    if (loading) {
      return renderDetailScreen();
    }

    if (!activeQuote || !activePlan) {
      return (
        <div className="panel-page-shell space-y-6">
          <Button variant="secondary" onClick={() => navigate(quoteId ? `/painel/cotador/${quoteId}` : '/painel/cotador')}>
            <ArrowLeft className="h-4 w-4" />
            Voltar para a cotação
          </Button>
          <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h2 className="mt-4 text-2xl font-semibold text-red-900">Plano não encontrado</h2>
            <p className="mt-2 text-sm text-red-700">Esse plano pode ter sido removido da cotação ou ainda não foi sincronizado.</p>
          </div>
        </div>
      );
    }

    return (
      <CotadorPlanDetailsPage
        quote={activeQuote}
        item={activePlan}
        onBack={() => navigate(`/painel/cotador/${activeQuote.id}`)}
      />
    );
  };

  return (
    <>
      {isConfigRoute ? renderConfigScreen() : isPlanDetailsRoute ? renderPlanDetailsScreen() : isDetailRoute ? renderDetailScreen() : renderListScreen()}

      <CotadorCreateQuoteModal
        isOpen={wizardState.isOpen}
        mode={wizardState.mode}
        initialDraft={wizardState.draft}
        leadOptions={leadOptions}
        onClose={() => setWizardState((current) => ({ ...current, isOpen: false }))}
        onSubmit={(input) => {
          void handleWizardSubmit(input);
        }}
        busy={wizardBusy}
      />
    </>
  );
}
