import { useMemo } from 'react';
import { Building2, Check, WalletCards } from 'lucide-react';
import PublicBrandMark from '../../../components/public/PublicBrandMark';
import type { CotadorAgeRange } from '../shared/cotadorConstants';
import {
  buildCotadorComparableHospitalKey,
  countCotadorUniqueNetworkProviders,
  formatCotadorCurrency,
  formatCotadorDateTime,
  formatCotadorSelectedModalities,
  mergeCotadorHospitalNetworkEntries,
  summarizeCotadorNetworkServices,
} from '../shared/cotadorUtils';
import type { CotadorQuoteItem, CotadorQuoteSharePayload } from '../shared/cotadorTypes';

type CotadorQuoteShareViewProps = {
  payload: CotadorQuoteSharePayload;
  includeNetworkComparison: boolean;
  sharedAt?: string;
  className?: string;
};

type NetworkCompareRow = {
  key: string;
  hospital: string;
  cidade: string;
  bairro: string | null;
  regiao: string | null;
  services: string[];
  planPresence: Partial<Record<string, { services: string[] }>>;
  hitsCount: number;
};

const normalizeNetworkText = (value?: string | null) => (
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
);

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'A definir';
};

const mergeCompareLabel = (current?: string | null, next?: string | null) => {
  const values = Array.from(new Map([current, next]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => [normalizeNetworkText(value), value.trim()])).values());

  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  return values.join(' / ');
};

const preferHospitalLabel = (current: string, next: string) => {
  if (!current) return next;
  if (!next) return current;

  if (next.trim().length !== current.trim().length) {
    return next.trim().length < current.trim().length ? next : current;
  }

  return next.localeCompare(current, 'pt-BR') < 0 ? next : current;
};

const compareNetworkCompareRows = (left: NetworkCompareRow, right: NetworkCompareRow) => {
  const cityComparison = left.cidade.localeCompare(right.cidade, 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const bairroComparison = (left.bairro ?? '').localeCompare(right.bairro ?? '', 'pt-BR');
  if (bairroComparison !== 0) return bairroComparison;

  return left.hospital.localeCompare(right.hospital, 'pt-BR');
};

function SummaryCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-3xl border border-[color:#e8d7c1] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(40,22,10,0.05)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:#8d6f57]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[color:#23160e]">{value}</p>
      {helper ? <p className="mt-1 text-sm text-[color:#6d5544]">{helper}</p> : null}
    </div>
  );
}

export default function CotadorQuoteShareView({
  payload,
  includeNetworkComparison,
  sharedAt,
  className,
}: CotadorQuoteShareViewProps) {
  const selectedItems = payload.items;

  const networkSummaryByItemId = useMemo(
    () => new Map(selectedItems.map((item) => {
      const entries = mergeCotadorHospitalNetworkEntries(item.redeHospitalar);
      return [item.id, { entries, count: entries.length }] as const;
    })),
    [selectedItems],
  );

  const networkComparisonRows = useMemo<NetworkCompareRow[]>(() => {
    const rows = new Map<string, NetworkCompareRow>();

    selectedItems.forEach((item) => {
      const networkEntries = networkSummaryByItemId.get(item.id)?.entries ?? [];

      networkEntries.forEach((entry) => {
        const key = buildCotadorComparableHospitalKey(entry);
        const current = rows.get(key) ?? {
          key,
          hospital: entry.hospital,
          cidade: entry.cidade || 'Cidade nao informada',
          bairro: entry.bairro ?? null,
          regiao: entry.regiao ?? null,
          services: [],
          planPresence: {},
          hitsCount: 0,
        };

        const mergedServices = Array.from(new Set([...(current.planPresence[item.id]?.services ?? []), ...entry.atendimentos.filter(Boolean)]))
          .sort((left, right) => left.localeCompare(right, 'pt-BR'));

        current.hospital = preferHospitalLabel(current.hospital, entry.hospital);
        current.bairro = mergeCompareLabel(current.bairro, entry.bairro);
        current.regiao = mergeCompareLabel(current.regiao, entry.regiao);
        current.planPresence[item.id] = { services: mergedServices };
        current.services = Array.from(new Set([...current.services, ...entry.atendimentos.filter(Boolean)]))
          .sort((left, right) => left.localeCompare(right, 'pt-BR'));
        current.hitsCount = Object.keys(current.planPresence).length;
        rows.set(key, current);
      });
    });

    return Array.from(rows.values()).sort(compareNetworkCompareRows);
  }, [networkSummaryByItemId, selectedItems]);

  const networkSharedRowsCount = useMemo(
    () => networkComparisonRows.filter((row) => row.hitsCount === selectedItems.length).length,
    [networkComparisonRows, selectedItems.length],
  );

  const networkExclusiveRowsCount = useMemo(
    () => networkComparisonRows.filter((row) => row.hitsCount === 1).length,
    [networkComparisonRows],
  );

  const networkComparisonMatrixStyle = useMemo(
    () => ({ gridTemplateColumns: `minmax(280px, 1.4fr) repeat(${Math.max(selectedItems.length, 1)}, minmax(170px, 1fr))` }),
    [selectedItems.length],
  );

  const modalitiesSummary = useMemo(
    () => formatCotadorSelectedModalities(selectedItems),
    [selectedItems],
  );

  return (
    <div className={[
      'min-h-full bg-[linear-gradient(180deg,#fffaf4_0%,#f7efe3_100%)] p-8 text-[color:#23160e]',
      className ?? '',
    ].join(' ')}>
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-[color:#e8d7c1] bg-[linear-gradient(180deg,#fffdf9_0%,#f6ecde_100%)] shadow-[0_30px_80px_rgba(44,25,13,0.08)]">
          <div className="flex flex-col gap-6 px-8 py-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-[color:#ecd7b6] bg-[color:#fff7ec] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:#9b5d14]">
                <WalletCards className="h-4 w-4" />
                Cotação compartilhada
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[color:#23160e]">{payload.quote.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:#6d5544]">
                Compare os planos selecionados, veja o valor total da simulação e consulte os detalhes essenciais de cada opção.
              </p>
            </div>

            <div className="rounded-[28px] border border-[color:#e8d7c1] bg-white/90 px-5 py-4 shadow-[0_18px_40px_rgba(40,22,10,0.06)]">
              <PublicBrandMark className="h-8 w-auto text-[color:#7a3f18]" />
              <div className="mt-4 space-y-2 text-sm text-[color:#6d5544]">
                {modalitiesSummary ? <p><span className="font-semibold text-[color:#23160e]">Modalidades:</span> {modalitiesSummary}</p> : null}
                <p><span className="font-semibold text-[color:#23160e]">Vidas:</span> {payload.quote.totalLives}</p>
                <p><span className="font-semibold text-[color:#23160e]">Atualizada em:</span> {formatCotadorDateTime(sharedAt ?? payload.quote.updatedAt)}</p>
              </div>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:#9b5d14]">Planos cotados</p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:#23160e]">Resumo das opções</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {selectedItems.map((item) => {
              const networkCount = countCotadorUniqueNetworkProviders(item.redeHospitalar);
              const quotedAgeRows = Object.entries(payload.quote.ageDistribution)
                .filter(([, quantity]) => quantity > 0)
                .map(([ageRange, quantity]) => ({
                  ageRange,
                  quantity,
                  value: item.pricesByAgeRange[ageRange as CotadorAgeRange] ?? null,
                }));

              return (
                <article key={item.id} className="overflow-hidden rounded-[28px] border border-[color:#e8d7c1] bg-white shadow-[0_18px_50px_rgba(44,25,13,0.06)]">
                  <div className="border-b border-[color:#f0e4d4] px-6 py-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:#8d6f57]">{item.operadora.name ?? 'Operadora'}</p>
                    <p className="mt-1 text-sm text-[color:#6d5544]">{item.linha?.name ?? item.subtitulo ?? 'Linha'}</p>
                    <h3 className="mt-4 text-3xl font-semibold text-[color:#23160e]">{item.titulo}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.acomodacao ? <span className="rounded-full border border-[color:#eadbc7] bg-[color:#fbf4ea] px-3 py-1 text-xs font-semibold text-[color:#6d5544]">{item.acomodacao}</span> : null}
                      {item.coparticipacao ? <span className="rounded-full border border-[color:#eadbc7] bg-[color:#fbf4ea] px-3 py-1 text-xs font-semibold text-[color:#6d5544]">{formatCopart(item.coparticipacao)}</span> : null}
                      {item.abrangencia ? <span className="rounded-full border border-[color:#eadbc7] bg-[color:#fbf4ea] px-3 py-1 text-xs font-semibold text-[color:#6d5544]">{item.abrangencia}</span> : null}
                    </div>
                  </div>

                  <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <div className="rounded-3xl border border-[color:#f0e4d4] bg-[color:#fffaf4] px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:#8d6f57]">Mensalidade estimada</p>
                        <p className="mt-2 text-3xl font-semibold text-[color:#23160e]">{formatCotadorCurrency(item.estimatedMonthlyTotal)}</p>
                        <p className="mt-3 text-sm text-[color:#6d5544]">{networkCount > 0 ? `${networkCount} prestador(es) na rede` : 'Rede hospitalar não cadastrada'}</p>
                      </div>

                      {item.administradora?.name || item.entidadesClasse.length > 0 ? (
                        <div className="mt-4 rounded-3xl border border-[color:#f0e4d4] bg-[color:#fffaf4] px-4 py-4 text-sm text-[color:#6d5544]">
                          {item.administradora?.name ? <p><span className="font-semibold text-[color:#23160e]">Administradora:</span> {item.administradora.name}</p> : null}
                          {item.entidadesClasse.length > 0 ? <p className="mt-2"><span className="font-semibold text-[color:#23160e]">Entidades:</span> {item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ')}</p> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-3xl border border-[color:#f0e4d4] bg-[color:#fffaf4] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:#8d6f57]">Faixas cotadas</p>
                      {quotedAgeRows.length > 0 ? (
                        <div className="mt-3 space-y-2 text-sm">
                          {quotedAgeRows.map(({ ageRange, quantity, value }) => (
                            <div key={`${item.id}-${ageRange}`} className="grid grid-cols-[minmax(0,1fr)_56px_minmax(88px,auto)] items-center gap-3 border-b border-[color:#f3e8da] pb-2 last:border-b-0 last:pb-0">
                              <span className="font-medium text-[color:#6d5544]">{ageRange}</span>
                              <span className="text-center font-medium text-[color:#6d5544]">{quantity}x</span>
                              <span className="text-right font-semibold text-[color:#23160e]">{formatCotadorCurrency(value)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[color:#6d5544]">Nenhuma faixa etária foi preenchida nesta cotação.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {includeNetworkComparison && networkComparisonRows.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:#9b5d14]">Comparativo de rede</p>
              <h2 className="mt-2 text-2xl font-semibold text-[color:#23160e]">Prestadores por plano</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SummaryCard label="Prestadores únicos" value={`${networkComparisonRows.length}`} />
              <SummaryCard label="Em todos os planos" value={`${networkSharedRowsCount}`} />
              <SummaryCard label="Exclusivos" value={`${networkExclusiveRowsCount}`} />
            </div>

            <div className="overflow-hidden rounded-[32px] border border-[color:#e8d7c1] bg-white shadow-[0_18px_50px_rgba(44,25,13,0.06)]">
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid border-b border-[color:#f0e4d4] bg-[color:#fbf4ea]" style={networkComparisonMatrixStyle}>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:#8d6f57]">Prestador</p>
                      <p className="mt-1 text-sm font-semibold text-[color:#23160e]">Comparativo por plano</p>
                    </div>
                    {selectedItems.map((item) => (
                      <div key={item.id} className="border-l border-[color:#f0e4d4] px-5 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:#8d6f57]">{item.operadora.name ?? 'Operadora'}</p>
                        <p className="mt-1 text-sm font-semibold text-[color:#23160e]">{item.titulo}</p>
                      </div>
                    ))}
                  </div>

                  {networkComparisonRows.map((row) => (
                    <div key={row.key} className="grid" style={networkComparisonMatrixStyle}>
                      <div className="border-b border-[color:#f0e4d4] px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="rounded-2xl border border-[color:#eadbc7] bg-[color:#fff7ec] p-2 text-[color:#9b5d14]">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[color:#23160e]">{row.hospital}</p>
                              <span className="rounded-full border border-[color:#eadbc7] bg-[color:#fbf4ea] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:#6d5544]">
                                {row.hitsCount === selectedItems.length ? 'Em todos' : `${row.hitsCount}/${selectedItems.length}`}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[color:#6d5544]">{[row.bairro, row.regiao, row.cidade].filter(Boolean).join(' | ')}</p>
                          </div>
                        </div>
                      </div>

                      {selectedItems.map((item) => {
                        const presence = row.planPresence[item.id];

                        return (
                          <div key={`${row.key}-${item.id}`} className="border-b border-l border-[color:#f0e4d4] p-4">
                            {presence ? (
                              (() => {
                                const serviceSummary = summarizeCotadorNetworkServices(presence.services);

                                return (
                              <div className="rounded-2xl border border-[color:#e7d7c2] bg-[color:#fffaf4] p-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[color:#23160e]">
                                  <Check className="h-4 w-4 text-[color:#9b5d14]" />
                                  Na rede
                                </div>
                                {serviceSummary.hasStructuredInfo ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {serviceSummary.badges.map((service) => (
                                      <span key={`${row.key}-${item.id}-${service}`} className="rounded-full border border-[color:#eadbc7] bg-white px-2 py-0.5 text-[10px] font-medium text-[color:#6d5544]">
                                        {service}
                                      </span>
                                    ))}
                                  </div>
                                ) : <p className="mt-2 text-xs text-[color:#6d5544]">{serviceSummary.fallbackNote}</p>}
                              </div>
                                );
                              })()
                            ) : (
                              <div className="rounded-2xl border border-dashed border-[color:#eadbc7] bg-[color:#fbf4ea] p-3 text-sm font-medium text-[color:#8a6d57]">
                                Não consta
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {includeNetworkComparison && networkComparisonRows.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[color:#e2cbaa] bg-[color:#fff7ec] px-6 py-10 text-center text-sm text-[color:#6d5544]">
            O comparativo de rede foi habilitado, mas nenhum dos planos desta cotação possui prestadores cadastrados.
          </section>
        ) : null}
      </div>
    </div>
  );
}
