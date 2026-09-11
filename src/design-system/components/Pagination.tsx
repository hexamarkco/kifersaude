import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cx } from '../../lib/cx';
import Select from './Select';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
  className?: string;
  itemsPerPage?: number;
  totalItems?: number;
  pageSizeOptions?: readonly number[];
  onItemsPerPageChange?: (itemsPerPage: number) => void;
};

function getPageNumbers(current: number, total: number, maxVisible: number): (number | 'ellipsis')[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) pages.push('ellipsis');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('ellipsis');

  pages.push(total);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisible = 5,
  className,
  itemsPerPage,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onItemsPerPageChange,
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages, maxVisible);
  const hasSummary = typeof itemsPerPage === 'number' && typeof totalItems === 'number';
  const startItem = hasSummary && totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = hasSummary ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  return (
    <nav
      aria-label="Paginacao"
      className={cx('kds-pagination', className)}
    >
      {hasSummary && (
        <div className="kds-pagination-summary">
          {onItemsPerPageChange && (
            <label className="kds-pagination-page-size">
              <span>Itens por página</span>
              <Select
                size="sm"
                value={String(itemsPerPage)}
                onChange={(event) => onItemsPerPageChange(Number(event.target.value))}
                options={pageSizeOptions.map((option) => ({ value: String(option), label: String(option) }))}
                aria-label="Itens por página"
              />
            </label>
          )}
          <PaginationInfo start={startItem} end={endItem} total={totalItems} />
        </div>
      )}

      <div className="kds-pagination-controls">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="kds-pagination-button"
        aria-label="Pagina anterior"
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <div className="kds-pagination-pages">
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`e-${index}`} className="kds-pagination-ellipsis">
              <MoreHorizontal aria-hidden="true" />
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cx(
                'kds-pagination-page',
                currentPage === page && 'kds-pagination-page-active',
              )}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="kds-pagination-button"
        aria-label="Próxima página"
      >
        <ChevronRight aria-hidden="true" />
      </button>
      </div>
    </nav>
  );
}

export type PaginationInfoProps = {
  start: number;
  end: number;
  total: number;
  className?: string;
};

export function PaginationInfo({ start, end, total, className }: PaginationInfoProps) {
  return (
    <span className={cx('kds-pagination-info', className)}>
      {start}–{end} de {total}
    </span>
  );
}
