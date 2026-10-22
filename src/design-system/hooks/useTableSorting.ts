import { useCallback, useMemo, useState } from 'react';

export type TableSortDirection = 'asc' | 'desc';
export type TableSortValue = string | number | Date | null | undefined;

export type TableSortingState<Key extends string> = {
  key: Key | null;
  direction: TableSortDirection;
};

export function useTableSorting<Key extends string>(
  initialKey: Key | null = null,
  initialDirection: TableSortDirection = 'asc',
) {
  const [sorting, setSorting] = useState<TableSortingState<Key>>({
    key: initialKey,
    direction: initialDirection,
  });

  const sortBy = useCallback((key: Key) => {
    setSorting((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  return { sorting, sortBy };
}

const toComparableValue = (value: Exclude<TableSortValue, null | undefined>) => (
  value instanceof Date ? value.getTime() : value
);

export function sortTableRows<T, Key extends string>(
  rows: readonly T[],
  sorting: TableSortingState<Key>,
  getValue: (row: T, key: Key) => TableSortValue,
): T[] {
  if (!sorting.key) return [...rows];

  return rows
    .map((row, index) => ({ row, index, value: getValue(row, sorting.key!) }))
    .sort((left, right) => {
      if (left.value === null || left.value === undefined) return right.value === null || right.value === undefined ? left.index - right.index : 1;
      if (right.value === null || right.value === undefined) return -1;

      const leftValue = toComparableValue(left.value);
      const rightValue = toComparableValue(right.value);
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'pt-BR', { numeric: true, sensitivity: 'base' });

      return comparison === 0
        ? left.index - right.index
        : sorting.direction === 'asc' ? comparison : -comparison;
    })
    .map(({ row }) => row);
}

export function useSortedTableRows<T, Key extends string>(
  rows: readonly T[],
  sorting: TableSortingState<Key>,
  getValue: (row: T, key: Key) => TableSortValue,
) {
  return useMemo(() => sortTableRows(rows, sorting, getValue), [getValue, rows, sorting]);
}
