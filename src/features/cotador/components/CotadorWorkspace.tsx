import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Layers3, Plus, Settings2, Sparkles, Trash2, Users } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { formatCotadorAgeSummary, formatCotadorDateTime, formatCotadorModality } from '../shared/cotadorUtils';
import type { CotadorCatalogFilters, CotadorCatalogItem, CotadorQuote, CotadorQuoteItem } from '../shared/cotadorTypes';
import type { CotadorQuoteModality } from '../shared/cotadorConstants';
import CotadorPlanPickerOverlay from './CotadorPlanPickerOverlay';

type SelectOption = {
  value: string;
  label: string;
};

type CotadorWorkspaceProps = {
  quote: CotadorQuote;
  catalogItems: CotadorCatalogItem[];
  filteredItems: CotadorCatalogItem[];
  selectedItems: CotadorQuoteItem[];
  filterOptions: {
    operadoras: SelectOption[];
    linhas: SelectOption[];
    administradoras: SelectOption[];
    entidades: SelectOption[];
    perfisEmpresariais: SelectOption[];
    coparticipacoes: SelectOption[];
    abrangencias: SelectOption[];
    acomodacoes: SelectOption[];
  };
  filters: CotadorCatalogFilters;
  hasDetailedProducts: boolean;
  busy?: boolean;
  onUpdateFilters: (updates: Partial<CotadorCatalogFilters>) => void;
  onResetFilters: () => void;
  onToggleCatalogItem: (itemId: string) => void;
  onCreateQuote: () => void;
  onEditQuote: () => void;
  onOpenConfig: () => void;
  onChangeQuoteModality: (modality: CotadorQuoteModality) => void;
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{value}</p>
    </div>
  );
}

const formatPerfil = (value: CotadorQuoteItem['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Não MEI';
  if (value === 'todos') return 'Todos';
  return 'Livre';
};

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'A definir';
};

export default function CotadorWorkspace({
  quote,
  catalogItems,
  filteredItems,
  selectedItems,
  filterOptions,
  filters,
  hasDetailedProducts,
  busy = false,
  onUpdateFilters,
  onResetFilters,
  onToggleCatalogItem,
  onCreateQuote,
  onEditQuote,
  onOpenConfig,
  onChangeQuoteModality,
}: CotadorWorkspaceProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const filledDistribution = useMemo(
    () => Object.entries(quote.ageDistribution).filter(([, quantity]) => quantity > 0),
    [quote.ageDistribution],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--panel-accent-soft,#f6e4c7)_74%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_92%,var(--panel-surface-soft,#f4ede3))_48%,color-mix(in_srgb,var(--panel-surface-muted,#f8f2e8)_90%,var(--panel-surface,#fffdfa))_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Sparkles className="h-3.5 w-3.5" />
              Cotação ativa
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)]">
              Esta tela foca na operação da cotação: comparar planos, manter a shortlist e revisar a distribuição de vidas antes de seguir para proposta ou contrato.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onOpenConfig}>
              <Settings2 className="h-4 w-4" />
              Configurar catálogo
            </Button>
            <Button variant="secondary" onClick={onEditQuote}>
              <Users className="h-4 w-4" />
              Editar distribuição
            </Button>
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar plano
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Tipo" value={formatCotadorModality(quote.modality)} />
          <SummaryMetric label="Total de vidas" value={`${quote.totalLives} vidas`} />
          <SummaryMetric label="Faixas" value={formatCotadorAgeSummary(quote.ageDistribution)} />
          <SummaryMetric label="Atualizada em" value={formatCotadorDateTime(quote.updatedAt)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-surface,#fffdfa)_90%,var(--panel-surface-soft,#f4ede3))_0%,color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_80%,var(--panel-surface,#fffdfa))_100%)] p-6 text-[color:var(--panel-text,#1a120d)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[color:var(--panel-border-subtle,#e7dac8)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Planos da cotação</p>
              <h3 className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Shortlist de comparação</h3>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                {selectedItems.length > 0
                  ? `${selectedItems.length} plano(s) adicionados para esta cotação.`
                  : 'Nenhum plano foi adicionado ainda. Use o botão abaixo para iniciar a comparação.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onCreateQuote}>
                Nova cotação
              </Button>
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
                Adicionar plano
              </Button>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-6 flex min-h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_84%,var(--panel-surface-soft,#f4ede3))] px-6 text-center transition-all hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_72%,var(--panel-accent-soft,#f6e4c7))]"
            >
              <div className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 text-[var(--panel-accent-ink,#6f3f16)]">
                <Plus className="h-7 w-7" />
              </div>
              <p className="mt-5 text-xl font-semibold text-[color:var(--panel-text,#1a120d)]">Adicionar plano</p>
              <p className="mt-2 max-w-md text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Abra o seletor para escolher operadora, linha, produto e tabela conforme a distribuição de vidas desta cotação.
              </p>
            </button>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {selectedItems.map((item) => (
                <article key={item.id} className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-[color:rgba(8,145,178,0.22)] bg-[color:rgba(8,145,178,0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text,#1a120d)]">
                          {item.operadora.name ?? 'Operadora'}
                        </span>
                        {item.linha?.name && (
                          <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-soft,#5b4635)]">
                            {item.linha.name}
                          </span>
                        )}
                        {item.tabelaNome && (
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-900 dark:border-emerald-300/18 dark:bg-emerald-300/10 dark:text-emerald-100">
                            {item.tabelaNome}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-4 text-xl font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</h4>
                      <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                        {item.perfilEmpresarial ? formatPerfil(item.perfilEmpresarial) : 'Perfil livre'}
                        {item.coparticipacao ? ` | ${formatCopart(item.coparticipacao)}` : ''}
                        {item.vidasMin !== null || item.vidasMax !== null ? ` | ${item.vidasMin ?? 1} a ${item.vidasMax ?? '...'} vidas` : ''}
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => onToggleCatalogItem(item.catalogItemKey)} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <SummaryMetric label="Abrangência" value={item.abrangencia ?? 'A definir'} />
                    <SummaryMetric label="Acomodação" value={item.acomodacao ?? 'A definir'} />
                    <SummaryMetric label="Comissão" value={item.comissaoSugerida !== null ? `${item.comissaoSugerida.toFixed(2)}%` : 'Sem regra'} />
                    <SummaryMetric label="Bônus por vida" value={item.bonusPorVidaValor !== null ? `R$ ${item.bonusPorVidaValor.toFixed(2)}` : 'Sem bônus'} />
                  </div>

                  {item.estimatedMonthlyTotal !== null && (
                    <div className="mt-4 rounded-2xl border border-[color:rgba(8,145,178,0.22)] bg-[color:rgba(8,145,178,0.08)] px-4 py-3 dark:border-cyan-300/18 dark:bg-cyan-300/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-soft,#5b4635)] dark:text-cyan-100/80">Mensalidade estimada</p>
                      <p className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-white">R$ {item.estimatedMonthlyTotal.toFixed(2)}</p>
                    </div>
                  )}

                  {(item.administradora?.name || item.entidadesClasse.length > 0 || item.observacao) && (
                    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                      {item.administradora?.name && <p>Administradora: {item.administradora.name}</p>}
                      {item.entidadesClasse.length > 0 && <p>Entidades: {item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ')}</p>}
                      {item.observacao && <p>{item.observacao}</p>}
                    </div>
                  )}
                </article>
              ))}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_84%,var(--panel-surface-soft,#f4ede3))] px-6 text-center transition-all hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_72%,var(--panel-accent-soft,#f6e4c7))]"
              >
                <div className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 text-[var(--panel-accent-ink,#6f3f16)]">
                  <Plus className="h-6 w-6" />
                </div>
                <p className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Adicionar outro plano</p>
                <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Compare mais uma opção sem sair da cotação.</p>
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Distribuição</p>
                <h3 className="mt-2 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Resumo da cotação</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={onEditQuote}>
                Editar
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <SummaryMetric label="Tipo" value={formatCotadorModality(quote.modality)} />
              <SummaryMetric label="Total" value={`${quote.totalLives} vidas`} />
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                <Users className="h-4 w-4" />
                Faixas preenchidas
              </div>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                {filledDistribution.length > 0 ? (
                  filledDistribution.map(([range, quantity]) => (
                    <div key={range} className="flex items-center justify-between gap-4">
                      <span>{range}</span>
                      <span className="font-semibold text-[color:var(--panel-text,#1a120d)]">{quantity}</span>
                    </div>
                  ))
                ) : (
                  <p>Nenhuma vida distribuída.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">
              <CalendarClock className="h-4 w-4" />
              Situação da cotação
            </div>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>{selectedItems.length > 0 ? `${selectedItems.length} plano(s) na shortlist.` : 'Ainda sem planos adicionados.'}</span>
              </div>
              <div className="flex items-start gap-2">
                <Layers3 className="mt-0.5 h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                <span>{hasDetailedProducts ? `${catalogItems.length} oferta(s) disponível(is) no seletor atual.` : 'Catálogo ainda sem produtos detalhados.'}</span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                <span>Atualizada em {formatCotadorDateTime(quote.updatedAt)}.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <CotadorPlanPickerOverlay
        isOpen={pickerOpen}
        quote={quote}
        catalogItems={catalogItems}
        filteredItems={filteredItems}
        filters={filters}
        filterOptions={filterOptions}
        busy={busy}
        onClose={() => setPickerOpen(false)}
        onSelectItem={(itemId) => {
          onToggleCatalogItem(itemId);
          setPickerOpen(false);
        }}
        onUpdateFilters={onUpdateFilters}
        onResetFilters={onResetFilters}
        onChangeQuoteModality={onChangeQuoteModality}
      />
    </div>
  );
}
