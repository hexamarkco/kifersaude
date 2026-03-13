import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

type PanelCardProps = {
  children: ReactNode;
  className?: string;
};

function PanelCard({ children, className = '' }: PanelCardProps) {
  return (
    <div className={`panel-glass-panel rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CalendarGridSkeleton({ accentClass }: { accentClass: string }) {
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
          className={`rounded-lg border border-slate-200 bg-slate-50/70 p-2 ${accentClass}`}
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
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="mx-auto flex max-w-[1440px] gap-4">
        <aside className="panel-glass-strong hidden h-[calc(100vh-3rem)] w-64 shrink-0 rounded-2xl border border-slate-200 p-4 lg:flex lg:flex-col">
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
    <div className="panel-dashboard-immersive space-y-6">
      <div className="panel-glass-panel rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-52" />
              <Skeleton variant="line" className="h-4 w-80" />
            </div>
            <div className="flex w-full flex-wrap gap-2 lg:w-auto">
              <Skeleton variant="line" className="h-9 w-28" />
              <Skeleton variant="line" className="h-9 w-28" />
              <Skeleton variant="line" className="h-9 w-28" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <div className="space-y-3 xl:col-span-8">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-44 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
                <Skeleton className="h-10 w-36 rounded-lg" />
                <Skeleton className="h-10 w-36 rounded-lg" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-56 rounded-lg" />
                <Skeleton className="h-10 w-56 rounded-lg" />
              </div>
            </div>

            <div className="space-y-2 xl:col-span-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <PanelCard key={`dashboard-primary-${index}`} className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="line" className="h-4 w-28" />
              <Skeleton variant="avatar" className="h-10 w-10" />
            </div>
            <Skeleton className="h-11 w-3/4" />
            <Skeleton variant="line" className="h-4 w-1/2" />
          </PanelCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <PanelCard key={`dashboard-secondary-${index}`} className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="line" className="h-4 w-32" />
              <Skeleton variant="avatar" className="h-9 w-9" />
            </div>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton variant="line" className="h-4 w-1/2" />
          </PanelCard>
        ))}
      </div>

      <PanelCard className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton variant="line" className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="mt-2 grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[320px] w-full rounded-xl lg:col-span-3" />
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-44" />
            <Skeleton variant="line" className="h-4 w-20" />
          </div>
          <Skeleton className="h-[240px] w-full rounded-xl" />
        </PanelCard>
        <PanelCard className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton variant="line" className="h-4 w-24" />
          </div>
          <Skeleton className="h-[240px] w-full rounded-xl" />
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelCard className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </PanelCard>
        <PanelCard className="space-y-3">
          <Skeleton className="h-6 w-56" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={`dashboard-list-${index}`} className="h-16 w-full rounded-xl" />
          ))}
        </PanelCard>
      </div>
    </div>
  );
}

export function LeadsPageSkeleton() {
  return (
    <div className="panel-dashboard-immersive space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <Skeleton variant="line" className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-56" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      <PanelCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-11 w-full rounded-lg lg:max-w-2xl" />
          <Skeleton variant="line" className="h-10 w-full lg:w-56" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`lead-filter-${index}`} className="space-y-1.5">
              <Skeleton variant="line" className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton variant="line" className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {Array.from({ length: 7 }).map((_, index) => (
          <article key={`lead-row-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-52" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton variant="line" className="h-4 w-24" />
                  <Skeleton variant="line" className="h-4 w-28" />
                  <Skeleton variant="line" className="h-4 w-32" />
                  <Skeleton variant="line" className="h-4 w-24" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
          </article>
        ))}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
          <article key={`contract-row-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
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

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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

export function RemindersPageSkeleton() {
  return (
    <div className="panel-dashboard-immersive space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-64" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <PanelCard key={`reminder-stat-${index}`} className="space-y-2">
            <Skeleton variant="line" className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </PanelCard>
        ))}
      </div>

      <PanelCard className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Skeleton className="h-10 w-full rounded-lg lg:flex-1" />
          <Skeleton className="h-10 w-full rounded-lg lg:w-52" />
          <Skeleton className="h-10 w-full rounded-lg lg:w-44" />
        </div>
        <div className="space-y-6">
          {['Atrasados', 'Hoje', 'Amanhã'].map((group, groupIndex) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton variant="line" className="h-5 w-24" />
                  <Skeleton variant="line" className="h-5 w-16" />
                </div>
                <Skeleton variant="line" className="h-4 w-20" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: groupIndex === 0 ? 2 : 1 }).map((_, index) => (
                  <article
                    key={`${group}-reminder-${index}`}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-56" />
                        <Skeleton variant="line" className="h-4 w-32" />
                        <Skeleton variant="line" className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-8 w-8 rounded-full" />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

export function WhatsAppPageSkeleton() {
  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <aside className="w-full border-r border-slate-200 bg-white md:w-96">
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-28" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`chat-filter-${index}`} variant="line" className="h-7 w-20" />
            ))}
          </div>
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={`chat-row-${index}`} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start gap-3">
                <Skeleton variant="avatar" className="h-11 w-11" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton variant="line" className="h-4 w-24" />
                    <Skeleton variant="line" className="h-3 w-10" />
                  </div>
                  <Skeleton variant="line" className="h-3.5 w-11/12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" className="h-10 w-10" />
            <div className="space-y-1.5">
              <Skeleton variant="line" className="h-4 w-36" />
              <Skeleton variant="line" className="h-3 w-28" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-hidden p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={`message-bubble-${index}`}
              className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
            >
              <Skeleton className={`h-14 ${index % 3 === 0 ? 'w-80' : 'w-64'} rounded-2xl`} />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function BlogTabSkeletonList() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <article key={`blog-admin-row-${index}`} className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-32 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton variant="line" className="h-5 w-20" />
                <Skeleton variant="line" className="h-5 w-20" />
                <Skeleton variant="line" className="h-5 w-16" />
              </div>
              <Skeleton className="h-5 w-4/5" />
              <Skeleton variant="line" className="h-4 w-full" />
              <Skeleton variant="line" className="h-4 w-2/3" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CommissionCalendarSkeleton() {
  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

      <div className="rounded-xl border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="p-4">
          <CalendarGridSkeleton accentClass="bg-emerald-50/40" />
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
    <section className="panel-glass-panel space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
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

      <div className="rounded-[1.7rem] border border-slate-200">
        <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="p-4">
          <CalendarGridSkeleton accentClass="bg-sky-50/40" />
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
      <PanelCard className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="h-10 w-10" />
          <Skeleton className="h-7 w-52" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`system-field-${index}`} className="space-y-2">
              <Skeleton variant="line" className="h-4 w-40" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-44 rounded-lg" />
        </div>
      </PanelCard>
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
            <div key={`operadora-row-${index}`} className="rounded-lg border border-slate-200 p-4">
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
            <div key={`user-row-${index}`} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton variant="avatar" className="h-10 w-10" />
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
        <div className="rounded-xl border border-slate-200 p-4">
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`automation-metric-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <Skeleton variant="line" className="h-3 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton variant="line" className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <Skeleton className="h-6 w-32" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
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
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`automation-flow-${index}`} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
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
