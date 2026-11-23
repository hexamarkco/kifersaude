import { useState, type ReactNode } from 'react';
import { CalendarDays, Search } from 'lucide-react';
import {
  Avatar, Badge, EmptyState, FilterSelect, Input, Pagination, Surface, Table, TableBody,
  TableCell, TableHead, TableHeader, TableRow, Text,
} from '../../../design-system';
import type { CommissionEvent } from '../shared/commissionCalendarTypes';
import { formatCommissionCurrency, parseCommissionDate } from '../shared/commissionCalendarUtils';

const PAGE_SIZE = 10;
const TYPES = [
  { value: 'all', label: 'Todas as previsões' },
  { value: 'comissao', label: 'Comissão' },
  { value: 'bonificacao', label: 'Bonificação' },
];

export function CommissionForecastList({ events, monthControl }: { events: CommissionEvent[]; monthControl: ReactNode }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [page, setPage] = useState(1);
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = events.filter(({ contract, type: eventType }) => (
    (type === 'all' || type === eventType) &&
    [contract.codigo_contrato, contract.operadora, contract.responsavel, contract.razao_social, contract.nome_fantasia].some((value) => (value ?? '').toLocaleLowerCase('pt-BR').includes(term))
  ));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="kds-forecast-toolbar">
        <Input aria-label="Buscar contrato ou responsável" leftIcon={Search} placeholder="Buscar contrato ou responsável…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        <div className="kds-forecast-type">
          <FilterSelect placeholder="Tipo de previsão" includePlaceholderOption={false} options={TYPES} value={type} onChange={(value) => { setType(value); setPage(1); }} />
        </div>
        {monthControl}
      </div>
      <Surface padding="none" className="kds-forecast-list">
      {rows.length > 0 ? <>
        <Table aria-label="Previsões de comissão e bonificação">
          <TableHeader><TableRow>
            <TableHead>Contrato</TableHead><TableHead>Operadora</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Previsão</TableHead><TableHead>Data prevista</TableHead><TableHead>Responsável</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((event) => <TableRow key={event.id}>
              <TableCell>
                <div className="kds-dashboard-lead-cell">
                  <Avatar name={event.contract.nome_fantasia || event.contract.razao_social || event.contract.codigo_contrato || 'Contrato'} size="sm" tone="brand" />
                  <span>
                    <Text as="span" weight="medium">{event.contract.nome_fantasia || event.contract.razao_social || event.contract.codigo_contrato || 'Sem código'}</Text>
                    <small>{event.contract.codigo_contrato}{event.installmentIndex && event.installmentCount ? ` · Parcela ${event.installmentIndex} de ${event.installmentCount}` : ''}</small>
                  </span>
                </div>
              </TableCell>
              <TableCell>{event.contract.operadora || 'Operadora não informada'}</TableCell>
              <TableCell><Badge tone="neutral" className="kds-forecast-type-badge" data-forecast-type={event.type}>{event.type === 'comissao' ? 'Comissão' : 'Bonificação'}</Badge></TableCell>
              <TableCell className="whitespace-nowrap font-medium tabular-nums">{formatCommissionCurrency(event.value)}</TableCell>
              <TableCell>{parseCommissionDate(event.date)?.toLocaleDateString('pt-BR') ?? '—'}</TableCell>
              <TableCell>{event.contract.responsavel || '—'}</TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
      </> : (
        <EmptyState icon={<CalendarDays aria-hidden="true" />} title="Nenhuma previsão nesta seleção" description="Escolha outro mês ou ajuste os filtros para consultar as previsões." />
      )}
      </Surface>
    </>
  );
}
