import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { cx } from '../../lib/cx';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
  className?: string;
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
}: PaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages, maxVisible);

  return (
    <nav
      aria-label="Paginacao"
      className={cx('kds-pagination', className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="kds-pagination-button"
        aria-label="Pagina anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="kds-pagination-pages">
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`e-${index}`} className="kds-pagination-ellipsis">
              <MoreHorizontal className="h-4 w-4" />
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
        aria-label="Proxima pagina"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
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
