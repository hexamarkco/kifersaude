import { useEffect, useMemo, useState } from 'react';
import { Calculator, Clock3, Plus, Sparkles, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import { cx } from '../../lib/cx';
import CotadorCreateQuoteModal from './components/CotadorCreateQuoteModal';
import CotadorWorkspace from './components/CotadorWorkspace';
import { loadCotadorCatalog } from './services/cotadorCatalogService';
import { buildCotadorQuoteDraft, catalogMatchesQuoteModality, createCotadorQuote, formatCotadorDateTime, formatCotadorModality, loadCotadorQuotesFromStorage, matchesCotadorSearch, saveCotadorQuotesToStorage, sortCotadorQuotesByRecent, updateCotadorQuote } from './shared/cotadorUtils';
import type { CotadorCatalogFilters, CotadorCatalogItem, CotadorQuote, CotadorQuoteDraft, CotadorQuoteInput } from './shared/cotadorTypes';

const DEFAULT_FILTERS: CotadorCatalogFilters = {
  search: '',
  operadoraId: '',
  abrangencia: '',
  acomodacao: '',
  selectedOnly: false,
};

const buildSelectOptions = (values: Array<string | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))
    .map((value) => ({ value, label: value }));

const createWizardState = (mode: 'create' | 'edit', draft: CotadorQuoteDraft) => ({
  isOpen: true,
  mode,
  draft,
});

export default function CotadorScreen() {
  const [catalogItems, setCatalogItems] = useState<CotadorCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [quotes, setQuotes] = useState<CotadorQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CotadorCatalogFilters>(DEFAULT_FILTERS);
  const [storageReady, setStorageReady] = useState(false);
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
    const storedQuotes = loadCotadorQuotesFromStorage();
    setQuotes(storedQuotes);
    setActiveQuoteId(storedQuotes[0]?.id ?? null);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    saveCotadorQuotesToStorage(quotes);
  }, [quotes, storageReady]);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      const nextCatalog = await loadCotadorCatalog();

      if (!active) {
        return;
      }

      setCatalogItems(nextCatalog);
      setCatalogLoading(false);
    };

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (quotes.length === 0) {
      if (activeQuoteId !== null) {
        setActiveQuoteId(null);
      }
      return;
    }

    if (!activeQuoteId || !quotes.some((quote) => quote.id === activeQuoteId)) {
      setActiveQuoteId(quotes[0].id);
    }
  }, [activeQuoteId, quotes]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
  }, [activeQuoteId]);

  const activeQuote = useMemo(
    () => quotes.find((quote) => quote.id === activeQuoteId) ?? null,
    [activeQuoteId, quotes],
  );

  const quoteCatalog = useMemo(() => {
    if (!activeQuote) {
      return [];
    }

    return catalogItems.filter((item) => catalogMatchesQuoteModality(item.modalidade, activeQuote.modality));
  }, [activeQuote, catalogItems]);

  const selectedItems = useMemo(() => {
    if (!activeQuote) {
      return [];
    }

    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    return activeQuote.selectedCatalogItemIds
      .map((itemId) => catalogById.get(itemId) ?? null)
      .filter((item): item is CotadorCatalogItem => item !== null);
  }, [activeQuote, catalogItems]);

  const filteredItems = useMemo(() => {
    if (!activeQuote) {
      return [];
    }

    return quoteCatalog.filter((item) => {
      if (filters.selectedOnly && !activeQuote.selectedCatalogItemIds.includes(item.id)) {
        return false;
      }

      if (filters.operadoraId && item.operadora.id !== filters.operadoraId) {
        return false;
      }

      if (filters.abrangencia && item.abrangencia !== filters.abrangencia) {
        return false;
      }

      if (filters.acomodacao && item.acomodacao !== filters.acomodacao) {
        return false;
      }

      return matchesCotadorSearch(filters.search, [
        item.titulo,
        item.subtitulo,
        item.operadora.name,
        item.modalidade,
        item.abrangencia,
        item.acomodacao,
        item.administradora?.name,
        item.entidadeClasse?.name,
      ]);
    });
  }, [activeQuote, filters, quoteCatalog]);

  const hasDetailedProducts = useMemo(() => catalogItems.some((item) => item.source === 'produto'), [catalogItems]);

  const filterOptions = useMemo(
    () => ({
      operadoras: buildSelectOptions(quoteCatalog.map((item) => item.operadora.name ?? null)).map((option) => {
        const matchingItem = quoteCatalog.find((item) => item.operadora.name === option.value);
        return {
          value: matchingItem?.operadora.id ?? option.value,
          label: option.label,
        };
      }),
      abrangencias: buildSelectOptions(quoteCatalog.map((item) => item.abrangencia)),
      acomodacoes: buildSelectOptions(quoteCatalog.map((item) => item.acomodacao)),
    }),
    [quoteCatalog],
  );

  const totalSelectedItems = activeQuote?.selectedCatalogItemIds.length ?? 0;

  const handleCreateQuoteClick = () => {
    setWizardState(createWizardState('create', buildCotadorQuoteDraft()));
  };

  const handleEditQuoteClick = () => {
    if (!activeQuote) {
      return;
    }

    setWizardState(createWizardState('edit', buildCotadorQuoteDraft(activeQuote)));
  };

  const handleWizardSubmit = (input: CotadorQuoteInput) => {
    if (wizardState.mode === 'create') {
      const nextQuote = createCotadorQuote(input);
      setQuotes((current) => sortCotadorQuotesByRecent([nextQuote, ...current]));
      setActiveQuoteId(nextQuote.id);
    } else if (activeQuoteId) {
      setQuotes((current) =>
        sortCotadorQuotesByRecent(
          current.map((quote) => {
            if (quote.id !== activeQuoteId) {
              return quote;
            }

            const updatedQuote = updateCotadorQuote(quote, input);
            return {
              ...updatedQuote,
              selectedCatalogItemIds: quote.selectedCatalogItemIds.filter((itemId) => {
                const catalogItem = catalogItems.find((item) => item.id === itemId);
                return catalogItem ? catalogMatchesQuoteModality(catalogItem.modalidade, updatedQuote.modality) : false;
              }),
            };
          }),
        ),
      );
    }

    setWizardState((current) => ({ ...current, isOpen: false }));
  };

  const handleToggleCatalogItem = (itemId: string) => {
    if (!activeQuoteId) {
      return;
    }

    setQuotes((current) =>
      sortCotadorQuotesByRecent(
        current.map((quote) => {
          if (quote.id !== activeQuoteId) {
            return quote;
          }

          const alreadySelected = quote.selectedCatalogItemIds.includes(itemId);
          return {
            ...quote,
            selectedCatalogItemIds: alreadySelected
              ? quote.selectedCatalogItemIds.filter((currentItemId) => currentItemId !== itemId)
              : [...quote.selectedCatalogItemIds, itemId],
            updatedAt: new Date().toISOString(),
          };
        }),
      ),
    );
  };

  return (
    <div className="panel-dashboard-immersive panel-page-shell space-y-6">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.96)_48%,rgba(247,240,231,0.99)_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.28)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Calculator className="h-3.5 w-3.5" />
              Cotador
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)] md:text-4xl">Monte cotacoes com contexto antes de entrar no contrato</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)]">
              Cada cotacao nasce com nome, distribuicao de vidas por faixa etaria e modalidade comercial. Depois disso, o seletor abre no painel com shortlist separada do contrato e pronto para crescer com multiplas operadoras, administradoras e entidades de classe.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleCreateQuoteClick}>
              <Plus className="h-4 w-4" />
              Criar cotacao
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:rgba(255,253,250,0.86)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Cotacoes salvas</p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{quotes.length}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:rgba(255,253,250,0.86)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Cotacao ativa</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{activeQuote ? activeQuote.name : 'Nenhuma ainda'}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:rgba(255,253,250,0.86)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Vidas na ativa</p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{activeQuote?.totalLives ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:rgba(255,253,250,0.86)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Itens na shortlist</p>
            <p className="mt-1 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{totalSelectedItems}</p>
          </div>
        </div>
      </section>

      {catalogLoading ? (
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando catalogo inicial do Cotador...</p>
        </div>
      ) : quotes.length === 0 ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-6 py-12 shadow-sm md:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Sparkles className="h-3.5 w-3.5" />
              Primeiro passo
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Crie a primeira cotacao para abrir o seletor</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)]">
              O wizard inicial ja coleta o nome da cotacao, a distribuicao de vidas por faixa etaria e o tipo comercial. Assim que terminar, o workspace abre com filtros e shortlist prontos para uso.
            </p>
            <div className="mt-6">
              <Button onClick={handleCreateQuoteClick}>
                <Plus className="h-4 w-4" />
                Criar primeira cotacao
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                title: 'Nome da cotacao',
                description: 'Ajuda a organizar familias, empresas, cidades ou focos comerciais sem perder contexto.',
                icon: Calculator,
              },
              {
                title: 'Faixas etarias ANS',
                description: 'A grade ja nasce alinhada com 0-18, 19-23, 24-28 e demais faixas ate 59+.',
                icon: Users,
              },
              {
                title: 'PF, Adesao ou PME',
                description: 'O seletor abre no contexto certo e fica pronto para ampliar o catalogo no futuro.',
                icon: Clock3,
              },
            ].map((item) => (
              <article key={item.title} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(246,228,199,0.6)] p-3 text-[var(--panel-accent-ink,#6f3f16)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : activeQuote ? (
        <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Historico</p>
                  <h2 className="mt-2 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Cotacoes recentes</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={handleCreateQuoteClick}>
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {quotes.map((quote) => {
                  const isActive = quote.id === activeQuote.id;

                  return (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => setActiveQuoteId(quote.id)}
                      className={cx(
                        'w-full rounded-2xl border p-4 text-left transition-all',
                        isActive
                          ? 'border-[var(--panel-accent-strong,#b85c1f)] bg-[color:rgba(239,207,159,0.4)] shadow-sm'
                          : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[var(--panel-surface,#fffdfa)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                            {formatCotadorModality(quote.modality)}
                          </p>
                        </div>
                        <span className="rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.86)] px-2.5 py-1 text-[11px] font-semibold text-[var(--panel-accent-ink,#6f3f16)]">
                          {quote.totalLives} vidas
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Atualizada em {formatCotadorDateTime(quote.updatedAt)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <CotadorWorkspace
            quote={activeQuote}
            catalogItems={quoteCatalog}
            filteredItems={filteredItems}
            selectedItems={selectedItems}
            filterOptions={filterOptions}
            filters={filters}
            hasDetailedProducts={hasDetailedProducts}
            onUpdateFilters={(updates) => setFilters((current) => ({ ...current, ...updates }))}
            onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            onToggleCatalogItem={handleToggleCatalogItem}
            onCreateQuote={handleCreateQuoteClick}
            onEditQuote={handleEditQuoteClick}
          />
        </section>
      ) : null}

      <CotadorCreateQuoteModal
        isOpen={wizardState.isOpen}
        mode={wizardState.mode}
        initialDraft={wizardState.draft}
        onClose={() => setWizardState((current) => ({ ...current, isOpen: false }))}
        onSubmit={handleWizardSubmit}
      />
    </div>
  );
}
