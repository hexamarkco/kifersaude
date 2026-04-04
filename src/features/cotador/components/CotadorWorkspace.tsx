import { BadgePercent, Building2, CheckCircle2, Clock3, MapPin, Search, Sparkles, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import { cx } from '../../../lib/cx';
import { formatCotadorAgeSummary, formatCotadorDateTime, formatCotadorModality } from '../shared/cotadorUtils';
import type { CotadorCatalogFilters, CotadorCatalogItem, CotadorQuote, CotadorQuoteItem } from '../shared/cotadorTypes';

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
    administradoras: SelectOption[];
    entidades: SelectOption[];
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
};

type MetricItemProps = {
  label: string;
  value: string;
};

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:rgba(255,253,250,0.82)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{value}</p>
    </div>
  );
}

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
}: CotadorWorkspaceProps) {
  const selectedIds = new Set(quote.selectedItems.map((item) => item.catalogItemKey));

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.96),rgba(255,253,250,0.95)_52%,rgba(247,240,231,0.98)_100%)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.28)] bg-[color:rgba(255,253,250,0.8)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Sparkles className="h-3.5 w-3.5" />
              Cotacao ativa
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)]">
              O seletor ja nasce separado do contrato final, preservando espaco para operadoras, administradoras e entidades de classe evoluirem sem retrabalho.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="secondary" onClick={onEditQuote}>
              Editar dados iniciais
            </Button>
            <Button onClick={onCreateQuote}>Nova cotacao</Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricItem label="Tipo" value={formatCotadorModality(quote.modality)} />
          <MetricItem label="Total de vidas" value={`${quote.totalLives} vidas`} />
          <MetricItem label="Faixas" value={formatCotadorAgeSummary(quote.ageDistribution)} />
          <MetricItem label="Atualizada em" value={formatCotadorDateTime(quote.updatedAt)} />
        </div>
      </section>

      <section className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Seletor da cotacao</p>
            <h3 className="mt-2 text-xl font-semibold text-[color:var(--panel-text,#1a120d)]">Filtre a carteira comercial e monte sua shortlist</h3>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              {hasDetailedProducts
                ? 'Os produtos ativos entram primeiro. Operadoras sem produto detalhado continuam visiveis como fallback para nao travar a analise.'
                : 'Ainda nao ha produtos detalhados cadastrados. O seletor esta usando a carteira de operadoras ativas como base inicial.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.selectedOnly ? 'soft' : 'secondary'}
              onClick={() => onUpdateFilters({ selectedOnly: !filters.selectedOnly })}
              disabled={selectedItems.length === 0}
            >
              {filters.selectedOnly ? 'Mostrando shortlist' : 'Ver so shortlist'}
            </Button>
            <Button variant="ghost" onClick={onResetFilters}>
              Limpar filtros
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-6">
          <Input
            value={filters.search}
            onChange={(event) => onUpdateFilters({ search: event.target.value })}
            placeholder="Buscar por operadora, produto ou modalidade"
            leftIcon={Search}
          />
          <FilterSingleSelect
            icon={Building2}
            options={filterOptions.operadoras}
            placeholder="Todas as operadoras"
            value={filters.operadoraId}
            onChange={(next) => onUpdateFilters({ operadoraId: next })}
          />
          <FilterSingleSelect
            icon={BadgePercent}
            options={filterOptions.administradoras}
            placeholder="Todas as administradoras"
            value={filters.administradoraId}
            onChange={(next) => onUpdateFilters({ administradoraId: next })}
          />
          <FilterSingleSelect
            icon={CheckCircle2}
            options={filterOptions.entidades}
            placeholder="Todas as entidades"
            value={filters.entidadeId}
            onChange={(next) => onUpdateFilters({ entidadeId: next })}
          />
          <FilterSingleSelect
            icon={MapPin}
            options={filterOptions.abrangencias}
            placeholder="Todas as abrangencias"
            value={filters.abrangencia}
            onChange={(next) => onUpdateFilters({ abrangencia: next })}
          />
          <FilterSingleSelect
            icon={Sparkles}
            options={filterOptions.acomodacoes}
            placeholder="Todas as acomodacoes"
            value={filters.acomodacao}
            onChange={(next) => onUpdateFilters({ acomodacao: next })}
          />
        </div>
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Resultados disponiveis</h3>
              <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                {filteredItems.length} item(ns) visivel(is) para {formatCotadorModality(quote.modality)}.
              </p>
            </div>
          </div>

          {catalogItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center">
              <Building2 className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
              <h4 className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Nenhum item encontrado para o seletor</h4>
              <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Cadastre operadoras ativas ou produtos de plano em Configuracoes para alimentar a vitrine do Cotador.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[color:var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
              <h4 className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Nenhum resultado bate com os filtros atuais</h4>
              <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Ajuste a busca, troque o tipo de cotacao ou limpe os filtros para abrir mais opcoes.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);

                return (
                  <article
                    key={item.id}
                    className={cx(
                      'rounded-3xl border p-5 shadow-sm transition-all',
                      isSelected
                        ? 'border-[var(--panel-accent-strong,#b85c1f)] bg-[color:rgba(239,207,159,0.35)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:-translate-y-0.5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[color:rgba(157,127,90,0.28)] bg-[color:rgba(255,253,250,0.86)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">
                        {item.source === 'cotador_produto' ? 'Produto' : item.source === 'legacy_produto' ? 'Legado' : 'Operadora'}
                          </span>
                          {item.modalidade && (
                            <span className="rounded-full border border-[color:rgba(157,127,90,0.22)] bg-[color:rgba(246,228,199,0.62)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#6f3f16)]">
                              {item.modalidade}
                            </span>
                          )}
                          {isSelected && (
                            <span className="rounded-full border border-emerald-300/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
                              Na shortlist
                            </span>
                          )}
                        </div>

                        <h4 className="mt-3 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</h4>
                        <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.operadora.name ?? 'Operadora nao informada'}</p>
                      </div>

                      <Button
                        variant={isSelected ? 'success' : 'primary'}
                        onClick={() => onToggleCatalogItem(item.id)}
                        disabled={busy}
                      >
                        {isSelected ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Selecionado
                          </>
                        ) : (
                          'Adicionar'
                        )}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetricItem label="Abrangencia" value={item.abrangencia ?? 'A definir'} />
                      <MetricItem label="Acomodacao" value={item.acomodacao ?? 'A definir'} />
                      <MetricItem
                        label="Comissao sugerida"
                        value={item.comissaoSugerida !== null ? `${item.comissaoSugerida.toFixed(2)}%` : 'Sem regra'}
                      />
                      <MetricItem
                        label="Bonus por vida"
                        value={item.bonusPorVidaValor !== null ? `R$ ${item.bonusPorVidaValor.toFixed(2)}` : 'Sem bonus'}
                      />
                    </div>

                    {(item.administradora?.name || item.entidadesClasse.length > 0 || item.observacao) && (
                      <div className="mt-4 rounded-2xl border border-[color:rgba(157,127,90,0.2)] bg-[color:rgba(255,253,250,0.82)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                        {item.administradora?.name && <p>Administradora: {item.administradora.name}</p>}
                        {item.entidadesClasse.length > 0 && <p>Entidades: {item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ')}</p>}
                        {item.observacao && <p>{item.observacao}</p>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Shortlist</p>
                <h3 className="mt-2 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{selectedItems.length} item(ns) selecionado(s)</h3>
              </div>
              <div className="rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)]">
                {quote.totalLives} vidas
              </div>
            </div>

            {selectedItems.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[color:var(--panel-text-muted,#876f5c)]" />
                <p className="mt-3 text-sm font-medium text-[color:var(--panel-text,#1a120d)]">Nenhum item salvo ainda</p>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Use o seletor ao lado para guardar as melhores opcoes desta cotacao.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[color:rgba(157,127,90,0.2)] bg-[color:rgba(255,253,250,0.86)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</p>
                        <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.operadora.name ?? 'Operadora nao informada'}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onToggleCatalogItem(item.catalogItemKey)} disabled={busy}>
                        <X className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                        <span>{item.abrangencia ?? 'Abrangencia a definir'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BadgePercent className="h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                        <span>
                          {item.comissaoSugerida !== null ? `${item.comissaoSugerida.toFixed(2)}% de comissao` : 'Sem comissao sugerida'}
                        </span>
                      </div>
                      {item.administradora?.name && (
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                          <span>Administradora: {item.administradora.name}</span>
                        </div>
                      )}
                      {item.entidadesClasse.length > 0 && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                          <span>Entidades: {item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Sparkles className="h-3.5 w-3.5" />
              Preparado para crescer
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                Cada item do seletor ja reserva espaco para administradora e entidade de classe.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                A cotacao fica separada do contrato final, sem acoplar a venda cedo demais.
              </li>
              <li className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 text-[color:var(--panel-text-muted,#876f5c)]" />
                Historico e shortlist continuam no navegador nesta primeira entrega.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
