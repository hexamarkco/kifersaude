import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarClock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  OperationalMetricChip,
  SectionHeader,
  Select,
  Surface,
} from '../../../design-system';
import { useConfirmationModal } from '../../../hooks/useConfirmationModal';
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
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

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

    const confirmed = await requestConfirmation({
      title: 'Aplicar reorganizacao',
      description: `Aplicar a reorganizacao em ${changedItems.length} follow-up(s)?`,
      confirmLabel: 'Aplicar reorganizacao',
      cancelLabel: 'Cancelar',
    });
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
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        size="xl"
        aria-label="Organizar follow-ups da agenda"
        className="max-w-5xl"
      >
        <DialogHeader onClose={onClose}>
          <DialogTitle>Organizar follow-ups</DialogTitle>
          <DialogDescription>
            Monte uma fila diaria: ate o limite definido por dia, todos no mesmo horario, em ordem de prioridade.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <Surface variant="muted" padding="sm" className="space-y-4">
            <SectionHeader
              as="h3"
              title="Configuracao da fila"
              description="Defina capacidade, inicio e criterio de priorizacao."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Limite diario" htmlFor="agenda-organizer-limit">
                <Input
                  id="agenda-organizer-limit"
                  type="number"
                  min={1}
                  max={80}
                  value={options.dailyLimit}
                  onChange={handleDailyLimitChange}
                />
              </Field>
              <Field label="Horario unico da fila" htmlFor="agenda-organizer-time">
                <Input
                  id="agenda-organizer-time"
                  type="time"
                  value={options.queueTime}
                  onChange={(event) => updateOption('queueTime', event.target.value)}
                />
              </Field>
              <Field label="Data inicial" htmlFor="agenda-organizer-date">
                <Input
                  id="agenda-organizer-date"
                  type="date"
                  value={options.startDate}
                  onChange={(event) => updateOption('startDate', event.target.value)}
                />
              </Field>
              <Field label="Modo" htmlFor="agenda-organizer-mode">
                <Select
                  id="agenda-organizer-mode"
                  value={options.priorityMode}
                  onChange={(event) => updateOption('priorityMode', event.target.value as FollowUpAgendaOrganizerMode)}
                  options={Object.entries(modeLabels).map(([value, label]) => ({ value, label }))}
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['weekdaysOnly', 'Somente dias uteis'],
                ['includeOverdue', 'Incluir atrasados'],
                ['preserveToday', 'Preservar follow-ups de hoje'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <Checkbox
                    checked={Boolean(options[key as keyof FollowUpAgendaOrganizerOptions])}
                    onChange={(event) => updateOption(key as keyof FollowUpAgendaOrganizerOptions, event.target.checked as never)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </Surface>

          <Surface padding="sm" className="space-y-4">
            {!preview && !loadingPreview ? (
              <EmptyState
                icon={<CalendarClock className="h-8 w-8" />}
                title="Aguardando configuracao"
                description="Configure a fila e gere uma previa. Nada sera alterado antes da confirmacao."
              />
            ) : null}

            {loadingPreview ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-semibold text-[var(--text-secondary)]" role="status">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
                Organizando follow-ups...
              </div>
            ) : null}

            {preview ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <OperationalMetricChip value={preview.totalCandidates} label="analisados" />
                  <OperationalMetricChip value={preview.totalChanges} label="mudancas" tone="accent" />
                  <OperationalMetricChip value={Object.keys(preview.groupedDays).length} label="dias usados" />
                  <OperationalMetricChip value={preview.options.queueTime} label="horario unico" tone="gold" />
                </div>

                <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                  {Object.entries(groupedChanges).map(([date, items]) => (
                    <Surface key={date} variant="muted" padding="sm" className="space-y-3">
                      <SectionHeader
                        as="h3"
                        title={`${new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })} as ${preview.options.queueTime}`}
                        action={<Badge tone="neutral">{items.length} follow-up(s)</Badge>}
                      />
                      <div className="space-y-2">
                        {items.slice(0, 30).map((change, index) => (
                          <Surface key={change.reminderId} padding="sm" className="text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <strong className="text-[var(--text-primary)]">{index + 1}. {change.leadName}</strong>
                                <p className="truncate text-[var(--text-muted)]">{change.title}</p>
                              </div>
                              <Badge tone={change.changed ? 'accent' : 'neutral'} className="max-w-full whitespace-normal text-right">
                                {change.changed
                                  ? `${formatDateTimeFullBR(change.currentDateTime)} -> ${formatDateTimeFullBR(change.newDateTime)}`
                                  : 'mantem horario'}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-[var(--text-muted)]">{change.reasons.join(' ')}</p>
                          </Surface>
                        ))}
                      </div>
                    </Surface>
                  ))}
                </div>
              </div>
            ) : null}
          </Surface>
        </DialogBody>

        <DialogFooter className="flex-wrap">
          <Button variant="secondary" onClick={onClose} disabled={loadingPreview || applying}>Fechar</Button>
          <Button variant="primary" onClick={() => void handleGeneratePreview()} loading={loadingPreview} disabled={applying}>
            <Sparkles className="h-4 w-4" />
            Gerar previa
          </Button>
          <Button variant="success" onClick={() => void handleApply()} loading={applying} disabled={!preview || changedItems.length === 0 || loadingPreview}>
            <CheckCircle2 className="h-4 w-4" />
            Aplicar
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </>
  );
}
