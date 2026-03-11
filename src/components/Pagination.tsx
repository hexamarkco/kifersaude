import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { cx } from '../lib/cx';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';

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
    <div className="panel-glass-panel flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-700">Itens por pagina:</span>
        <div className="w-28">
          <FilterSingleSelect
            icon={ListFilter}
            value={String(itemsPerPage)}
            onChange={(value) => onItemsPerPageChange(Number(value))}
            placeholder="25"
            includePlaceholderOption={false}
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />
        </div>
        <span className="text-sm text-slate-700">
          {startItem}-{endItem} de {totalItems}
        </span>
      </div>

      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
        <Button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          variant="secondary"
          size="icon"
          className="h-10 w-10"
          title="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
          {getPageNumbers().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-3 py-1 text-slate-500">...</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPageChange(page as number)}
                  className={cx(
                    'inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    currentPage === page
                      ? 'border border-amber-300/90 bg-amber-100/80 text-amber-900 shadow-sm hover:border-amber-400/90 hover:bg-amber-200/75 hover:text-amber-950'
                      : 'border border-transparent text-slate-700 hover:border-slate-300/70 hover:bg-white/70 hover:text-slate-900',
                  )}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          variant="secondary"
          size="icon"
          className="h-10 w-10"
          title="Proxima pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
