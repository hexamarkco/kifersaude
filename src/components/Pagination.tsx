import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
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
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
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
    }

    return pages;
  };

  return (
    <div className="kds-op-pagination">
      <div className="flex flex-wrap items-center gap-2">
        <span className="kds-op-lead-meta">Itens por página:</span>
        <div className="w-20">
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

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="kds-op-page-button"
          title="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="kds-op-page-ellipsis">...</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPageChange(page as number)}
                  className={cx('kds-op-page-button', currentPage === page && 'is-active')}
                  aria-current={currentPage === page ? 'page' : undefined}
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
