import { useEffect, useMemo, useState } from 'react';
import { Calculator, FileText, Save, Users } from 'lucide-react';
import { cx } from '../../../lib/cx';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { COTADOR_AGE_RANGES, COTADOR_MODALITY_OPTIONS, type CotadorAgeRange } from '../shared/cotadorConstants';
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

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialDraft);
  }, [initialDraft, isOpen]);

  const totalLives = useMemo(() => getCotadorTotalLives(draft.ageDistribution), [draft.ageDistribution]);
  const filledRanges = useMemo(() => getCotadorFilledAgeRanges(draft.ageDistribution), [draft.ageDistribution]);
  const canSubmit = draft.name.trim().length >= 3 && totalLives > 0 && draft.modality !== null;

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
      title={mode === 'create' ? 'Nova cotacao' : 'Editar cotacao'}
      description="Defina o nome, distribua as vidas e escolha o contexto comercial inicial da cotacao."
      size="xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[color:var(--panel-text-muted,#876f5c)]">
            {filledRanges.length > 0 ? filledRanges.join(' | ') : 'Preencha ao menos uma faixa etaria para continuar'}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!draft.modality) return;
                onSubmit({
                  name: draft.name.trim(),
                  modality: draft.modality,
                  ageDistribution: sanitizeCotadorAgeDistribution(draft.ageDistribution),
                });
              }}
              disabled={!canSubmit}
              loading={busy}
            >
              <Save className="h-4 w-4" />
              {mode === 'create' ? 'Criar cotacao' : 'Salvar cotacao'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <section className="space-y-5 rounded-[28px] border border-[color:var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.95)_55%,rgba(247,240,231,0.98)_100%)] p-5 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.28)] bg-[color:rgba(255,253,250,0.84)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Users className="h-3.5 w-3.5" />
              Distribuicao de vidas
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Monte a cotacao com o contexto certo logo no inicio</h3>
            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              O nome ajuda a organizar o histórico e a grade abaixo define como as tabelas do Cotador serão filtradas depois.
            </p>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]" htmlFor="cotador-quote-name">
              <FileText className="h-4 w-4" />
              Nome da cotacao
            </label>
            <Input
              id="cotador-quote-name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Familia Souza | Analise PME"
              invalid={draft.name.trim().length > 0 && draft.name.trim().length < 3}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {COTADOR_AGE_RANGES.map((range) => {
              const value = draft.ageDistribution[range];
              return (
                <div key={range} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Faixa</p>
                  <p className="mt-1 text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{range}</p>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    pattern="\d*"
                    value={value > 0 ? String(value) : ''}
                    onChange={(event) => updateAgeRange(range, event.target.value)}
                    className="mt-3 h-11 w-full rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 text-sm text-[color:var(--panel-text,#1a120d)] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]"
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-5 rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-5 shadow-sm">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.2)] bg-[color:rgba(246,228,199,0.5)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Calculator className="h-3.5 w-3.5" />
              Contexto comercial
            </div>
            <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              Escolha o tipo inicial da cotacao. Depois, dentro da cotacao, voce pode refinar operadora, linha, produto e tabela.
            </p>
          </div>

          <div className="grid gap-3">
            {COTADOR_MODALITY_OPTIONS.map((option) => {
              const isSelected = draft.modality === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, modality: option.value }))}
                  className={cx(
                    'cursor-pointer rounded-2xl border p-4 text-left transition-all',
                    isSelected
                      ? 'border-[var(--panel-accent-strong,#b85c1f)] bg-[color:rgba(239,207,159,0.56)] shadow-sm'
                      : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[var(--panel-surface,#fffdfa)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{option.label}</span>
                    <span className={cx(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                      isSelected ? 'bg-[color:rgba(74,36,17,0.92)] text-white' : 'bg-white text-[color:var(--panel-text-muted,#876f5c)]',
                    )}>
                      {isSelected ? 'Selecionado' : 'Escolher'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[color:rgba(157,127,90,0.18)] bg-[color:var(--panel-surface-soft,#f4ede3)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Resumo rapido</p>
            <div className="mt-3 space-y-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              <p>Total de vidas: <span className="font-semibold text-[color:var(--panel-text,#1a120d)]">{totalLives}</span></p>
              <p>Faixas preenchidas: <span className="font-semibold text-[color:var(--panel-text,#1a120d)]">{filledRanges.length}</span></p>
              <p>Tipo selecionado: <span className="font-semibold text-[color:var(--panel-text,#1a120d)]">{draft.modality ?? 'Nao definido'}</span></p>
            </div>
          </div>
        </aside>
      </div>
    </ModalShell>
  );
}
