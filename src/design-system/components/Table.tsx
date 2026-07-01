import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';

export type TableSize = 'sm' | 'md';

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  size?: TableSize;
  striped?: boolean;
  stickyHeader?: boolean;
};

const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { size = 'md', striped = false, stickyHeader = false, className, children, ...props },
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

export default Table;
