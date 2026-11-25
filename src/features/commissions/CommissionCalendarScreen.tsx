import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileText, Gift, Wallet } from 'lucide-react';
import {
  Alert, Badge, Button, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Field, Heading, IconButton, KpiCard, CommissionCalendarSkeleton, RecordListSkeleton, PanelAdaptiveLoadingFrame, Select, Surface, Text,
} from '../../design-system';
import { listActiveCommissionContracts } from './data/commissionRepository';
import type { CommissionContract } from './domain/types';
import CommissionMonthGrid from './components/CommissionMonthGrid';
import CommissionSelectedDatePanel, { CommissionNotice } from './components/CommissionSelectedDatePanel';
import { CommissionForecastList } from './components/CommissionForecastList';
import type { CommissionEvent } from './shared/commissionCalendarTypes';
import {
  buildCommissionEvents, formatCommissionCurrency, getCommissionContractName, getCommissionDateKey,
  groupCommissionEventsByDay, isCommissionSameMonth, parseCommissionDate, sumCommissionTotals,
} from './shared/commissionCalendarUtils';

const formatMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const monthOptions = Array.from({ length: 12 }, (_, month) => ({
  value: String(month),
  label: new Date(2026, month, 1).toLocaleDateString('pt-BR', { month: 'long' }),
}));

type Props = {
  view: 'forecasts' | 'calendar';
  header: ReactNode;
  onOpenContract?: (code: string) => void;
};

export default function CommissionCalendarScreen({ view, header, onOpenContract }: Props) {
  const [contracts, setContracts] = useState<CommissionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [monthDraft, setMonthDraft] = useState<Date | null>(null);
  const [detail, setDetail] = useState<CommissionEvent | null>(null);
  const contractsRequestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++contractsRequestIdRef.current;
    const fetchContracts = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextContracts = await listActiveCommissionContracts();
        if (requestId === contractsRequestIdRef.current) setContracts(nextContracts);
      } catch (fetchContractsError) {
        if (requestId !== contractsRequestIdRef.current) return;
        console.error('Erro ao carregar comissões:', fetchContractsError);
        setError('Não foi possível carregar as informações financeiras.');
      } finally {
        if (requestId === contractsRequestIdRef.current) setLoading(false);
      }
    };
    void fetchContracts();
    return () => { contractsRequestIdRef.current += 1; };
  }, []);

  const year = date.getFullYear();
  const month = date.getMonth();
  const events = useMemo(() => buildCommissionEvents(contracts), [contracts]);
  const monthEvents = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    return events.filter((event) => {
      const eventDate = parseCommissionDate(event.date);
      return eventDate && isCommissionSameMonth(eventDate, firstOfMonth);
    });
  }, [events, month, year]);

  const eventsByDay = useMemo(() => groupCommissionEventsByDay(monthEvents), [monthEvents]);
  const totals = sumCommissionTotals(monthEvents);
  const monthContractCount = new Set(monthEvents.map((event) => event.contract.id)).size;
  const monthLabel = formatMonth.format(date).replace(/^./, (first) => first.toLocaleUpperCase('pt-BR'));
  const selectedEvents = eventsByDay.get(getCommissionDateKey(date)) ?? [];
  const goToMonth = (difference: number) => setDate((previous) => new Date(previous.getFullYear(), previous.getMonth() + difference, 1));

  const monthControl = (
    <Button
      className="kds-forecast-month"
      variant="secondary"
      aria-label={`Selecionar competência: ${monthLabel}`}
      aria-haspopup="dialog"
      aria-expanded={Boolean(monthDraft)}
      onClick={() => setMonthDraft(date)}
    >
      <CalendarDays className="kds-control-icon" aria-hidden="true" />
      {monthLabel}
      <ChevronDown className="kds-control-icon" aria-hidden="true" />
    </Button>
  );

  return (
    <div className="panel-page-shell kds-finance-page space-y-5">
      {header}
      {!loading && !error && (
        <section aria-label="Resumo de previsões do mês" className="kds-workspace-record-metrics">
          <KpiCard title="Comissão prevista" icon={<Wallet aria-hidden="true" />} trend={`Previsões de ${monthOptions[month].label}`}
            value={monthEvents.some((event) => event.type === 'comissao') ? formatCommissionCurrency(totals.commission) : '—'} />
          <KpiCard title="Bonificação prevista" icon={<Gift aria-hidden="true" />} data-tone="cyan" trend="Conforme os contratos"
            value={monthEvents.some((event) => event.type === 'bonificacao') ? formatCommissionCurrency(totals.bonus) : '—'} />
          <KpiCard title="Contratos com previsão" icon={<FileText aria-hidden="true" />} data-tone="info" trend="Na competência selecionada" value={String(monthContractCount)} />
          <KpiCard title="Eventos previstos" icon={<CalendarDays aria-hidden="true" />} data-tone="purple" trend="Comissões e bonificações" value={String(monthEvents.length)} />
        </section>
      )}
      <PanelAdaptiveLoadingFrame
        placeholder={view === 'forecasts' ? <RecordListSkeleton /> : <CommissionCalendarSkeleton />}
        loading={loading}
        label="Carregando previsões"
        hasContent={contracts.length > 0}
        overlayLabel="Atualizando previsões..."
        stageClassName="min-h-80"
      >
        {error ? <Alert tone="danger" role="alert">{error}</Alert> : view === 'forecasts' ? (
          <CommissionForecastList
            monthKey={`${year}-${month}`}
            events={monthEvents}
            monthControl={monthControl}
            onSelectEvent={setDetail}
            onOpenContract={onOpenContract}
          />
        ) : (
          <section aria-label="Calendário financeiro" className="kds-month-layout">
            <Surface padding="none" className="kds-month-calendar">
              <div className="kds-month-header">
                <Heading level={2} size="sm">{monthLabel}</Heading>
                <div className="kds-month-nav">
                  <Button variant="secondary" size="sm" onClick={() => setDate(new Date())}>Hoje</Button>
                  <IconButton size="sm" aria-label="Mês anterior" onClick={() => goToMonth(-1)}><ChevronLeft /></IconButton>
                  <IconButton size="sm" aria-label="Próximo mês" onClick={() => goToMonth(1)}><ChevronRight /></IconButton>
                </div>
              </div>
              <CommissionMonthGrid currentMonth={date} selectedDate={date} eventsByDay={eventsByDay} onSelectDate={setDate} />
            </Surface>
            <CommissionSelectedDatePanel date={date} events={selectedEvents} onSelectEvent={setDetail} />
          </section>
        )}
      </PanelAdaptiveLoadingFrame>
      {monthDraft && (
        <Dialog open size="sm" className="kds-finance-dialog" onOpenChange={(open) => !open && setMonthDraft(null)}>
          <DialogHeader onClose={() => setMonthDraft(null)}>
            <DialogTitle>Selecionar competência</DialogTitle>
            <DialogDescription placement="visible">Escolha o mês das previsões.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="kds-forecast-year">
              <IconButton size="sm" aria-label="Ano anterior" onClick={() => setMonthDraft(new Date(monthDraft.getFullYear() - 1, monthDraft.getMonth(), 1))}><ChevronLeft /></IconButton>
              <Text as="span" weight="semibold" aria-live="polite">{monthDraft.getFullYear()}</Text>
              <IconButton size="sm" aria-label="Próximo ano" onClick={() => setMonthDraft(new Date(monthDraft.getFullYear() + 1, monthDraft.getMonth(), 1))}><ChevronRight /></IconButton>
            </div>
            <Field label="Mês" htmlFor="forecast-month">
              <Select id="forecast-month" value={String(monthDraft.getMonth())} options={monthOptions} onChange={({ target }) => setMonthDraft(new Date(monthDraft.getFullYear(), Number(target.value), 1))} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMonthDraft(null)}>Cancelar</Button>
            <Button onClick={() => { setDate(new Date(monthDraft.getFullYear(), monthDraft.getMonth(), 1)); setMonthDraft(null); }}>Aplicar competência</Button>
          </DialogFooter>
        </Dialog>
      )}
      {detail && (
        <Dialog open size="md" className="kds-finance-dialog" onOpenChange={(open) => !open && setDetail(null)}>
          <DialogHeader onClose={() => setDetail(null)}>
            <DialogTitle>{detail.type === 'comissao' ? 'Previsão de comissão' : 'Previsão de bonificação'}</DialogTitle>
            <DialogDescription placement="visible">Consulte os dados do lançamento previsto.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="kds-forecast-detail-heading">
              <Badge tone="neutral" className="kds-forecast-type-badge" data-forecast-type={detail.type}>{detail.type === 'comissao' ? 'Comissão' : 'Bonificação'}</Badge>
              <Heading level={3}>{formatCommissionCurrency(detail.value)}</Heading>
            </div>
            <dl className="kds-forecast-detail-grid">
              <dt>Contrato</dt><dd>{getCommissionContractName(detail.contract)}</dd>
              {detail.contract.codigo_contrato && <><dt>Código</dt><dd>{detail.contract.codigo_contrato}</dd></>}
              <dt>Operadora</dt><dd>{detail.contract.operadora || 'Não informada'}</dd>
              <dt>Data prevista</dt><dd>{parseCommissionDate(detail.date)?.toLocaleDateString('pt-BR') ?? '—'}</dd>
              <dt>Responsável</dt><dd>{detail.contract.responsavel || 'Não informado'}</dd>
              {detail.installmentIndex && detail.installmentCount && <><dt>Parcela</dt><dd>{detail.installmentIndex} de {detail.installmentCount}</dd></>}
            </dl>
            <CommissionNotice />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDetail(null)}>Fechar</Button>
            {onOpenContract && detail.contract.codigo_contrato && (
              <Button onClick={() => onOpenContract(detail.contract.codigo_contrato)}>Abrir contrato</Button>
            )}
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
