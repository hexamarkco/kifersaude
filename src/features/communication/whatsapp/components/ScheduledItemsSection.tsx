import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

import { Button } from '../../../../design-system';

const PAGE_SIZE = 5;

type ScheduledItemsSectionProps<T> = {
  title: string;
  icon: LucideIcon;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
};

export default function ScheduledItemsSection<T>({ title, icon: Icon, items, renderItem }: ScheduledItemsSectionProps<T>) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(true);
  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return (
    <section className="space-y-2" aria-label={title}>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
      >
        <Icon className="kds-control-icon text-[var(--brand-primary)]" aria-hidden="true" />
        <span className="flex-1 text-left font-semibold">{title} ({items.length})</span>
        <ChevronDown className={`kds-control-icon transition-transform ${expanded ? '' : '-rotate-90'}`} aria-hidden="true" />
      </Button>
      <div id={contentId} hidden={!expanded} className="space-y-2">
        {items.slice(start, start + PAGE_SIZE).map(renderItem)}
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[var(--text-muted)]">Nenhum agendamento nesta seção.</p>
        ) : (
          <nav aria-label={`Paginação de ${title}`} className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="text-xs text-[var(--text-muted)]" aria-live="polite">
              {start + 1}–{Math.min(start + PAGE_SIZE, items.length)} de {items.length} · Página {page} de {pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label={`Página anterior de ${title}`}>
                <ChevronLeft className="kds-control-icon" aria-hidden="true" /> Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label={`Próxima página de ${title}`}>
                Próxima <ChevronRight className="kds-control-icon" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}
