import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, ChevronDown, FileText, MapPin, Search, ShieldCheck, WalletCards } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { formatCotadorCurrency } from '../shared/cotadorUtils';
import type { CotadorQuoteItem } from '../shared/cotadorTypes';

type CotadorPlanDetailsPageProps = {
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

const compareNetworkEntries = (left: CotadorQuoteItem['redeHospitalar'][number], right: CotadorQuoteItem['redeHospitalar'][number]) => {
  const cityComparison = (left.cidade ?? '').localeCompare(right.cidade ?? '', 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const regionComparison = (left.regiao ?? '').localeCompare(right.regiao ?? '', 'pt-BR');
  if (regionComparison !== 0) return regionComparison;

  return (left.hospital ?? '').localeCompare(right.hospital ?? '', 'pt-BR');
};

const networkLegend = [
  'H: Hospital Eletivo',
  'H CARD: Hospital Cardiologico',
  'HD: Hospital Dia',
  'H ORT: Hospital Cirurgia Ortopedica',
  'M: Maternidade',
  'HP: Hospital Pediatrico',
  'PA: Pronto Atendimento',
  'PS: Pronto Socorro',
  'PS CARD: Pronto Socorro Cardiologico',
  'PS OBST: Pronto Socorro Obstetrico',
  'PSI: Pronto Socorro Infantil',
  'PSO: Pronto Socorro Ortopedico',
  '*: prestador habilitado apenas na acomodacao QP',
  '**: prestador habilitado apenas na acomodacao QC',
];

export default function CotadorPlanDetailsPage({ item, onBack }: CotadorPlanDetailsPageProps) {
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
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const networkEntriesCount = item.redeHospitalar.length;
  useEffect(() => {
    setOpenSectionIds(sections.length > 0 ? [sections[0].id] : []);
  }, [sections]);

  useEffect(() => {
    setNetworkSearch('');
    setNetworkCity('');
    setNetworkModalOpen(false);
  }, [item.id]);

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((current) => (
      current.includes(sectionId)
        ? current.filter((value) => value !== sectionId)
        : [...current, sectionId]
    ));
  };

  const sortedNetwork = useMemo(
    () => [...item.redeHospitalar].sort(compareNetworkEntries),
    [item.redeHospitalar],
  );

  const cityOptions = useMemo(
    () => Array.from(new Set(sortedNetwork.map((entry) => entry.cidade).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR')).map((city) => ({ value: city, label: city })),
    [sortedNetwork],
  );

  const filteredNetwork = useMemo(() => {
    const normalizedSearch = networkSearch.trim().toLowerCase();

    return sortedNetwork.filter((entry) => {
      if (networkCity && entry.cidade !== networkCity) return false;
      if (!normalizedSearch) return true;

      const haystack = [entry.hospital, entry.bairro, entry.regiao, entry.cidade, entry.atendimentos.join(' ')].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [networkCity, networkSearch, sortedNetwork]);

  const groupedFilteredNetwork = useMemo(() => {
    const groups = new Map<string, typeof filteredNetwork>();

    filteredNetwork.forEach((entry) => {
      const city = entry.cidade || 'Cidade nao informada';
      const current = groups.get(city) ?? [];
      current.push(entry);
      groups.set(city, current);
    });

    return Array.from(groups.entries()).map(([city, entries]) => ({ city, entries }));
  }, [filteredNetwork]);

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

          <div className="flex flex-col items-stretch gap-3 xl:min-w-[260px] xl:items-end">
            {item.estimatedMonthlyTotal !== null && (
              <div className="rounded-2xl border border-[color:rgba(111,63,22,0.18)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_68%,var(--panel-surface-soft,#f4ede3))] px-5 py-4 text-right dark:border-[color:rgba(243,200,146,0.16)] dark:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#2a2119)_84%,var(--panel-surface,#1b1611))]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:#c8b29b]">Mensalidade</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{formatCotadorCurrency(item.estimatedMonthlyTotal)}</p>
              </div>
            )}

            <Button variant="secondary" onClick={() => setNetworkModalOpen(true)} disabled={networkEntriesCount === 0}>
              <MapPin className="h-4 w-4" />
              Ver rede do plano
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Acomodacao</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.acomodacao ?? '-'}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Rede hospitalar</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
              {networkEntriesCount > 0 ? `${networkEntriesCount} prestador(es)` : 'Nao cadastrada'}
            </p>
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

      <ModalShell
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        title="Rede do plano"
        description="A rede esta ordenada por cidade e depois por regiao. Use os filtros para localizar um prestador especifico."
        size="xl"
      >
        {networkEntriesCount === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
            Este plano ainda nao possui rede hospitalar cadastrada para exibicao.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
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

            {groupedFilteredNetwork.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Nenhum hospital encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
                {groupedFilteredNetwork.map((group, groupIndex) => (
                  <section
                    key={group.city}
                    className={groupIndex > 0 ? 'border-t border-[color:var(--panel-border-subtle,#e7dac8)]' : ''}
                  >
                    <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                        {group.entries.length} prestador(es)
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{group.city}</h3>
                    </div>

                    <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                      {group.entries.map((entry, index) => (
                        <article key={`${group.city}-${entry.regiao}-${entry.hospital}-${index}`} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
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
                  </section>
                ))}
              </div>
            )}

            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Legenda das siglas</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)] md:grid-cols-2">
                {networkLegend.map((legendItem) => (
                  <p key={legendItem}>{legendItem}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
