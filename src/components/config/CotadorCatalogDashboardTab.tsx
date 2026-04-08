import { Activity, AlertTriangle, BarChart3, Building2, Database, FileWarning, GitMerge, Layers3, ShieldCheck } from 'lucide-react';
import type { CotadorCatalogMetrics } from './CotadorCatalogMetricsPanel';

type CotadorCatalogDashboardTabProps = {
  metrics: CotadorCatalogMetrics;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function buildCoverage(total: number, missing: number) {
  if (total <= 0) return 0;
  return ((total - missing) / total) * 100;
}

function DashboardKpiCard({
  title,
  value,
  helper,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  helper: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200/70 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))] dark:border-emerald-400/20 dark:bg-[linear-gradient(180deg,rgba(18,57,43,0.92),rgba(20,15,11,0.96))]'
    : tone === 'warning'
      ? 'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.96))] dark:border-amber-300/20 dark:bg-[linear-gradient(180deg,rgba(84,52,15,0.9),rgba(20,15,11,0.96))]'
      : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[linear-gradient(180deg,var(--panel-surface,#fffdfa),color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_62%,var(--panel-surface,#fffdfa)))] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[linear-gradient(180deg,rgba(40,29,22,0.96),rgba(26,20,16,0.98))]';

  return (
    <div className={`rounded-3xl border px-4 py-4 shadow-sm ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.62)]">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{value}</p>
      <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.74)]">{helper}</p>
    </div>
  );
}

function MetricBar({ label, value, helper, accent }: { label: string; value: number; helper: string; accent: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{label}</p>
          <p className="text-xs text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.74)]">{helper}</p>
        </div>
        <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{formatPercent(value)}</p>
      </div>
      <div className="h-2 rounded-full bg-[var(--panel-surface-soft,#f4ede3)] dark:bg-[color:rgba(255,255,255,0.08)]">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export default function CotadorCatalogDashboardTab({ metrics }: CotadorCatalogDashboardTabProps) {
  const networkCoverage = buildCoverage(metrics.totalProducts, metrics.withoutNetwork);
  const priceCoverage = buildCoverage(metrics.totalProducts, metrics.withoutPrice);
  const carenciaCoverage = buildCoverage(metrics.totalProducts, metrics.withoutCarencias);
  const documentsCoverage = buildCoverage(metrics.totalProducts, metrics.withoutDocuments);
  const reembolsoCoverage = buildCoverage(metrics.totalProducts, metrics.withoutReembolso);
  const completeCoverage = buildCoverage(metrics.totalProducts, metrics.totalProducts - metrics.completeProducts);
  const totalQuotesByModality = metrics.quoteBreakdown.pf + metrics.quoteBreakdown.adesao + metrics.quoteBreakdown.pme;
  const alertsCount = metrics.outdatedQuoteItems + metrics.inactiveTables + metrics.importFailureCount;

  const modalityBars = [
    { label: 'PF', value: metrics.quoteBreakdown.pf },
    { label: 'ADESAO', value: metrics.quoteBreakdown.adesao },
    { label: 'PME', value: metrics.quoteBreakdown.pme },
  ].map((item) => ({
    ...item,
    percent: totalQuotesByModality > 0 ? (item.value / totalQuotesByModality) * 100 : 0,
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.96)_48%,rgba(247,240,231,0.99)_100%)] p-6 shadow-sm md:p-8 dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[radial-gradient(circle_at_top_left,rgba(133,77,14,0.24),rgba(28,20,14,0.96)_40%,rgba(20,15,11,0.99)_100%)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(251,191,36,0.18)] dark:bg-[color:rgba(251,191,36,0.12)] dark:text-[color:#fde68a]">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard do cotador
            </div>
            <h3 className="mt-4 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">Saúde do catálogo e operação do módulo</h3>
            <p className="mt-3 text-sm leading-6 text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.76)]">
              Acompanhe cobertura comercial, qualidade da rede, risco de desatualização e o volume de cotações salvas sem sair das configurações.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[440px] xl:max-w-[520px]">
            <DashboardKpiCard title="Cobertura completa" value={formatPercent(completeCoverage)} helper={`${metrics.completeProducts} produto(s) completos`} tone={completeCoverage >= 70 ? 'success' : 'warning'} />
            <DashboardKpiCard title="Alertas" value={alertsCount} helper="itens desatualizados, inativos e falhas" tone={alertsCount > 0 ? 'warning' : 'success'} />
            <DashboardKpiCard title="Hospitais auditados" value={metrics.totalHospitals} helper={`${metrics.mergeSuggestions} sugestao(oes) de merge`} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_84%,var(--panel-surface,#fffdfa))] p-2.5 text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.04)] dark:text-[color:#f3c892]">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.62)]">Cobertura do catálogo</p>
              <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">O que já está pronto para cotar</h4>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <MetricBar label="Rede" value={networkCoverage} helper={`${metrics.withoutNetwork} produto(s) sem rede`} accent="bg-[linear-gradient(90deg,#8b5e34,#c9873f)]" />
            <MetricBar label="Preço" value={priceCoverage} helper={`${metrics.withoutPrice} produto(s) sem cobertura de preco esperada`} accent="bg-[linear-gradient(90deg,#a0642b,#d08d41)]" />
            <MetricBar label="Carência" value={carenciaCoverage} helper={`${metrics.withoutCarencias} produto(s) sem carência`} accent="bg-[linear-gradient(90deg,#8f5b24,#bb7b2d)]" />
            <MetricBar label="Documentos" value={documentsCoverage} helper={`${metrics.withoutDocuments} produto(s) sem documentos`} accent="bg-[linear-gradient(90deg,#7e4a1a,#b16d28)]" />
            <MetricBar label="Reembolso" value={reembolsoCoverage} helper={`${metrics.withoutReembolso} produto(s) sem reembolso`} accent="bg-[linear-gradient(90deg,#6e4217,#a66222)]" />
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_84%,var(--panel-surface,#fffdfa))] p-2.5 text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.04)] dark:text-[color:#f3c892]">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.62)]">Cotações salvas</p>
              <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">Distribuição por modalidade</h4>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {modalityBars.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{item.label}</p>
                  <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.74)]">{item.value}</p>
                </div>
                <div className="h-2 rounded-full bg-[var(--panel-surface-soft,#f4ede3)] dark:bg-[color:rgba(255,255,255,0.08)]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#7b4a1d,#c9873f)]" style={{ width: `${Math.min(100, Math.max(6, item.percent))}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <DashboardKpiCard title="Itens desatualizados" value={metrics.outdatedQuoteItems} helper="shortlists que perderam o item ativo" tone={metrics.outdatedQuoteItems > 0 ? 'warning' : 'success'} />
            <DashboardKpiCard title="Falhas de importação" value={metrics.importFailureCount} helper="contagem da sessão atual" tone={metrics.importFailureCount > 0 ? 'warning' : 'success'} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_84%,var(--panel-surface,#fffdfa))] p-2.5 text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.04)] dark:text-[color:#f3c892]">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.62)]">Qualidade da rede</p>
              <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">Cadastros hospitalares compartilhados</h4>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DashboardKpiCard title="Sem bairro" value={metrics.hospitalsWithoutBairro} helper="hospitais com localização parcial" tone={metrics.hospitalsWithoutBairro > 0 ? 'warning' : 'success'} />
            <DashboardKpiCard title="Sem regiao" value={metrics.hospitalsWithoutRegiao} helper="cadastros sem classificação regional" tone={metrics.hospitalsWithoutRegiao > 0 ? 'warning' : 'success'} />
            <DashboardKpiCard title="Bairro suspeito" value={metrics.hospitalsSuspectBairro} helper="endereços com chance de revisão" tone={metrics.hospitalsSuspectBairro > 0 ? 'warning' : 'success'} />
            <DashboardKpiCard title="Sugestões de merge" value={metrics.mergeSuggestions} helper="duplicidades candidatas a consolidação" tone={metrics.mergeSuggestions > 0 ? 'warning' : 'success'} />
          </div>
        </section>

        <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_84%,var(--panel-surface,#fffdfa))] p-2.5 text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.04)] dark:text-[color:#f3c892]">
              <FileWarning className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.62)]">Prioridades</p>
              <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">O que atacar primeiro</h4>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              {
                icon: Layers3,
                title: 'Produtos sem rede',
                description: `${metrics.withoutNetwork} produto(s) ainda sem hospital vinculado`,
              },
              {
                icon: AlertTriangle,
                title: 'Alertas operacionais',
                description: `${metrics.outdatedQuoteItems} item(ns) desatualizado(s), ${metrics.inactiveTables} tabela(s) inativa(s) e ${metrics.importFailureCount} falha(s) de importação`,
              },
              {
                icon: GitMerge,
                title: 'Merge de hospitais',
                description: `${metrics.mergeSuggestions} sugestão(ões) pronta(s) para consolidar duplicidade`,
              },
              {
                icon: ShieldCheck,
                title: 'Produtos completos',
                description: `${metrics.completeProducts} produto(s) com rede, preço e documentação em dia`,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3 dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.04)]">
                  <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.05)] dark:text-[color:#f3c892]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{item.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.74)]">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
