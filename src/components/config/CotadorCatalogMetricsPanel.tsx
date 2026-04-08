type CotadorCatalogMetrics = {
  totalProducts: number;
  totalHospitals: number;
  totalQuotes: number;
  withoutNetwork: number;
  withoutPrice: number;
  withoutCarencias: number;
  withoutDocuments: number;
  withoutReembolso: number;
  hospitalsWithoutBairro: number;
  hospitalsWithoutRegiao: number;
  hospitalsSuspectBairro: number;
  mergeSuggestions: number;
  completeProducts: number;
  inactiveTables: number;
  outdatedQuoteItems: number;
  importFailureCount: number;
  quoteBreakdown: {
    pf: number;
    adesao: number;
    pme: number;
  };
};

type CotadorCatalogMetricsPanelProps = {
  metrics: CotadorCatalogMetrics;
};

function MetricCard({ title, value, helper }: { title: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{helper}</p>
    </div>
  );
}

export type { CotadorCatalogMetrics };

export default function CotadorCatalogMetricsPanel({ metrics }: CotadorCatalogMetricsPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <MetricCard title="Produtos sem rede" value={metrics.withoutNetwork} helper={`de ${metrics.totalProducts} produto(s)`} />
      <MetricCard title="Produtos sem preco" value={metrics.withoutPrice} helper="sem tabela ativa com valor" />
      <MetricCard title="Produtos sem carencia" value={metrics.withoutCarencias} helper="informacao comercial pendente" />
      <MetricCard title="Documentacao" value={metrics.withoutDocuments} helper="produto(s) sem documentos" />
      <MetricCard title="Produtos sem reembolso" value={metrics.withoutReembolso} helper="politica de reembolso pendente" />
      <MetricCard title="Hospitais sem bairro" value={metrics.hospitalsWithoutBairro} helper={`de ${metrics.totalHospitals} hospital(is)`} />
      <MetricCard title="Hospitais sem regiao" value={metrics.hospitalsWithoutRegiao} helper="cadastros com localizacao parcial" />
      <MetricCard title="Bairro suspeito" value={metrics.hospitalsSuspectBairro} helper="enderecos com chance de correcao manual" />
      <MetricCard title="Sugestoes de merge" value={metrics.mergeSuggestions} helper="duplicidades candidatas a consolidacao" />
      <MetricCard title="Cotacoes salvas" value={metrics.totalQuotes} helper={`PF ${metrics.quoteBreakdown.pf} | ADESAO ${metrics.quoteBreakdown.adesao} | PME ${metrics.quoteBreakdown.pme}`} />
      <MetricCard title="Produtos completos" value={metrics.completeProducts} helper="cadastros com rede, preco e informacoes comerciais" />
      <MetricCard title="Alertas operacionais" value={metrics.outdatedQuoteItems + metrics.inactiveTables + metrics.importFailureCount} helper={`${metrics.outdatedQuoteItems} item(ns) desatualizado(s) | ${metrics.inactiveTables} tabela(s) inativa(s) | ${metrics.importFailureCount} falha(s) de importacao`} />
    </div>
  );
}
