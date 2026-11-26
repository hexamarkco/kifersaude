import { useState, type ReactNode } from 'react';
import { CalendarDays, Eye, FileText, Search, SlidersHorizontal } from 'lucide-react';
import {
  ActionSurface, Badge, Button, DateTimePicker, Dialog, DialogBody, DialogFooter, DialogHeader,
  DialogTitle, EmptyState, Field, FilterSelect, Input, Pagination, RecordActions, Select, SortableTableHead,
  Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, useSortedTableRows, useTableSorting,
} from '../../../design-system';
import { CommissionNotice } from './CommissionSelectedDatePanel';
import type { CommissionEvent } from '../shared/commissionCalendarTypes';
import { formatCommissionCurrency, getCommissionContractName, getCommissionDateKey, parseCommissionDate } from '../shared/commissionCalendarUtils';

const PAGE_SIZE = 10;
const TYPES = [
  { value: 'all', label: 'Todas as previsões' },
  { value: 'comissao', label: 'Comissão' },
  { value: 'bonificacao', label: 'Bonificação' },
];
const EMPTY_FILTERS = { carrier: '', owner: '', start: '', end: '' };
const COLUMNS = [
  { key: 'contract', label: 'Contrato' },
  { key: 'carrier', label: 'Operadora' },
  { key: 'type', label: 'Tipo' },
  { key: 'value', label: 'Previsão' },
  { key: 'date', label: 'Data prevista' },
  { key: 'owner', label: 'Responsável' },
] as const;
type SortKey = (typeof COLUMNS)[number]['key'];

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLocaleLowerCase('pt-BR');

const sortValue = (event: CommissionEvent, key: SortKey) => {
  switch (key) {
    case 'contract': return getCommissionContractName(event.contract);
    case 'carrier': return event.contract.operadora;
    case 'owner': return event.contract.responsavel;
    default: return event[key];
  }
};

const sortedOptions = (values: Array<string | undefined | null>, first: string) => [
  { value: '', label: first },
  ...[...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR')).map((value) => ({ value, label: value })),
];

type Props = {
  monthKey: string;
  events: CommissionEvent[];
  monthControl: ReactNode;
  onSelectEvent: (event: CommissionEvent) => void;
  onOpenContract?: (code: string) => void;
};

export function CommissionForecastList({ monthKey, events, monthControl, onSelectEvent, onOpenContract }: Props) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [draft, setDraft] = useState<typeof EMPTY_FILTERS | null>(null);
  const [pagination, setPagination] = useState({ month: monthKey, page: 1 });
  const { sorting, sortBy } = useTableSorting<SortKey>();
  const term = normalize(query);
  const updatePage = (page: number) => setPagination({ month: monthKey, page });
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const invalidRange = Boolean(draft?.start && draft.end && draft.start > draft.end);
  const filtered = events.filter((event) => {
    const { contract } = event;
    if (type !== 'all' && event.type !== type) return false;
    if (filters.carrier && filters.carrier !== contract.operadora) return false;
    if (filters.owner && filters.owner !== contract.responsavel) return false;
    if (filters.start || filters.end) {
      const parsed = parseCommissionDate(event.date);
      if (!parsed) return false;
      const date = getCommissionDateKey(parsed);
      if ((filters.start && date < filters.start) || (filters.end && date > filters.end)) return false;
    }
    return !term || [contract.codigo_contrato, contract.operadora, contract.responsavel, contract.razao_social, contract.nome_fantasia].some((value) => normalize(value ?? '').includes(term));
  });
  const sorted = useSortedTableRows(filtered, sorting, sortValue);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = pagination.month === monthKey ? Math.min(pagination.page, totalPages) : 1;
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="kds-forecast-content">
      <div className="kds-forecast-toolbar">
        <Input aria-label="Buscar contrato ou responsável" leftIcon={Search} placeholder="Buscar contrato ou responsável..." value={query} onChange={(event) => { setQuery(event.target.value); updatePage(1); }} />
        <div className="kds-forecast-type">
          <FilterSelect placeholder="Tipo de previsão" includePlaceholderOption={false} neutralValues={['all']} options={TYPES} value={type} onChange={(value) => { setType(value); updatePage(1); }} />
        </div>
        {monthControl}
        <Button className="kds-forecast-filter" variant="secondary" onClick={() => setDraft({ ...filters })} aria-haspopup="dialog" aria-expanded={Boolean(draft)}>
          <SlidersHorizontal className="kds-control-icon" aria-hidden="true" />
          Filtros
          {activeFilters > 0 && <Badge size="sm" tone="accent">{activeFilters}</Badge>}
        </Button>
      </div>
      <Surface padding="none" className="kds-forecast-list">
        {rows.length > 0 ? <>
          <Table aria-label="Previsões de comissão e bonificação" size="sm" columnWidths={['25%', '16%', '12%', '13%', '12%', '16%', '6%']}>
            <TableHeader>
              <TableRow>
                {COLUMNS.map(({ key, label }) => (
                  <SortableTableHead
                    key={key}
                    label={label}
                    sortDirection={sorting.key === key ? sorting.direction : null}
                    onSort={() => { sortBy(key); updatePage(1); }}
                  />
                ))}
                <TableHead align="right" aria-label="Ações" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((event) => {
                const name = getCommissionContractName(event.contract);
                const code = event.contract.codigo_contrato;
                const actions = [
                  { label: 'Ver previsão', icon: Eye, onClick: () => onSelectEvent(event) },
                  ...(onOpenContract && code ? [{ label: 'Abrir contrato', icon: FileText, onClick: () => onOpenContract(code) }] : []),
                ];
                const isInstallment = event.installmentIndex && event.installmentCount;

                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <ActionSurface variant="plain" padding="none" className="kds-forecast-contract" onClick={() => onSelectEvent(event)}>
                        <strong className="kds-record-row-name">{name}</strong>
                        {((code && code !== name) || isInstallment) && <small>
                          {[code && code !== name ? code : null, isInstallment ? `Parcela ${event.installmentIndex} de ${event.installmentCount}` : null].filter(Boolean).join(' · ')}
                        </small>}
                      </ActionSurface>
                    </TableCell>
                    <TableCell>{event.contract.operadora || 'Não informada'}</TableCell>
                    <TableCell><Badge tone="neutral" className="kds-forecast-type-badge" data-forecast-type={event.type}>{event.type === 'comissao' ? 'Comissão' : 'Bonificação'}</Badge></TableCell>
                    <TableCell className="kds-forecast-amount whitespace-nowrap font-semibold tabular-nums">{formatCommissionCurrency(event.value)}</TableCell>
                    <TableCell>{parseCommissionDate(event.date)?.toLocaleDateString('pt-BR') ?? '—'}</TableCell>
                    <TableCell>{event.contract.responsavel || '—'}</TableCell>
                    <TableCell align="right"><RecordActions label={`Ações da previsão de ${name}`} actions={actions} visibleCount={0} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={updatePage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
        </> : (
          <EmptyState icon={<CalendarDays />} title="Nenhuma previsão nesta seleção." description="Escolha outra competência ou ajuste os filtros." />
        )}
      </Surface>
      <CommissionNotice />
      {draft && (
        <Dialog open size="md" className="kds-crm-dialog kds-finance-dialog kds-finance-filter-dialog" onOpenChange={(open) => !open && setDraft(null)}>
          <DialogHeader onClose={() => setDraft(null)}>
            <div className="kds-dialog-eyebrow">Financeiro</div>
            <DialogTitle>Filtrar previsões</DialogTitle>
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
            event.preventDefault();
            if (invalidRange) return;
            setFilters(draft);
            updatePage(1);
            setDraft(null);
          }}>
            <DialogBody className="space-y-4">
              <div className="kds-finance-form-grid">
                <Field label="Responsável" htmlFor="forecast-owner">
                  <Select id="forecast-owner" value={draft.owner} options={sortedOptions([draft.owner, ...events.map((event) => event.contract.responsavel)], 'Toda a equipe')} onChange={({ target }) => setDraft({ ...draft, owner: target.value })} />
                </Field>
                <Field label="Operadora" htmlFor="forecast-carrier">
                  <Select id="forecast-carrier" value={draft.carrier} options={sortedOptions([draft.carrier, ...events.map((event) => event.contract.operadora)], 'Todas as operadoras')} onChange={({ target }) => setDraft({ ...draft, carrier: target.value })} />
                </Field>
                <Field label="Desde" htmlFor="forecast-from">
                  <DateTimePicker id="forecast-from" type="date" value={draft.start} onChange={({ target }) => setDraft({ ...draft, start: target.value })} />
                </Field>
                <Field label="Até" htmlFor="forecast-to" error={invalidRange ? 'Escolha uma data igual ou posterior à inicial.' : undefined}>
                  <DateTimePicker id="forecast-to" type="date" value={draft.end} onChange={({ target }) => setDraft({ ...draft, end: target.value })} />
                </Field>
              </div>
              <Button type="button" variant="text" size="sm" onClick={() => setDraft({ ...EMPTY_FILTERS })}>Limpar filtros</Button>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancelar</Button>
              <Button type="submit" disabled={invalidRange}>Aplicar filtros</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
