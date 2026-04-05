import { useEffect, useMemo, useState } from 'react';
import { FileText, Save, Users } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { isPanelDarkTheme } from '../../../components/ui/dropdownStyles';
import { COTADOR_AGE_RANGES, type CotadorAgeRange } from '../shared/cotadorConstants';
import { getCotadorFilledAgeRanges, getCotadorTotalLives, sanitizeCotadorAgeDistribution } from '../shared/cotadorUtils';
import type { CotadorQuoteDraft, CotadorQuoteInput } from '../shared/cotadorTypes';

type CotadorCreateQuoteModalProps = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialDraft: CotadorQuoteDraft;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: CotadorQuoteInput) => void;
};

export default function CotadorCreateQuoteModal({
  isOpen,
  mode,
  initialDraft,
  busy = false,
  onClose,
  onSubmit,
}: CotadorCreateQuoteModalProps) {
  const [draft, setDraft] = useState<CotadorQuoteDraft>(initialDraft);
  const isDarkTheme = isPanelDarkTheme();

  useEffect(() => {
    if (!isOpen) return;
    setDraft({
      ...initialDraft,
      modality: initialDraft.modality ?? 'PME',
    });
  }, [initialDraft, isOpen]);

  const totalLives = useMemo(() => getCotadorTotalLives(draft.ageDistribution), [draft.ageDistribution]);
  const filledRanges = useMemo(() => getCotadorFilledAgeRanges(draft.ageDistribution), [draft.ageDistribution]);
  const canSubmit = draft.name.trim().length >= 3 && totalLives > 0;

  const updateAgeRange = (range: CotadorAgeRange, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    const nextValue = digitsOnly ? Number.parseInt(digitsOnly, 10) : 0;

    setDraft((current) => ({
      ...current,
      ageDistribution: {
        ...current.ageDistribution,
        [range]: Number.isFinite(nextValue) ? nextValue : 0,
      },
    }));
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Nova cotação' : 'Editar cotação'}
      description="Defina o nome da cotação e distribua as vidas para comparar diferentes opções comerciais no mesmo cenário."
      size="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[color:var(--panel-text-muted,#876f5c)]">
            {filledRanges.length > 0 ? filledRanges.join(' | ') : 'Preencha ao menos uma faixa etária para continuar'}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onSubmit({
                  name: draft.name.trim(),
                  modality: draft.modality ?? 'PME',
                  ageDistribution: sanitizeCotadorAgeDistribution(draft.ageDistribution),
                });
              }}
              disabled={!canSubmit}
              loading={busy}
            >
              <Save className="h-4 w-4" />
              {mode === 'create' ? 'Criar cotação' : 'Salvar cotação'}
            </Button>
          </div>
        </div>
      }
    >
      <div>
        <section className={isDarkTheme
          ? 'space-y-5 rounded-[28px] border border-[color:rgba(255,255,255,0.08)] bg-[radial-gradient(circle_at_top_left,rgba(180,83,9,0.22),rgba(36,24,18,0.96)_48%,rgba(20,15,12,0.98)_100%)] p-5 shadow-sm'
          : 'space-y-5 rounded-[28px] border border-[color:var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.95)_55%,rgba(247,240,231,0.98)_100%)] p-5 shadow-sm'}>
          <div>
            <div className={isDarkTheme
              ? 'inline-flex items-center gap-2 rounded-full border border-[color:rgba(251,191,36,0.18)] bg-[color:rgba(255,255,255,0.06)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:#f4c95d]'
              : 'inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.28)] bg-[color:rgba(255,253,250,0.84)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]'}>
              <Users className="h-3.5 w-3.5" />
              Distribuição de vidas
            </div>
            <h3 className={isDarkTheme ? 'mt-3 text-2xl font-semibold text-[color:#fff8ef]' : 'mt-3 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]'}>Nova cotação</h3>
          </div>

          <div>
            <label className={isDarkTheme ? 'mb-2 flex items-center gap-2 text-sm font-semibold text-[color:#fff3d1]' : 'mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]'} htmlFor="cotador-quote-name">
              <FileText className="h-4 w-4" />
              Nome da cotação
            </label>
            <Input
              id="cotador-quote-name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Família Souza | Análise PME"
              invalid={draft.name.trim().length > 0 && draft.name.trim().length < 3}
              autoFocus
              className={isDarkTheme ? '[--panel-input-text:#fff8ef] [--panel-placeholder:rgba(255,243,209,0.42)] border-[color:rgba(255,255,255,0.1)] bg-[color:rgba(24,16,12,0.88)] text-[color:#fff8ef] shadow-none placeholder:text-[color:rgba(255,243,209,0.42)] focus:border-[color:rgba(251,191,36,0.34)] focus:ring-[color:rgba(251,191,36,0.26)]' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {COTADOR_AGE_RANGES.map((range) => {
              const value = draft.ageDistribution[range];
              return (
                <div key={range} className={isDarkTheme ? 'rounded-2xl border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(24,16,12,0.92)] p-3 shadow-sm' : 'rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-3 shadow-sm'}>
                  <p className={isDarkTheme ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:rgba(255,243,209,0.62)]' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]'}>Faixa</p>
                  <p className={isDarkTheme ? 'mt-1 text-base font-semibold text-[color:#fff8ef]' : 'mt-1 text-base font-semibold text-[color:var(--panel-text,#1a120d)]'}>{range}</p>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    pattern="\d*"
                    value={value > 0 ? String(value) : ''}
                    onChange={(event) => updateAgeRange(range, event.target.value)}
                    className={isDarkTheme
                      ? 'mt-3 h-11 w-full rounded-xl border border-[color:rgba(251,191,36,0.38)] bg-[color:rgba(36,24,18,0.96)] px-3 text-sm text-[color:#fff3d1] shadow-none transition-all placeholder:text-[color:rgba(255,243,209,0.36)] focus:border-[color:rgba(251,191,36,0.46)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(251,191,36,0.22)]'
                      : 'mt-3 h-11 w-full rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 text-sm text-[color:var(--panel-text,#1a120d)] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]'}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
