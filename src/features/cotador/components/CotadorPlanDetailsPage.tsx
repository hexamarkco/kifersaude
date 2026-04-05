import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, ChevronDown, FileText, MapPin, Search, ShieldCheck, WalletCards } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { formatCotadorCurrency } from '../shared/cotadorUtils';
import type { CotadorQuote, CotadorQuoteItem } from '../shared/cotadorTypes';

type CotadorPlanDetailsPageProps = {
  quote: CotadorQuote;
  item: CotadorQuoteItem;
  onBack: () => void;
};

type DetailSection = {
  id: string;
  title: string;
  content: string;
  icon: typeof ShieldCheck;
};

const formatPerfil = (value: CotadorQuoteItem['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Nao MEI';
  if (value === 'todos') return 'Perfil livre';
  return 'Perfil livre';
};

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'Copart. indefinida';
};

const cleanDetailText = (value?: string | null) => value?.trim() ?? '';

export default function CotadorPlanDetailsPage({ quote, item, onBack }: CotadorPlanDetailsPageProps) {
  const sections = useMemo<DetailSection[]>(() => {
    const entries: Array<DetailSection | null> = [
      cleanDetailText(item.carencias)
        ? { id: 'carencias', title: 'Carencias', content: cleanDetailText(item.carencias), icon: ShieldCheck }
        : null,
      cleanDetailText(item.documentosNecessarios)
        ? { id: 'documentos', title: 'Documentos necessarios', content: cleanDetailText(item.documentosNecessarios), icon: FileText }
        : null,
      cleanDetailText(item.reembolso)
        ? { id: 'reembolso', title: 'Reembolso', content: cleanDetailText(item.reembolso), icon: WalletCards }
        : null,
      cleanDetailText(item.informacoesImportantes)
        ? { id: 'informacoes', title: 'Informacoes importantes', content: cleanDetailText(item.informacoesImportantes), icon: FileText }
        : null,
    ];

    return entries.filter((entry): entry is DetailSection => entry !== null);
  }, [item.carencias, item.documentosNecessarios, item.informacoesImportantes, item.reembolso]);

  const [openSectionIds, setOpenSectionIds] = useState<string[]>(sections.length > 0 ? [sections[0].id] : []);
  const [networkSearch, setNetworkSearch] = useState('');
  const [networkCity, setNetworkCity] = useState('');

  useEffect(() => {
    setOpenSectionIds(sections.length > 0 ? [sections[0].id] : []);
  }, [sections]);

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((current) => (
      current.includes(sectionId)
        ? current.filter((value) => value !== sectionId)
        : [...current, sectionId]
    ));
  };

  const cityOptions = useMemo(
    () => Array.from(new Set(item.redeHospitalar.map((entry) => entry.cidade).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR')).map((city) => ({ value: city, label: city })),
    [item.redeHospitalar],
  );

  const filteredNetwork = useMemo(() => {
    const normalizedSearch = networkSearch.trim().toLowerCase();

    return item.redeHospitalar.filter((entry) => {
      if (networkCity && entry.cidade !== networkCity) return false;
      if (!normalizedSearch) return true;

      const haystack = [entry.hospital, entry.bairro, entry.regiao, entry.cidade, entry.atendimentos.join(' ')].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [item.redeHospitalar, networkCity, networkSearch]);

  return (
    <div className="panel-page-shell space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para a cotacao
        </Button>
      </div>

      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--panel-accent-soft,#f6e4c7)_74%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_92%,var(--panel-surface-soft,#f4ede3))_48%,color-mix(in_srgb,var(--panel-surface-muted,#f8f2e8)_90%,var(--panel-surface,#fffdfa))_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              {item.operadora.name ?? 'Operadora'}
              {item.linha?.name ? ` : ${item.linha.name}` : ''}
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</h1>
            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              {formatPerfil(item.perfilEmpresarial)} | {formatCopart(item.coparticipacao)}
              {item.vidasMin !== null || item.vidasMax !== null ? ` | ${item.vidasMin ?? 1} a ${item.vidasMax ?? '...'} vidas` : ''}
            </p>
          </div>

          {item.estimatedMonthlyTotal !== null && (
            <div className="rounded-2xl border border-[color:rgba(14,116,144,0.24)] bg-[linear-gradient(135deg,rgba(224,242,254,0.88),rgba(240,249,255,0.96))] px-5 py-4 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:#0f4c5c]">Mensalidade</p>
              <p className="mt-2 text-2xl font-semibold text-[color:#123244]">{formatCotadorCurrency(item.estimatedMonthlyTotal)}</p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Cotacao</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Abrangencia</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.abrangencia ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Acomodacao</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.acomodacao ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Tabela</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.tabelaNome ?? '-'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-6 shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Mais detalhes</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Informacoes do plano</h2>
        </div>

        {sections.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
            Este produto ainda nao possui informacoes adicionais cadastradas.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {sections.map((section) => {
              const isOpen = openSectionIds.includes(section.id);
              const Icon = section.icon;
              return (
                <div key={section.id} className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_72%,var(--panel-surface,#fffdfa))]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{section.title}</span>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-[color:var(--panel-text-muted,#876f5c)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-5 py-4 text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)] whitespace-pre-wrap">
                      {section.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {item.redeHospitalar.length > 0 && (
        <section className="rounded-[32px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-6 shadow-sm md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Rede hospitalar</p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Hospitais e atendimentos</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <FilterSingleSelect
              icon={MapPin}
              options={cityOptions}
              placeholder="Todas as cidades"
              value={networkCity}
              onChange={setNetworkCity}
            />
            <Input
              value={networkSearch}
              onChange={(event) => setNetworkSearch(event.target.value)}
              placeholder="Buscar hospital, bairro, regiao ou atendimento"
              leftIcon={Search}
            />
          </div>

          {filteredNetwork.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              Nenhum hospital encontrado para os filtros aplicados.
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
              <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                {filteredNetwork.map((entry, index) => (
                  <article key={`${entry.cidade}-${entry.hospital}-${index}`} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{entry.hospital}</p>
                          <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                            {[entry.bairro, entry.regiao, entry.cidade].filter(Boolean).join(' | ')}
                          </p>
                          {entry.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{entry.observacoes}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
                      {entry.atendimentos.map((service) => (
                        <span key={`${entry.hospital}-${service}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-xs font-medium text-[color:var(--panel-text,#1a120d)]">
                          {service}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
