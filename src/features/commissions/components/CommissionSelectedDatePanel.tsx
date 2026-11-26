import { CalendarDays, Gift, Info, Wallet } from 'lucide-react';
import { ActionSurface, EmptyState, Heading, Surface, Text } from '../../../design-system';
import { formatCommissionCurrency, getCommissionContractName, sumCommissionTotals } from '../shared/commissionCalendarUtils';
import type { CommissionEvent } from '../shared/commissionCalendarTypes';

type Props = {
  date: Date;
  events: CommissionEvent[];
  onSelectEvent: (event: CommissionEvent) => void;
};

export default function CommissionSelectedDatePanel({ date, events, onSelectEvent }: Props) {
  const totals = sumCommissionTotals(events);
  return (
    <Surface padding="none" className="kds-forecast-day" aria-label="Previsões do dia selecionado">
      <div className="kds-forecast-day-header">
        <Heading level={2} size="sm">{date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</Heading>
        <Text size="sm" tone="muted">Previsões para a data selecionada.</Text>
      </div>
      <div className="kds-forecast-day-body">
        {events.length > 0 ? events.map((event) => (
          <ActionSurface
            key={event.id}
            variant="plain"
            padding="none"
            className="kds-forecast-event"
            data-forecast-type={event.type}
            onClick={() => onSelectEvent(event)}
          >
            <span className="kds-forecast-event-icon">
              {event.type === 'comissao' ? <Wallet aria-hidden="true" /> : <Gift aria-hidden="true" />}
            </span>
            <span className="kds-forecast-event-copy">
              <strong className="kds-record-row-name">{getCommissionContractName(event.contract)}</strong>
              <small>{[event.contract.operadora, event.contract.codigo_contrato].filter(Boolean).join(' · ')}</small>
              <strong className="kds-forecast-event-value">{formatCommissionCurrency(event.value)}</strong>
              <small>{event.type === 'comissao' ? 'Comissão' : 'Bonificação'}{event.installmentIndex && event.installmentCount ? ` · Parcela ${event.installmentIndex} de ${event.installmentCount}` : ''}</small>
            </span>
          </ActionSurface>
        )) : (
          <EmptyState icon={<CalendarDays />} title="Nenhuma previsão nesta data." description="Selecione um dia marcado no calendário." />
        )}
      </div>
      {events.length > 1 && (
        <dl className="kds-forecast-day-totals" aria-label="Totais da data selecionada">
          {events.some((event) => event.type === 'comissao') && <><dt>Comissão</dt><dd>{formatCommissionCurrency(totals.commission)}</dd></>}
          {events.some((event) => event.type === 'bonificacao') && <><dt>Bonificação</dt><dd>{formatCommissionCurrency(totals.bonus)}</dd></>}
        </dl>
      )}
    </Surface>
  );
}

export function CommissionNotice() {
  return (
    <Surface padding="sm" variant="muted" className="kds-forecast-notice">
      <Info aria-hidden="true" />
      <div>
        <Text weight="semibold">São previsões vinculadas aos contratos.</Text>
        <Text size="sm" tone="muted">Use as datas e valores para planejar o financeiro e confira os recebimentos antes de considerar o valor no caixa.</Text>
      </div>
    </Surface>
  );
}
