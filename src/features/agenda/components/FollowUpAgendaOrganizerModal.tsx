import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarClock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { formatDateTimeFullBR } from '../../../lib/dateUtils';
import { toast } from '../../../lib/toast';
import {
  commWhatsAppService,
  type FollowUpAgendaOrganizerChange,
  type FollowUpAgendaOrganizerMode,
  type FollowUpAgendaOrganizerOptions,
  type FollowUpAgendaOrganizerPreview,
} from '../../../lib/commWhatsAppService';

type FollowUpAgendaOrganizerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
};

const getTodayDateInput = () => new Date().toISOString().slice(0, 10);

const defaultOptions = (): FollowUpAgendaOrganizerOptions => ({
  dailyLimit: 20,
  queueTime: '09:00',
  startDate: getTodayDateInput(),
  weekdaysOnly: true,
  includeOverdue: true,
  preserveToday: true,
  priorityMode: 'balanced',
});

const modeLabels: Record<FollowUpAgendaOrganizerMode, string> = {
  balanced: 'Equilibrado',
  urgency: 'Urgencia',
  minimal_changes: 'Menos mudancas',
};

const groupChangesByDate = (changes: FollowUpAgendaOrganizerChange[]) => changes.reduce<Record<string, FollowUpAgendaOrganizerChange[]>>((groups, change) => {
  const key = change.newDateTime.slice(0, 10);
  groups[key] = [...(groups[key] ?? []), change];
  return groups;
}, {});

export default function FollowUpAgendaOrganizerModal({ isOpen, onClose, onApplied }: FollowUpAgendaOrganizerModalProps) {
  const [options, setOptions] = useState<FollowUpAgendaOrganizerOptions>(defaultOptions);
  const [preview, setPreview] = useState<FollowUpAgendaOrganizerPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);

  const groupedChanges = useMemo(() => preview ? groupChangesByDate(preview.changes) : {}, [preview]);
  const changedItems = useMemo(() => preview?.changes.filter((change) => change.changed) ?? [], [preview]);

  const updateOption = <K extends keyof FollowUpAgendaOrganizerOptions>(key: K, value: FollowUpAgendaOrganizerOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const handleDailyLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    updateOption('dailyLimit', Number.isFinite(parsed) ? Math.max(1, Math.min(80, Math.floor(parsed))) : 20);
  };

  const handleGeneratePreview = async () => {
    setLoadingPreview(true);
    try {
      const result = await commWhatsAppService.previewFollowUpAgendaOrganization(options);
      setPreview(result);
      if (result.totalCandidates === 0) {
        toast.info('Nenhum follow-up pendente encontrado para reorganizar.');
      } else {
        toast.success('Previa da reorganizacao gerada.');
      }
    } catch (error) {
      console.error('[FollowUpAgendaOrganizerModal] erro ao gerar previa', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar a previa.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    if (!preview || changedItems.length === 0) {
      toast.info('Nao ha mudancas para aplicar.');
      return;
    }

    const confirmed = window.confirm(`Aplicar a reorganizacao em ${changedItems.length} follow-up(s)?`);
    if (!confirmed) return;

    setApplying(true);
    try {
      const result = await commWhatsAppService.applyFollowUpAgendaOrganization(changedItems);
      toast.success(`Agenda reorganizada: ${result.applied} follow-up(s) atualizados.`);
      setPreview(null);
      await onApplied?.();
      onClose();
    } catch (error) {
      console.error('[FollowUpAgendaOrganizerModal] erro ao aplicar reorganizacao', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel aplicar a reorganizacao.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Organizar follow-ups"
      description="Monte uma fila diaria: ate o limite definido por dia, todos no mesmo horario, em ordem de prioridade."
      size="xl"
      panelClassName="max-w-5xl"
      footer={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loadingPreview || applying}>Fechar</Button>
          <Button variant="primary" onClick={() => void handleGeneratePreview()} loading={loadingPreview} disabled={applying}>
            <Sparkles className="h-4 w-4" />
            Gerar previa
          </Button>
          <Button variant="success" onClick={() => void handleApply()} loading={applying} disabled={!preview || changedItems.length === 0 || loadingPreview}>
            <CheckCircle2 className="h-4 w-4" />
            Aplicar
          </Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <section className="grid gap-3 rounded-[var(--kds-radius-lg)] border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f7efe5)] p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
            <span>Limite diario</span>
            <Input type="number" min={1} max={80} value={options.dailyLimit} onChange={handleDailyLimitChange} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
            <span>Horario unico da fila</span>
            <Input type="time" value={options.queueTime} onChange={(event) => updateOption('queueTime', event.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
            <span>Data inicial</span>
            <Input type="date" value={options.startDate} onChange={(event) => updateOption('startDate', event.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
            <span>Modo</span>
            <select
              value={options.priorityMode}
              onChange={(event) => updateOption('priorityMode', event.target.value as FollowUpAgendaOrganizerMode)}
              className="h-11 w-full rounded-[var(--kds-radius-sm)] border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 text-sm text-[var(--panel-text,#1c1917)]"
            >
              {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {[
            ['weekdaysOnly', 'Somente dias uteis'],
            ['includeOverdue', 'Incluir atrasados'],
            ['preserveToday', 'Preservar follow-ups de hoje'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-[var(--kds-radius-sm)] border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
              <input
                type="checkbox"
                checked={Boolean(options[key as keyof FollowUpAgendaOrganizerOptions])}
                onChange={(event) => updateOption(key as keyof FollowUpAgendaOrganizerOptions, event.target.checked as never)}
              />
              <span>{label}</span>
            </label>
          ))}
        </section>

        <section className="rounded-[var(--kds-radius-lg)] border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] p-4">
          {!preview && !loadingPreview ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-[var(--panel-text-muted,#876f5c)]">
              <CalendarClock className="h-8 w-8" />
              Configure a fila e clique em Gerar previa. Nada sera alterado antes da confirmacao.
            </div>
          ) : null}

          {loadingPreview ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-semibold text-[var(--panel-text,#1c1917)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Organizando follow-ups...
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm md:grid-cols-4">
                <div className="rounded-[var(--kds-radius-sm)] bg-[var(--panel-surface-soft,#f7efe5)] p-3"><strong>{preview.totalCandidates}</strong><br />analisados</div>
                <div className="rounded-[var(--kds-radius-sm)] bg-[var(--panel-surface-soft,#f7efe5)] p-3"><strong>{preview.totalChanges}</strong><br />mudancas</div>
                <div className="rounded-[var(--kds-radius-sm)] bg-[var(--panel-surface-soft,#f7efe5)] p-3"><strong>{Object.keys(preview.groupedDays).length}</strong><br />dias usados</div>
                <div className="rounded-[var(--kds-radius-sm)] bg-[var(--panel-surface-soft,#f7efe5)] p-3"><strong>{preview.options.queueTime}</strong><br />horario unico</div>
              </div>

              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {Object.entries(groupedChanges).map(([date, items]) => (
                  <div key={date} className="rounded-[var(--kds-radius-md)] border border-[var(--panel-border,#d4c0a7)] p-3">
                    <h4 className="mb-3 flex items-center justify-between text-sm font-bold text-[var(--panel-text,#1c1917)]">
                      <span>{new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} as {preview.options.queueTime}</span>
                      <span>{items.length} follow-up(s)</span>
                    </h4>
                    <div className="space-y-2">
                      {items.slice(0, 30).map((change, index) => (
                        <article key={change.reminderId} className="rounded-[var(--kds-radius-sm)] bg-[var(--panel-surface-soft,#f7efe5)] p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <strong>{index + 1}. {change.leadName}</strong>
                              <p className="text-[var(--panel-text-muted,#876f5c)]">{change.title}</p>
                            </div>
                            <span className="rounded-full border px-2 py-1 text-xs">{change.changed ? `${formatDateTimeFullBR(change.currentDateTime)} -> ${formatDateTimeFullBR(change.newDateTime)}` : 'mantem horario'}</span>
                          </div>
                          <p className="mt-2 text-xs text-[var(--panel-text-muted,#876f5c)]">{change.reasons.join(' ')}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </ModalShell>
  );
}
