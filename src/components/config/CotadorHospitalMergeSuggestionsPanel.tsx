import { GitMerge } from 'lucide-react';
import Button from '../ui/Button';
import { Badge, Card } from '../../design-system';

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
    <Card padding="sm">
      <div className="flex flex-col gap-1">
        <p className="kds-card-subtitle text-xs uppercase tracking-[0.18em]">Sugestoes de merge</p>
        <p className="text-sm text-[var(--text-secondary)]">Duplicidades de alta confianca para consolidar aliases e vinculos de rede.</p>
      </div>
      <div className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.key} variant="muted" padding="sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={suggestion.confidence === 'high' ? 'success' : 'warning'}>
                    {suggestion.confidence === 'high' ? 'Alta confianca' : 'Media confianca'}
                  </Badge>
                  {suggestion.sharedLinkedProducts > 0 && (
                    <Badge tone="neutral">
                      {suggestion.sharedLinkedProducts} plano(s) em comum
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Card variant="muted" padding="sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Manter</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{suggestion.targetName}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{suggestion.targetLocation || suggestion.city}</p></Card>
                  <Card variant="muted" padding="sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Mesclar de</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{suggestion.sourceName}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{suggestion.sourceLocation || suggestion.city}</p></Card>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
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
          </Card>
        ))}
      </div>
    </Card>
  );
}
