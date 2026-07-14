import { Activity, AlertTriangle, BarChart3, Building2, Database, FileWarning, GitMerge, Layers3, ShieldCheck } from 'lucide-react';
import { Badge, Card } from '../../design-system';
import type { CotadorCatalogMetrics } from './CotadorCatalogMetricsPanel';

type CotadorCatalogDashboardTabProps = { metrics: CotadorCatalogMetrics };

const formatPercent = (value: number) => `${Math.round(value)}%`;
const buildCoverage = (total: number, missing: number) => total > 0 ? ((total - missing) / total) * 100 : 0;

function DashboardKpiCard({ title, value, helper, tone = 'default' }: { title: string; value: string | number; helper: string; tone?: 'default' | 'success' | 'warning' }) {
  return (
    <Card variant={tone === 'default' ? 'muted' : 'default'} padding="sm" className="min-h-[132px]">
      <p className="kds-card-subtitle text-[10px] uppercase tracking-[0.16em]">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{helper}</p>
    </Card>
  );
}

function MetricBar({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p><p className="text-xs text-[var(--text-secondary)]">{helper}</p></div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{formatPercent(value)}</p>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-muted)]"><div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title }: { icon: typeof Database; eyebrow: string; title: string }) {
  return <div className="flex items-center gap-3"><div className="kds-card-icon"><Icon className="h-4 w-4" /></div><div><p className="kds-card-subtitle text-xs uppercase tracking-[0.18em]">{eyebrow}</p><h4 className="kds-card-title mt-1">{title}</h4></div></div>;
}

export default function CotadorCatalogDashboardTab({ metrics }: CotadorCatalogDashboardTabProps) {
  const coverages = [
    ['Rede', metrics.withoutNetwork, 'produto(s) sem rede'], ['Preço', metrics.withoutPrice, 'produto(s) sem cobertura de preço esperada'], ['Carência', metrics.withoutCarencias, 'produto(s) sem carência'], ['Documentos', metrics.withoutDocuments, 'produto(s) sem documentos'], ['Reembolso', metrics.withoutReembolso, 'produto(s) sem reembolso'],
  ] as const;
  const totalQuotes = metrics.quoteBreakdown.pf + metrics.quoteBreakdown.adesao + metrics.quoteBreakdown.pme;
  const alertsCount = metrics.outdatedQuoteItems + metrics.inactiveTables + metrics.importFailureCount;
  const priorities = [
    { icon: Layers3, title: 'Produtos sem rede', description: `${metrics.withoutNetwork} produto(s) ainda sem hospital vinculado` },
    { icon: AlertTriangle, title: 'Alertas operacionais', description: `${metrics.outdatedQuoteItems} item(ns) desatualizado(s), ${metrics.inactiveTables} tabela(s) inativa(s) e ${metrics.importFailureCount} falha(s) de importação` },
    { icon: GitMerge, title: 'Merge de hospitais', description: `${metrics.mergeSuggestions} sugestão(ões) pronta(s) para consolidar duplicidade` },
    { icon: ShieldCheck, title: 'Produtos completos', description: `${metrics.completeProducts} produto(s) com rede, preço e documentação em dia` },
  ];

  return <div className="space-y-5">
    <Card variant="default" padding="lg"><div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between"><div className="max-w-3xl"><Badge tone="gold" icon={BarChart3}>Dashboard do cotador</Badge><h3 className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">Saúde do catálogo e operação do módulo</h3><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Acompanhe cobertura comercial, qualidade da rede, risco de desatualização e o volume de cotações salvas sem sair das configurações.</p></div><div className="grid gap-3 sm:grid-cols-3 xl:min-w-[440px]"><DashboardKpiCard title="Cobertura completa" value={formatPercent(buildCoverage(metrics.totalProducts, metrics.totalProducts - metrics.completeProducts))} helper={`${metrics.completeProducts} produto(s) completos`} tone="success" /><DashboardKpiCard title="Alertas" value={alertsCount} helper="itens desatualizados, inativos e falhas" tone={alertsCount > 0 ? 'warning' : 'success'} /><DashboardKpiCard title="Hospitais auditados" value={metrics.totalHospitals} helper={`${metrics.mergeSuggestions} sugestão(ões) de merge`} /></div></div></Card>
    <div className="grid gap-4 xl:grid-cols-2"><Card><SectionHeading icon={Database} eyebrow="Cobertura do catálogo" title="O que já está pronto para cotar" /><div className="mt-5 space-y-4">{coverages.map(([label, missing, helper]) => <MetricBar key={label} label={label} value={buildCoverage(metrics.totalProducts, missing)} helper={`${missing} ${helper}`} />)}</div></Card><Card><SectionHeading icon={Activity} eyebrow="Cotações salvas" title="Distribuição por modalidade" /><div className="mt-5 space-y-4">{[['PF', metrics.quoteBreakdown.pf], ['ADESAO', metrics.quoteBreakdown.adesao], ['PME', metrics.quoteBreakdown.pme]].map(([label, value]) => <MetricBar key={String(label)} label={String(label)} value={totalQuotes ? (Number(value) / totalQuotes) * 100 : 0} helper={`${value} cotação(ões)`} />)}</div></Card></div>
    <div className="grid gap-4 xl:grid-cols-2"><Card><SectionHeading icon={Building2} eyebrow="Qualidade da rede" title="Cadastros hospitalares compartilhados" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><DashboardKpiCard title="Sem bairro" value={metrics.hospitalsWithoutBairro} helper="hospitais com localização parcial" tone="warning" /><DashboardKpiCard title="Sem região" value={metrics.hospitalsWithoutRegiao} helper="cadastros sem classificação regional" tone="warning" /><DashboardKpiCard title="Bairro suspeito" value={metrics.hospitalsSuspectBairro} helper="endereços com chance de revisão" tone="warning" /><DashboardKpiCard title="Sugestões de merge" value={metrics.mergeSuggestions} helper="duplicidades candidatas a consolidação" tone="warning" /></div></Card><Card><SectionHeading icon={FileWarning} eyebrow="Prioridades" title="O que atacar primeiro" /><div className="mt-5 space-y-3">{priorities.map(({ icon: Icon, title, description }) => <Card key={title} variant="muted" padding="sm" className="flex items-start gap-3"><div className="kds-card-icon"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p></div></Card>)}</div></Card></div>
  </div>;
}
