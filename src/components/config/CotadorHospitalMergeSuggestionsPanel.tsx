import { GitMerge } from 'lucide-react';
import Button from '../ui/Button';

export type NetworkHospitalMergeSuggestion = {
  key: string;
  targetId: string;
  sourceId: string;
  targetName: string;
  sourceName: string;
  city: string;
  targetLocation: string;
  sourceLocation: string;
  confidence: 'high' | 'medium';
  reasons: string[];
  sharedLinkedProducts: number;
};

type CotadorHospitalMergeSuggestionsPanelProps = {
  suggestions: NetworkHospitalMergeSuggestion[];
  mergingHospitalKey: string | null;
  onMerge: (suggestion: NetworkHospitalMergeSuggestion) => void;
};

export default function CotadorHospitalMergeSuggestionsPanel({
  suggestions,
  mergingHospitalKey,
  onMerge,
}: CotadorHospitalMergeSuggestionsPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Sugestoes de merge</p>
        <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Duplicidades de alta confianca para consolidar aliases e vinculos de rede.</p>
      </div>
      <div className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.key} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={suggestion.confidence === 'high' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800' : 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800'}>
                    {suggestion.confidence === 'high' ? 'Alta confianca' : 'Media confianca'}
                  </span>
                  {suggestion.sharedLinkedProducts > 0 && (
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                      {suggestion.sharedLinkedProducts} plano(s) em comum
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[color:rgba(16,185,129,0.18)] bg-[color:rgba(16,185,129,0.08)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Manter</p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{suggestion.targetName}</p>
                    <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{suggestion.targetLocation || suggestion.city}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:rgba(245,158,11,0.18)] bg-[color:rgba(245,158,11,0.08)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">Mesclar de</p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{suggestion.sourceName}</p>
                    <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{suggestion.sourceLocation || suggestion.city}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                  {suggestion.reasons.map((reason) => (
                    <li key={`${suggestion.key}-${reason}`}>• {reason}</li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-2 self-end lg:self-auto">
                <Button
                  variant="secondary"
                  loading={mergingHospitalKey === suggestion.key}
                  disabled={Boolean(mergingHospitalKey && mergingHospitalKey !== suggestion.key)}
                  onClick={() => onMerge(suggestion)}
                >
                  <GitMerge className="h-4 w-4" />
                  Mesclar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
