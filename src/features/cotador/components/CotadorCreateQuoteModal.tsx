import { useEffect, useMemo, useState } from 'react';
import { Save, UserRound, Users } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import { Button, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Surface } from '../../../design-system';
import { COTADOR_AGE_RANGES, type CotadorAgeRange } from '../shared/cotadorConstants';
import { getCotadorFilledAgeRanges, getCotadorTotalLives, sanitizeCotadorAgeDistribution } from '../shared/cotadorUtils';
import type { CotadorQuoteDraft, CotadorQuoteInput } from '../shared/cotadorTypes';

type CotadorCreateQuoteModalProps = {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialDraft: CotadorQuoteDraft;
  leadOptions: Array<{ value: string; label: string }>;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (input: CotadorQuoteInput) => void;
};

export default function CotadorCreateQuoteModal({
  isOpen,
  mode,
  initialDraft,
  leadOptions,
  busy = false,
  onClose,
  onSubmit,
}: CotadorCreateQuoteModalProps) {
  const [draft, setDraft] = useState<CotadorQuoteDraft>(initialDraft);

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} size="xl">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{mode === 'create' ? 'Nova cotação' : 'Editar cotação'}</DialogTitle>
        <DialogDescription>Defina o nome da cotação e distribua as vidas para comparar opções comerciais no mesmo cenário.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Surface variant="muted" className="space-y-5" padding="md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"><Users className="h-3.5 w-3.5" />Distribuição de vidas</div>
          <Field label="Nome da cotação" htmlFor="cotador-quote-name">
            <Input id="cotador-quote-name" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Família Souza | Análise PME" state={draft.name.trim().length > 0 && draft.name.trim().length < 3 ? 'error' : 'default'} autoFocus />
          </Field>
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><UserRound className="h-4 w-4" />Lead do CRM</p>
            <FilterSingleSelect icon={UserRound} options={leadOptions} placeholder="Sem lead vinculado" value={draft.leadId ?? ''} onChange={(value) => setDraft((current) => ({ ...current, leadId: value || null }))} searchable searchPlaceholder="Digite para buscar um lead" emptyMessage="Nenhum lead encontrado para a busca." />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {COTADOR_AGE_RANGES.map((range) => {
              const value = draft.ageDistribution[range];
              return <Surface key={range} padding="sm"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Faixa</p><p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{range}</p><Input type="number" min="0" inputMode="numeric" pattern="\d*" value={value > 0 ? String(value) : ''} onChange={(event) => updateAgeRange(range, event.target.value)} className="mt-3" placeholder="0" /></Surface>;
            })}
          </div>
        </Surface>
      </DialogBody>
      <DialogFooter>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[var(--text-muted)]">
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
                  leadId: draft.leadId ?? null,
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
      </DialogFooter>
    </Dialog>
  );
}
