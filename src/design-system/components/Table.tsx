import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cx } from '../../lib/cx';

export type TableSize = 'sm' | 'md';

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  size?: TableSize;
  striped?: boolean;
  stickyHeader?: boolean;
  columnWidths?: readonly string[];
};

const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { size = 'md', striped = false, stickyHeader = false, columnWidths, className, children, ...props },
  ref,
) {
  return (
    <div className="kds-table-wrapper">
      <table
        ref={ref}
        className={cx(
          'kds-table',
          size === 'sm' && 'kds-table-sm',
          size === 'md' && 'kds-table-md',
          striped && 'kds-table-striped',
          stickyHeader && 'kds-table-sticky',
          className,
        )}
        {...props}
      >
        {columnWidths && <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>}
        {children}
      </table>
    </div>
  );
});

export type TableHeaderProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableHeader({ className, children, ...props }: TableHeaderProps) {
  return (
    <thead className={cx('kds-table-header', className)} {...props}>
      {children}
    </thead>
  );
}

export type TableBodyProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableBody({ className, children, ...props }: TableBodyProps) {
  return (
    <tbody className={cx('kds-table-body', className)} {...props}>
      {children}
    </tbody>
  );
}

export type TableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean;
  onClick?: () => void;
};

export function TableRow({ selected = false, className, children, ...props }: TableRowProps) {
  return (
    <tr
      className={cx(
        'kds-table-row',
        selected && 'kds-table-row-selected',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'center' | 'right';
};

export type SortableTableHeadProps = TableHeadProps & {
  label: string;
  sortDirection: 'asc' | 'desc' | null;
  onSort: () => void;
};

export function SortableTableHead({
  label,
  sortDirection,
  onSort,
  align = 'left',
  className,
}: SortableTableHeadProps) {
  const SortIcon = sortDirection === 'asc'
    ? ArrowUp
    : sortDirection === 'desc'
      ? ArrowDown
      : ArrowUpDown;

  return (
    <TableHead
      align={align}
      className={className}
      aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={onSort}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-sm text-inherit transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          align === 'right' && 'ml-auto',
          align === 'center' && 'mx-auto',
        )}
        aria-label={`Ordenar por ${label}`}
        title={sortDirection === 'asc' ? `Ordenado por ${label}, crescente` : sortDirection === 'desc' ? `Ordenado por ${label}, decrescente` : `Ordenar por ${label}`}
      >
        <span>{label}</span>
        <SortIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function TableHead({ align = 'left', className, children, ...props }: TableHeadProps) {
  return (
    <th
      className={cx(
        'kds-table-head',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  align?: 'left' | 'center' | 'right';
};

export function TableCell({ align = 'left', className, children, ...props }: TableCellProps) {
  return (
    <td
      className={cx(
        'kds-table-cell',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export type TableActionsProps = HTMLAttributes<HTMLDivElement>;

export function TableActions({ className, children, ...props }: TableActionsProps) {
  return <div className={cx('kds-table-actions', className)} {...props}>{children}</div>;
}

export default Table;
