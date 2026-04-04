import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Calculator, FileText, Save, Users } from 'lucide-react';
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
  onClose: () => void;
  onSubmit: (input: CotadorQuoteInput) => void;
};

const stepDefinitions = [
  {
    title: 'Nome da cotacao',
    description: 'Como essa cotacao vai aparecer no seu workspace.',
    icon: FileText,
  },
  {
    title: 'Faixas etarias',
    description: 'Distribua as vidas usando a grade da tabela ANS.',
    icon: Users,
  },
  {
    title: 'Tipo da cotacao',
    description: 'Escolha se a cotacao e PF, Adesao ou PME.',
    icon: Calculator,
  },
] as const;

export default function CotadorCreateQuoteModal({
  isOpen,
  mode,
  initialDraft,
  onClose,
  onSubmit,
}: CotadorCreateQuoteModalProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CotadorQuoteDraft>(initialDraft);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep(0);
    setDraft(initialDraft);
  }, [initialDraft, isOpen]);

  const totalLives = useMemo(() => getCotadorTotalLives(draft.ageDistribution), [draft.ageDistribution]);
  const filledRanges = useMemo(() => getCotadorFilledAgeRanges(draft.ageDistribution), [draft.ageDistribution]);
  const activeStep = stepDefinitions[step];
  const isLastStep = step === stepDefinitions.length - 1;

  const canAdvance =
    step === 0
      ? draft.name.trim().length >= 3
      : step === 1
        ? totalLives > 0
        : draft.modality !== null;

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

  const handleNext = () => {
    if (!canAdvance) {
      return;
    }

    if (isLastStep) {
      if (!draft.modality) {
        return;
      }

      onSubmit({
        name: draft.name.trim(),
        modality: draft.modality,
        ageDistribution: sanitizeCotadorAgeDistribution(draft.ageDistribution),
      });
      return;
    }

    setStep((current) => current + 1);
  };

  const footer = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-[color:var(--panel-text-muted,#876f5c)]">
        Etapa {step + 1} de {stepDefinitions.length}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}
        <Button onClick={handleNext} disabled={!canAdvance}>
          {isLastStep ? (
            <>
              <Save className="h-4 w-4" />
              {mode === 'create' ? 'Criar cotacao' : 'Salvar cotacao'}
            </>
          ) : (
            <>
              Proxima etapa
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Nova cotacao' : 'Editar cotacao'}
      description="O fluxo inicial coleta nome, vidas por faixa etaria e o tipo da cotacao antes de abrir o seletor."
      size="lg"
      footer={footer}
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-[color:var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,rgba(253,230,195,0.95),rgba(255,253,250,0.95)_55%,rgba(247,240,231,0.98)_100%)] p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.3)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
                <activeStep.icon className="h-3.5 w-3.5" />
                {activeStep.title}
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{activeStep.title}</h3>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--panel-text-soft,#5b4635)]">{activeStep.description}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {stepDefinitions.map((item, index) => {
                const isActive = index === step;
                const isComplete = index < step;

                return (
                  <div
                    key={item.title}
                    className={cx(
                      'rounded-2xl border px-3 py-2 text-center transition-colors',
                      isActive
                        ? 'border-[var(--panel-accent-strong,#b85c1f)] bg-[color:rgba(239,207,159,0.7)] text-[var(--panel-accent-ink-strong,#4a2411)]'
                        : isComplete
                          ? 'border-emerald-300/80 bg-emerald-50 text-emerald-900'
                          : 'border-[color:rgba(157,127,90,0.18)] bg-[color:rgba(255,253,250,0.68)] text-[color:var(--panel-text-muted,#876f5c)]',
                    )}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">Etapa {index + 1}</div>
                    <div className="mt-1 text-xs font-medium">{item.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-4 rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[color:var(--panel-text,#1a120d)]" htmlFor="cotador-quote-name">
                Nome da cotacao
              </label>
              <Input
                id="cotador-quote-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ex: Familia Souza | Bradesco e SulAmerica"
                invalid={draft.name.trim().length > 0 && draft.name.trim().length < 3}
                autoFocus
              />
            </div>
            <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              Use um nome facil de reconhecer depois. Exemplo: cliente, cidade ou foco da analise.
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Quantidade de vidas por faixa etaria</h4>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                  Distribua as vidas conforme a grade usada pela ANS para abrir o seletor ja no contexto correto.
                </p>
              </div>
              <div className={cx(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
                totalLives > 0
                  ? 'border-emerald-300/90 bg-emerald-50 text-emerald-900'
                  : 'border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.72)] text-[color:var(--panel-text-muted,#876f5c)]',
              )}>
                <Users className="h-3.5 w-3.5" />
                Total de vidas: {totalLives}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {COTADOR_AGE_RANGES.map((range) => {
                const value = draft.ageDistribution[range];

                return (
                  <div key={range} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Faixa</p>
                    <p className="mt-1 text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{range}</p>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      pattern="\d*"
                      value={value > 0 ? String(value) : ''}
                      onChange={(event) => updateAgeRange(range, event.target.value)}
                      className="mt-3 h-11 w-full rounded-xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 text-sm text-[color:var(--panel-text,#1a120d)] shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)]"
                      placeholder="Qtd."
                    />
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-dashed border-[color:rgba(157,127,90,0.35)] bg-[color:rgba(255,253,250,0.82)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              {filledRanges.length > 0
                ? `Distribuicao atual: ${filledRanges.join(' | ')}`
                : 'Preencha ao menos uma faixa etaria para seguir.'}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div>
              <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Qual o tipo da cotacao?</h4>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Essa escolha direciona o seletor para o contexto comercial certo logo na abertura.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {COTADOR_MODALITY_OPTIONS.map((option) => {
                const isSelected = draft.modality === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, modality: option.value }))}
                    className={cx(
                      'rounded-3xl border p-4 text-left transition-all',
                      isSelected
                        ? 'border-[var(--panel-accent-strong,#b85c1f)] bg-[color:rgba(239,207,159,0.62)] shadow-md'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[var(--panel-surface,#fffdfa)]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{option.label}</span>
                      <span className={cx(
                        'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
                        isSelected
                          ? 'bg-[color:rgba(74,36,17,0.92)] text-white'
                          : 'bg-[color:rgba(255,253,250,0.9)] text-[color:var(--panel-text-muted,#876f5c)]',
                      )}>
                        {isSelected ? 'Selecionado' : 'Escolher'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{option.description}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--panel-text-muted,#876f5c)]">{option.helper}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              PME entra como guarda-chuva para MEI, CNPJ e empresarial nesta primeira versao do seletor.
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
