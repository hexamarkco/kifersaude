import { Text } from '../../../../design-system';
import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { ActionSurface, Button, EmptyState, IconButton, Input, SectionHeader, Select, useSortedTableRows, useTableSorting, type TableSortValue } from '../../../../design-system';
import { normalizeConfigSearchText } from '../shared/systemSettingsConfig';

type CatalogColumn<T> = {
  key: string;
  label: string;
  getValue?: (item: T) => TableSortValue;
};

type SettingsCatalogListProps<T> = {
  title: string;
  description?: string;
  hint?: string;
  items: readonly T[];
  columns: readonly CatalogColumn<T>[];
  initialSortKey: string;
  gridClassName: string;
  getId: (item: T) => string;
  getSearchText: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  action: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
};

export function SettingsCatalogList<T>({ title, description, hint, items, columns, initialSortKey, gridClassName, getId, getSearchText, renderItem, action, emptyTitle, emptyDescription }: SettingsCatalogListProps<T>) {
  const [search, setSearch] = useState('');
  const { sorting, sortBy } = useTableSorting(initialSortKey);
  const sortedItems = useSortedTableRows(items, sorting, (item, key) => columns.find((column) => column.key === key)?.getValue?.(item));
  const normalizedSearch = normalizeConfigSearchText(search);
  const visibleItems = sortedItems.filter((item) => normalizeConfigSearchText(getSearchText(item)).includes(normalizedSearch));
  const sortableColumns = columns.filter((column) => column.getValue);

  return <div className="min-w-0 space-y-4">
    <SectionHeader as="h3" title={title} description={description} action={action} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full sm:max-w-72"><Input size="sm" leftIcon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome" aria-label={`Buscar em ${title}`} /></div>
      <Text className="text-xs text-[var(--text-muted)]" role="status">{normalizedSearch ? `${visibleItems.length} de ${items.length}` : items.length} {items.length === 1 ? 'item' : 'itens'}</Text>
      <div className="flex w-full items-center gap-2 md:hidden">
        <div className="min-w-0 flex-1"><Select size="sm" aria-label={`Ordenar ${title}`} value={sorting.key ?? initialSortKey} onChange={(event) => sortBy(event.target.value)}>
          {sortableColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
        </Select></div>
        <IconButton variant="secondary" size="sm" aria-label={sorting.direction === 'asc' ? 'Usar ordem decrescente' : 'Usar ordem crescente'} onClick={() => sortBy(sorting.key ?? initialSortKey)}>
          {sorting.direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
        </IconButton>
      </div>
    </div>
    {hint && <Text className="text-xs text-[var(--text-muted)]">{hint}</Text>}
    {items.length === 0 ? <EmptyState title={emptyTitle} description={emptyDescription} /> : visibleItems.length === 0 ? (
      <EmptyState title="Nenhum item encontrado" description="Tente outro nome ou limpe a busca para ver a lista completa." action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Limpar busca</Button>} />
    ) : <div>
      <div className={`hidden items-center gap-3 border-b border-[var(--border-default)] px-1 pb-3 md:grid ${gridClassName}`}>
        {columns.map((column) => {
          const selected = sorting.key === column.key;
          const SortIcon = !selected ? ArrowUpDown : sorting.direction === 'asc' ? ArrowUp : ArrowDown;
          return column.getValue ? <ActionSurface variant="plain" padding="none" key={column.key} type="button" onClick={() => sortBy(column.key)} aria-label={`Ordenar por ${column.label}`} aria-pressed={selected}
            title={selected ? `${column.label}: ordem ${sorting.direction === 'asc' ? 'crescente' : 'decrescente'}` : `Ordenar por ${column.label}`}
            className="kds-catalog-sort">
            <span className="whitespace-nowrap">{column.label}</span><SortIcon className="shrink-0" aria-hidden="true" />
          </ActionSurface> : <span key={column.key} className="text-xs font-medium text-[var(--text-muted)]">{column.label}</span>;
        })}
      </div>
      <ul aria-label={title} className="divide-y divide-[var(--border-subtle)] border-b border-[var(--border-default)]">
        {visibleItems.map((item) => <li key={getId(item)} className={`grid grid-cols-1 items-center gap-3 px-1 py-3 ${gridClassName}`}>{renderItem(item)}</li>)}
      </ul>
    </div>}
  </div>;
}
