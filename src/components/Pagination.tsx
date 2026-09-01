import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter, MoreHorizontal } from 'lucide-react';
import { cx } from '../lib/cx';
import FilterSingleSelect from './FilterSingleSelect';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
};

export default function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const [isDesktopPagination, setIsDesktopPagination] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  ));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = () => setIsDesktopPagination(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = isDesktopPagination ? 9 : 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (!isDesktopPagination) {
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages);
    } else {
      const innerSlots = maxVisible - 2;
      let start = Math.max(2, currentPage - Math.floor(innerSlots / 2));
      let end = Math.min(totalPages - 1, start + innerSlots - 1);

      start = Math.max(2, end - innerSlots + 1);

      pages.push(1);
      if (start > 2) pages.push('...');

      for (let page = start; page <= end; page += 1) {
        pages.push(page);
      }

      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="kds-op-pagination">
      <div className="kds-op-pagination-summary">
        <span className="kds-op-lead-meta kds-op-pagination-label">Itens por página:</span>
        <div className="w-28 shrink-0">
          <FilterSingleSelect
            icon={ListFilter}
            value={String(itemsPerPage)}
            onChange={(value) => onItemsPerPageChange(Number(value))}
            placeholder="25"
            includePlaceholderOption={false}
            size="compact"
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />
        </div>
        <span className="kds-op-lead-meta">
          {startItem}-{endItem} de {totalItems}
        </span>
      </div>

      <div className="kds-op-pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="kds-op-page-button"
          title="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="kds-op-pagination-pages" aria-label="Páginas disponíveis">
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="kds-op-page-ellipsis" aria-hidden="true"><MoreHorizontal className="h-4 w-4" /></span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPageChange(page as number)}
                  className={cx('kds-op-page-button', currentPage === page && 'is-active')}
                  aria-current={currentPage === page ? 'page' : undefined}
                  aria-label={`Ir para a pagina ${page}`}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="kds-op-page-button"
          title="Proxima pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
