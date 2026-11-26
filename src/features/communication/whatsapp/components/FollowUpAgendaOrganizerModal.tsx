import { LoadingState, FieldLabel, Heading, Text } from '../../../../design-system';
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
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../design-system';
import { useConfirmationModal } from '../../../../hooks/useConfirmationModal';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { useFavoritedLeadIds } from '../../../../lib/leadFavoriteService';
import { formatDateTimeFullBR, getDateKey } from '../../../../lib/dateUtils';
import { toast } from '../../../../lib/toast';
import {
  whatsappFollowUpService,
  type FollowUpAgendaOrganizerMode,
  type FollowUpAgendaOrganizerOptions,
  type FollowUpAgendaOrganizerPreview,
} from '../data';

type FollowUpAgendaOrganizerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void | Promise<void>;
  onViewDailyAgenda?: () => void;
  pendingReturns?: readonly { id: string; title: string; leadName: string; currentDateTime: string; priority: string | null }[];
  pendingReturnsLoading?: boolean;
  pendingReturnsError?: string | null;
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

export default function FollowUpAgendaOrganizerModal({ isOpen, onClose, onApplied, onViewDailyAgenda, pendingReturns, pendingReturnsLoading, pendingReturnsError }: FollowUpAgendaOrganizerModalProps) {
  const [options, setOptions] = useState<FollowUpAgendaOrganizerOptions>(defaultOptions);
  const [preview, setPreview] = useState<FollowUpAgendaOrganizerPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const favoritedLeadIds = useFavoritedLeadIds();

  const changedItems = useMemo(() => preview?.changes.filter((change) => change.changed && selectedIds.has(change.reminderId)) ?? [], [preview, selectedIds]);
  const selectableItems = preview?.changes.filter((change) => change.changed) ?? [];
  const allSelected = selectableItems.length > 0 && selectableItems.every((change) => selectedIds.has(change.reminderId));
  const inbox = Boolean(onViewDailyAgenda);
  const pageSize = 5;
  const totalRows = preview?.changes.length ?? pendingReturns?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageOffset = (currentPage - 1) * pageSize;
  const displayedChanges = inbox ? preview?.changes.slice(pageOffset, pageOffset + pageSize) : preview?.changes;
  const displayedPendingReturns = pendingReturns?.slice(pageOffset, pageOffset + pageSize);
  const updateOption = <K extends keyof FollowUpAgendaOrganizerOptions>(key: K, value: FollowUpAgendaOrganizerOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setSelectedIds(new Set());
    setPage(1);
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
      setPage(1);
      setSelectedIds(new Set(result.changes.filter((change) => change.changed).map((change) => change.reminderId)));
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
        className={`kds-crm-dialog kds-agenda-dialog kds-agenda-organizer-dialog${inbox ? ' whatsapp-inbox-dialog whatsapp-inbox-agenda-panel' : ''}`}
      >
        <DialogHeader onClose={busy ? undefined : onClose}>
          <div className="kds-dialog-eyebrow">{inbox ? 'Inbox' : 'Agenda'}</div>
          <DialogTitle>{inbox ? 'Agenda das conversas' : 'Organizar follow-ups'}</DialogTitle>
          {!inbox && <DialogDescription placement="visible">
            Distribua os retornos respeitando a disponibilidade da equipe e a prioridade das negociações.
          </DialogDescription>}
        </DialogHeader>

        <DialogBody className="space-y-5">
          <Alert tone="info" title={inbox ? 'Os próximos passos das suas conversas.' : 'Uma agenda com mais equilíbrio.'}>
            Distribua os retornos respeitando o horário da equipe e a prioridade de cada negociação. Gere uma prévia antes de aplicar.
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
                        <TableHead scope="col"><Checkbox aria-label="Selecionar todas as mudanças" checked={allSelected} disabled={busy || selectableItems.length === 0} onChange={(event) => setSelectedIds(event.target.checked ? new Set(selectableItems.map((change) => change.reminderId)) : new Set())} /></TableHead>
                        <TableHead scope="col">Acompanhamento</TableHead>
                        <TableHead scope="col">Horário atual</TableHead>
                        <TableHead scope="col">Horário sugerido</TableHead>
                        <TableHead scope="col">Prioridade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedChanges?.map((change) => (
                        <TableRow key={change.reminderId}>
                          <TableCell><Checkbox aria-label={`Selecionar ${change.title}`} checked={selectedIds.has(change.reminderId)} disabled={busy || !change.changed} onChange={(event) => setSelectedIds((current) => { const next = new Set(current); if (event.target.checked) next.add(change.reminderId); else next.delete(change.reminderId); return next; })} /></TableCell>
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
              ) : !preview && inbox && pendingReturnsError ? (
                <Alert tone="danger" title="Não foi possível consultar os retornos.">{pendingReturnsError}</Alert>
              ) : !preview && inbox && pendingReturnsLoading ? (
                <LoadingState label="Carregando retornos" />
              ) : !preview && inbox && pendingReturns && pendingReturns.length > 0 ? (
                <>
                  <Text tone="muted" size="sm">Retornos pendentes carregados da agenda. A elegibilidade e os novos horários são confirmados ao sugerir a organização.</Text>
                  <Table aria-label="Retornos pendentes" size="sm" stickyHeader>
                    <TableHeader><TableRow><TableHead scope="col">Acompanhamento</TableHead><TableHead scope="col">Horário atual</TableHead><TableHead scope="col">Prioridade</TableHead></TableRow></TableHeader>
                    <TableBody>{displayedPendingReturns?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><strong>{item.title}</strong><Text tone="muted" size="sm">{item.leadName}</Text></TableCell>
                        <TableCell>{formatDateTimeFullBR(item.currentDateTime)}</TableCell>
                        <TableCell>{item.priority && <Badge tone={item.priority === 'alta' ? 'warning' : 'neutral'}>{item.priority}</Badge>}</TableCell>
                      </TableRow>
                    ))}</TableBody>
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
            {inbox && totalRows > 0 && !loadingPreview && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalRows} itemsPerPage={pageSize} onPageChange={setPage} />}
          </section>
        </DialogBody>

        <DialogFooter>
          {onViewDailyAgenda && <Button variant="ghost" onClick={onViewDailyAgenda} disabled={busy}>Ver retornos do dia</Button>}
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
