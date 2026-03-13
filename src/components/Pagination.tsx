import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { cx } from '../lib/cx';
import FilterSingleSelect from './FilterSingleSelect';
import Button from './ui/Button';
import { isPanelDarkTheme } from './ui/dropdownStyles';

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
  const isDarkTheme = isPanelDarkTheme();

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
    <div className="panel-glass-panel flex flex-col gap-3 border-t border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--panel-text-soft,#5b4635)]">Itens por página:</span>
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
        <span className="text-sm text-[var(--panel-text-soft,#5b4635)]">
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
                <span className="px-3 py-1 text-[var(--panel-text-muted,#876f5c)]">...</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPageChange(page as number)}
                  className={cx(
                    'inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel-bg,#f8f5ef)]',
                    currentPage === page
                      ? isDarkTheme
                        ? 'border border-[var(--panel-accent-strong,#c86f1d)] bg-[color:rgba(200,111,29,0.24)] text-[var(--panel-accent-foreground,#f7d7b4)] shadow-sm hover:border-[var(--panel-accent,#df8f3b)] hover:bg-[color:rgba(200,111,29,0.34)]'
                        : 'border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm hover:border-[var(--panel-accent-strong,#b85c1f)] hover:bg-[color:var(--panel-accent-hover,#efcf9f)] hover:text-[var(--panel-accent-ink-strong,#4a2411)]'
                      : isDarkTheme
                        ? 'border border-transparent text-[var(--panel-text-soft,#d8c0ab)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:var(--panel-surface-soft,#2a1d15)] hover:text-[var(--panel-text,#f7efe5)]'
                        : 'border border-transparent text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-border,#d4c0a7)] hover:bg-[color:var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1a120d)]',
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
