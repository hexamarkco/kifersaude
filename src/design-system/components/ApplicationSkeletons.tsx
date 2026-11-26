import type { ReactNode } from 'react';
import { Skeleton } from './LoadingState';
import { ResponsiveCollection } from './Application';
import Table, { TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';
import { Surface } from './Surface';

type PanelCardProps = {
  children: ReactNode;
  className?: string;
};

function PanelCard({ children, className = '' }: PanelCardProps) {
  return (
    <div className={`kds-card kds-card-default p-5 ${className}`}>
      {children}
    </div>
  );
}

export function RecordListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function RecordFieldsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton variant="control" className="w-full" />
        </div>
      ))}
    </div>
  );
}

export function MessageHistorySkeleton() {
  return (
    <div className="space-y-3 px-4 py-5">
      <Skeleton className="mx-auto mb-5 h-5 w-16 rounded-full" />
      <Skeleton variant="block" className="h-12 w-3/5" />
      <Skeleton variant="block" className="ml-auto h-16 w-2/3" />
      <Skeleton variant="block" className="h-14 w-1/2" />
      <Skeleton variant="block" className="ml-auto h-12 w-3/5" />
    </div>
  );
}

function CalendarGridSkeleton({ tone }: { tone: 'success' | 'info' }) {
  const toneClass = tone === 'success' ? 'bg-[var(--success-soft)]' : 'bg-[var(--info-soft)]';

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
        <div key={day} className="flex justify-center py-1">
          <Skeleton variant="line" className="h-3 w-8" />
        </div>
      ))}
      {Array.from({ length: 35 }).map((_, index) => (
        <div
          key={`calendar-cell-${index}`}
          className={`rounded-[var(--kds-radius-sm)] border border-[var(--border-default)] p-2 ${toneClass}`}
        >
          <Skeleton variant="line" className="h-3 w-6" />
          <div className="mt-2 space-y-1">
            <Skeleton variant="line" className="h-2.5 w-12" />
            <Skeleton variant="line" className="h-2.5 w-9" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelBootSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] p-3 sm:p-6">
      <div className="mx-auto flex max-w-[1440px] gap-4">
        <aside className="kds-card kds-card-strong hidden h-[calc(100vh-3rem)] w-64 shrink-0 p-4 lg:flex lg:flex-col">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton variant="avatar" className="h-10 w-10" />
            <Skeleton variant="line" className="h-5 w-28" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={`sidebar-item-${index}`} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-auto space-y-2 pt-6">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <PanelCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-52" />
                <Skeleton variant="line" className="h-4 w-64" />
              </div>
              <Skeleton variant="line" className="h-10 w-32" />
            </div>
          </PanelCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <PanelCard key={`boot-stat-${index}`} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton variant="line" className="h-4 w-24" />
                  <Skeleton variant="avatar" className="h-9 w-9" />
                </div>
                <Skeleton className="h-10 w-2/3" />
                <Skeleton variant="line" className="h-4 w-1/2" />
              </PanelCard>
            ))}
          </div>

          <PanelCard>
            <Skeleton className="h-[320px] w-full rounded-xl" />
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="panel-dashboard-immersive kds-dashboard-workspace" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-2"><Skeleton variant="line" className="h-3 w-40" /><Skeleton className="h-8 w-56 max-w-full" /><Skeleton variant="line" className="h-4 w-72 max-w-full" /></div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="line" className="h-8 w-16" />)}</div>
      <PanelCard className="flex items-center gap-3"><Skeleton className="h-8 w-8" /><Skeleton variant="line" className="h-4 w-64 max-w-full" /></PanelCard>
      <div className="kds-dashboard-metric-grid">{Array.from({ length: 4 }, (_, i) => <PanelCard key={i} className="space-y-3"><Skeleton variant="line" className="h-4 w-28 max-w-full" /><Skeleton className="h-9 w-3/4" /><Skeleton variant="line" className="h-3 w-1/2" /></PanelCard>)}</div>
      <div className="kds-dashboard-columns">{Array.from({ length: 2 }, (_, i) => <PanelCard key={i} className="space-y-3"><Skeleton variant="line" className="h-5 w-40 max-w-full" /><Skeleton className="kds-dashboard-chart-skeleton w-full" /></PanelCard>)}</div>
      <div className="kds-dashboard-columns">{Array.from({ length: 2 }, (_, i) => <PanelCard key={i} className="space-y-3"><Skeleton variant="line" className="h-5 w-40 max-w-full" />{Array.from({ length: 4 }, (_, j) => <Skeleton key={j} className="h-12 w-full" />)}</PanelCard>)}</div>
      <PanelCard className="space-y-3"><Skeleton variant="line" className="h-5 w-56 max-w-full" />{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</PanelCard>
    </div>
  );
}

export function LeadsPageSkeleton() {
  return (
    <div className="kds-leads-skeleton panel-page-shell space-y-5" role="status" aria-label="Carregando leads" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton variant="line" className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-24 shrink-0" />
      </div>
      <Skeleton className="h-10 w-full lg:w-60" />
      <PanelCard className="space-y-3">
        <div className="flex gap-3"><Skeleton className="h-10 min-w-0 flex-1" /><Skeleton className="h-10 w-10 shrink-0" /></div>
        <div className="hidden grid-cols-5 gap-3 lg:grid">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </div>
      </PanelCard>
      <div className="hidden lg:block">
        <PanelCard className="space-y-4">
          <Skeleton className="h-5 w-56" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-t border-[var(--border-subtle)] py-3">
              <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 shrink-0" /><Skeleton className="h-4 min-w-0 flex-1" /></div>
              <Skeleton className="h-7 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" />
            </div>
          ))}
        </PanelCard>
      </div>
      <div className="grid gap-3 lg:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <PanelCard key={index} className="space-y-4">
            <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 shrink-0" /><Skeleton className="h-4 min-w-0 flex-1" /></div>
            <Skeleton className="h-7 w-28" />
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-20 shrink-0" /></div>
          </PanelCard>
        ))}
      </div>
    </div>
  );
}

export function ContractsPageSkeleton() {
  return (
    <div className="panel-dashboard-immersive space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <PanelCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-11 w-full rounded-lg lg:max-w-2xl" />
          <Skeleton variant="line" className="h-10 w-full lg:w-56" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`contract-filter-${index}`} className="space-y-1.5">
              <Skeleton variant="line" className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard className="space-y-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <article key={`contract-row-${index}`} className="kds-card kds-card-default p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-60" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton variant="line" className="h-4 w-24" />
                  <Skeleton variant="line" className="h-4 w-36" />
                  <Skeleton variant="line" className="h-4 w-28" />
                  <Skeleton variant="line" className="h-4 w-20" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
          </article>
        ))}

        <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton variant="line" className="h-4 w-44" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      </PanelCard>
    </div>
  );
}

export function RemindersPageSkeleton({ view = 'month' }: { view?: 'month' | 'week' | 'list' } = {}) {
  return (
    <div className="kds-agenda-page panel-page-shell" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton variant="line" className="h-4 w-72 max-w-full" /></div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="flex gap-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-16" />)}</div>
      {view === 'list' ? <>
        <div className="kds-agenda-toolbar"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-20" /></div>
        <PanelCard className="space-y-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</PanelCard>
      </> : <div className={view === 'month' ? 'kds-agenda-workspace-grid kds-month-layout' : 'kds-agenda-workspace-grid'}>
        <div className="kds-card kds-card-default kds-agenda-calendar">
          <div className="kds-month-header"><Skeleton className="h-5 w-40" /><Skeleton className="h-8 w-24" /></div>
          {view === 'month' ? <>
            <div className="kds-month-weekdays">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="line" className="mx-auto h-3 w-6" />)}</div>
            <div className="kds-month-grid">{Array.from({ length: 42 }, (_, i) => <div key={i} className="kds-agenda-skeleton-cell"><Skeleton className="h-4 w-4" /></div>)}</div>
          </> : <div className="kds-agenda-week-scroll"><div className="kds-agenda-week-grid">
            {Array.from({ length: 80 }, (_, i) => <div key={i} className={i < 8 ? 'kds-agenda-week-heading' : i % 8 === 0 ? 'kds-agenda-week-hour' : 'kds-agenda-week-slot'}>
              {(i < 8 || i % 8 === 0) && <Skeleton variant="line" className="mx-auto h-3 w-8" />}
            </div>)}
          </div></div>}
        </div>
        {view === 'month' && <PanelCard className="space-y-3"><Skeleton className="h-5 w-32" /><Skeleton variant="line" className="h-3 w-40" />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</PanelCard>}
      </div>}
    </div>
  );
}

export function WhatsAppPageSkeleton() {
  return (
    <div className="kds-workspace-skeleton-inbox">
      <div className="min-w-0">
        <div className="space-y-3 border-b border-[var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton variant="control" size="sm" className="w-8" />
          </div>
          <Skeleton variant="control" className="w-full" />
          <div className="flex gap-2">
            <Skeleton variant="control" size="sm" className="w-16" />
            <Skeleton variant="control" size="sm" className="w-24" />
          </div>
        </div>
        <RecordListSkeleton rows={7} />
      </div>
      <div className="kds-workspace-skeleton-thread">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton variant="control" size="sm" className="w-20" />
        </div>
        <div className="flex-1"><MessageHistorySkeleton /></div>
        <div className="border-t border-[var(--border-subtle)] p-4">
          <Skeleton variant="control" className="w-full" />
        </div>
      </div>
    </div>
  );
}

export function BlogTabSkeletonList() {
  return (
    <div role="status" aria-label="Carregando artigos">
      <ResponsiveCollection table={<Table aria-label="Artigos em carregamento" columnWidths={['36%', '14%', '12%', '12%', '14%', '12%']}>
        <TableHeader><TableRow>{Array.from({ length: 6 }, (_, index) => <TableHead key={index}><Skeleton variant="line" className="h-3 w-16" /></TableHead>)}</TableRow></TableHeader>
        <TableBody>{Array.from({ length: 4 }, (_, row) => <TableRow key={row}>
          {Array.from({ length: 6 }, (_, column) => <TableCell key={column}><Skeleton variant="line" className={column === 0 ? 'h-4 w-4/5' : 'h-4 w-16'} /></TableCell>)}
        </TableRow>)}</TableBody>
      </Table>} cards={<div className="grid gap-3">{Array.from({ length: 4 }, (_, index) => <Surface key={index} padding="sm" className="space-y-3">
        <Skeleton variant="line" className="h-4 w-3/4" /><Skeleton variant="line" className="h-4 w-full" />
        <Skeleton variant="line" className="h-4 w-1/2" /><Skeleton variant="line" className="h-4 w-2/3" />
      </Surface>)}</div>} />
    </div>
  );
}

export function CommissionCalendarSkeleton() {
  return (
    <section className="kds-card kds-card-default space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton variant="line" className="h-4 w-80" />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1">
            <Skeleton variant="line" className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
          <div className="space-y-1">
            <Skeleton variant="line" className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--kds-radius-md)] border border-[var(--border-default)]">
        <div className="flex items-center justify-between bg-[var(--bg-inset)] px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="p-4">
          <CalendarGridSkeleton tone="success" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard>
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </PanelCard>
        <PanelCard>
          <Skeleton className="h-6 w-44" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`commission-event-${index}`} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </PanelCard>
      </div>
    </section>
  );
}

export function TodoCalendarSkeleton() {
  return (
    <section className="kds-card kds-card-default space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton variant="line" className="h-4 w-72" />
        </div>
        <div className="flex gap-4">
          <Skeleton variant="line" className="h-5 w-36" />
          <Skeleton variant="line" className="h-5 w-36" />
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--kds-radius-md)] border border-[var(--border-default)]">
        <div className="flex items-center justify-between bg-[var(--bg-inset)] px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="p-4">
          <CalendarGridSkeleton tone="info" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard>
          <Skeleton className="h-6 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`todo-open-${index}`} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </PanelCard>
        <PanelCard>
          <Skeleton className="h-6 w-28" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`todo-done-${index}`} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </PanelCard>
      </div>
    </section>
  );
}

export function SystemSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <Skeleton variant="line" className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton variant="line" className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <PanelCard className="space-y-4 xl:col-span-7">
          <div className="flex items-center gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton variant="line" className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`system-location-field-${index}`} className="space-y-2">
                <Skeleton variant="line" className="h-4 w-40" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton variant="line" className="h-3 w-48" />
              </div>
            ))}
          </div>
        </PanelCard>
        <PanelCard className="space-y-4 xl:col-span-5">
          <div className="flex items-center gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton variant="line" className="h-4 w-52 max-w-full" />
            </div>
          </div>
          <Skeleton variant="line" className="h-4 w-44" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton variant="line" className="h-3 w-64 max-w-full" />
        </PanelCard>
        <PanelCard className="space-y-4 xl:col-span-12">
          <div className="flex items-center gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton variant="line" className="h-4 w-56 max-w-full" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <Skeleton className="h-10 w-64 max-w-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-4 border-t pt-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`system-notification-field-${index}`} className="space-y-2">
                <Skeleton variant="line" className="h-4 w-48" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton variant="line" className="h-3 w-40" />
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <PanelCard key={`system-module-${index}`}>
            <Skeleton className="h-6 w-56" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </PanelCard>
        ))}
      </div>
    </div>
  );
}

export function OperadorasSkeleton() {
  return (
    <div className="space-y-6">
      <PanelCard className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`operadora-row-${index}`} className="kds-card kds-card-default p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton variant="line" className="h-4 w-24" />
                    <Skeleton variant="line" className="h-4 w-24" />
                    <Skeleton variant="line" className="h-4 w-20" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div className="space-y-6">
      <PanelCard className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`user-row-${index}`} className="kds-card kds-card-default p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton variant="line" className="h-3.5 w-48" />
                    <Skeleton variant="line" className="h-3.5 w-24" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
      <PanelCard>
        <Skeleton className="h-28 w-full rounded-xl" />
      </PanelCard>
    </div>
  );
}

export function IntegrationsSkeleton() {
  return (
    <div className="space-y-8">
      <PanelCard className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton variant="line" className="h-4 w-80" />
        </div>
        <div className="kds-card kds-card-default p-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton variant="line" className="mt-2 h-4 w-11/12" />
          <Skeleton variant="line" className="mt-1 h-4 w-10/12" />
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-14 w-full rounded-lg" />
          <div className="mt-4 flex justify-end">
            <Skeleton className="h-10 w-44 rounded-lg" />
          </div>
        </div>
      </PanelCard>

      <PanelCard className="space-y-4">
        <Skeleton className="h-7 w-52" />
        <Skeleton variant="line" className="h-4 w-72" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </PanelCard>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PanelCard className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton variant="line" className="h-4 w-56" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </PanelCard>
        <PanelCard className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <Skeleton variant="line" className="h-4 w-56" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </PanelCard>
      </div>

      <PanelCard>
        <Skeleton className="h-20 w-full rounded-xl" />
      </PanelCard>
    </div>
  );
}

export function AutomationFlowsSkeleton() {
  return (
    <div className="kds-card kds-card-default p-6">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`automation-metric-${index}`} className="kds-card kds-card-muted p-4">
              <Skeleton variant="line" className="h-3 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton variant="line" className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="kds-card kds-card-default p-4">
            <Skeleton className="h-6 w-32" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
          <div className="kds-card kds-card-default p-4">
            <Skeleton className="h-6 w-44" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="kds-card kds-card-default space-y-3 p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`automation-flow-${index}`} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <div className="kds-card kds-card-default space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-2/3 rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppApiSkeleton() {
  return (
    <PanelCard className="space-y-6">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton variant="line" className="h-4 w-40" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton variant="line" className="h-3 w-80" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
    </PanelCard>
  );
}
