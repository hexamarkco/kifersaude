import { LoadingState, FieldLabel, Heading, Text } from '../../../design-system';
import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarClock, CheckCircle2, Sparkles } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DateTimePicker,
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../design-system';
import { useConfirmationModal } from '../../../hooks/useConfirmationModal';
import { LeadFavoriteBadge } from '../../../components/LeadFavoriteStar';
import { useFavoritedLeadIds } from '../../../lib/leadFavoriteService';
import { formatDateTimeFullBR, getDateKey } from '../../../lib/dateUtils';
import { toast } from '../../../lib/toast';
import {
  whatsappFollowUpService,
  type FollowUpAgendaOrganizerMode,
  type FollowUpAgendaOrganizerOptions,
  type FollowUpAgendaOrganizerPreview,
} from '../../communication/whatsapp';

type FollowUpAgendaOrganizerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
};

const getTodayDateInput = () => getDateKey(new Date());

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
  urgency: 'Urgência',
  minimal_changes: 'Menos mudanças',
};

const organizerToggles = [
  ['weekdaysOnly', 'Somente dias úteis'],
  ['includeOverdue', 'Incluir atrasados'],
  ['preserveToday', 'Preservar follow-ups de hoje'],
] as const;

export default function FollowUpAgendaOrganizerModal({ isOpen, onClose, onApplied }: FollowUpAgendaOrganizerModalProps) {
  const [options, setOptions] = useState<FollowUpAgendaOrganizerOptions>(defaultOptions);
  const [preview, setPreview] = useState<FollowUpAgendaOrganizerPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const favoritedLeadIds = useFavoritedLeadIds();

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
      const result = await whatsappFollowUpService.previewAgendaOrganization(options);
      setPreview(result);
      if (result.totalCandidates === 0) {
        toast.info('Nenhum follow-up pendente encontrado para reorganizar.');
      } else {
        toast.success('Prévia da reorganização gerada.');
      }
    } catch (error) {
      console.error('[FollowUpAgendaOrganizerModal] erro ao gerar previa', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar a prévia.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    if (!preview || changedItems.length === 0) {
      toast.info('Não há mudanças para aplicar.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Aplicar reorganização',
      description: `Aplicar a reorganização em ${changedItems.length} follow-up(s)?`,
      confirmLabel: 'Aplicar reorganização',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    setApplying(true);
    try {
      const result = await whatsappFollowUpService.applyAgendaOrganization(changedItems);
      toast.success(`Agenda reorganizada: ${result.applied} follow-up(s) atualizados.`);
      setPreview(null);
      await onApplied?.();
      onClose();
    } catch (error) {
      console.error('[FollowUpAgendaOrganizerModal] erro ao aplicar reorganizacao', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível aplicar a reorganização.');
    } finally {
      setApplying(false);
    }
  };

  const busy = loadingPreview || applying;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => !open && !busy && onClose()}
        size="xl"
        className="kds-agenda-dialog"
      >
        <DialogHeader onClose={busy ? undefined : onClose}>
          <DialogTitle>Organizar follow-ups</DialogTitle>
          <DialogDescription placement="visible">
            Distribua os retornos respeitando a disponibilidade da equipe e a prioridade das negociações.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <Alert tone="info" title="Uma agenda com mais equilíbrio.">
            Defina quantos retornos a equipe consegue assumir por dia e gere uma prévia antes de aplicar.
          </Alert>
          <div className="kds-agenda-organizer-fields">
            <Field label="Começar a partir de" htmlFor="agenda-organizer-date">
              <DateTimePicker
                id="agenda-organizer-date"
                type="date"
                value={options.startDate}
                disabled={busy}
                onChange={(event) => updateOption('startDate', event.target.value)}
              />
            </Field>
            <Field label="Retornos por dia" htmlFor="agenda-organizer-limit">
              <Input
                id="agenda-organizer-limit"
                type="number"
                min={1}
                max={80}
                value={options.dailyLimit}
                disabled={busy}
                onChange={handleDailyLimitChange}
              />
            </Field>
            <Field label="Horário da fila" htmlFor="agenda-organizer-time">
              <DateTimePicker
                id="agenda-organizer-time"
                type="time"
                value={options.queueTime}
                disabled={busy}
                onChange={(event) => updateOption('queueTime', event.target.value)}
              />
            </Field>
            <Field label="Modo de priorização" htmlFor="agenda-organizer-mode">
              <Select
                id="agenda-organizer-mode"
                value={options.priorityMode}
                disabled={busy}
                onChange={(event) => updateOption('priorityMode', event.target.value as FollowUpAgendaOrganizerMode)}
                options={Object.entries(modeLabels).map(([value, label]) => ({ value, label }))}
              />
            </Field>
          </div>
          <div className="kds-agenda-organizer-options">
            {organizerToggles.map(([key, label]) => (
              <FieldLabel key={key}>
                <Checkbox
                  checked={options[key]}
                  disabled={busy}
                  onChange={(event) => updateOption(key, event.target.checked)}
                />
                <span>{label}</span>
              </FieldLabel>
            ))}
          </div>

          <section className="kds-agenda-organizer-preview space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Heading level={3} size="sm">{preview ? 'Sugestão de distribuição' : 'Retornos para organizar'}</Heading>
              <Button variant="secondary" size="sm" onClick={() => void handleGeneratePreview()} loading={loadingPreview} disabled={busy || !options.startDate || !options.queueTime}>
                {!loadingPreview && <Sparkles className="kds-control-icon" />}
                Sugerir organização
              </Button>
            </div>
            <LoadingState active={loadingPreview} label="Organizando follow-ups..." className="min-h-36" fallback={() => (
              preview && preview.changes.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <OperationalMetricChip value={preview.totalCandidates} label="analisados" />
                    <OperationalMetricChip value={preview.totalChanges} label="mudanças" tone="accent" />
                    <OperationalMetricChip value={Object.keys(preview.groupedDays).length} label="dias usados" />
                  </div>
                  <Table aria-label="Distribuição dos follow-ups" size="sm" stickyHeader>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Acompanhamento</TableHead>
                        <TableHead scope="col">Horário atual</TableHead>
                        <TableHead scope="col">Horário sugerido</TableHead>
                        <TableHead scope="col">Prioridade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.changes.map((change) => (
                        <TableRow key={change.reminderId}>
                          <TableCell>
                            <strong className="flex items-center gap-1">
                              <LeadFavoriteBadge favorito={change.leadId ? favoritedLeadIds.has(change.leadId) : false} />
                              {change.leadName}
                            </strong>
                            <Text className="text-xs text-[var(--text-muted)]">{change.title}</Text>
                            {change.reasons.length > 0 && <Text className="text-xs text-[var(--text-muted)]">{change.reasons.join(' ')}</Text>}
                          </TableCell>
                          <TableCell>{formatDateTimeFullBR(change.currentDateTime)}</TableCell>
                          <TableCell>{change.changed ? <Badge tone="accent">{formatDateTimeFullBR(change.newDateTime)}</Badge> : 'Mantém horário'}</TableCell>
                          <TableCell>{change.priority && <Badge tone={change.priority === 'alta' ? 'warning' : 'neutral'}>{change.priority}</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <EmptyState
                  icon={<CalendarClock />}
                  title={preview ? 'Nenhum retorno para reorganizar.' : 'Aguardando a primeira sugestão.'}
                  description={preview ? 'Ajuste os critérios para consultar outros retornos.' : 'Configure a fila e gere uma prévia para conferir os horários.'}
                />
              )
            )} />
          </section>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={() => void handleApply()} loading={applying} disabled={busy || changedItems.length === 0}>
            {!applying && <CheckCircle2 className="kds-control-icon" />}
            Aplicar organização
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </>
  );
}
