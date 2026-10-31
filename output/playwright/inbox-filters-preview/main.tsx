import { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, CheckCheck, MessageCircle, Search, UserRound } from 'lucide-react';

import {
  Badge,
  Button,
  Heading,
  Input,
  Text,
} from '../../../src/design-system';
import '../../../src/index.css';
import { getAdvancedFiltersPosition, type InboxOverlayPosition } from '../../../src/features/communication/whatsapp/domain/inboxOverlayPosition';
import { WhatsAppInboxAdvancedFiltersDialog, type InboxAdvancedFilterValues } from '../../../src/features/communication/whatsapp/components/WhatsAppInboxAdvancedFiltersDialog';

function InboxFiltersPreview() {
  const initialTheme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
  const [theme, setTheme] = useState(initialTheme);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [position, setPosition] = useState<InboxOverlayPosition | null>(null);
  const [filters, setFilters] = useState<InboxAdvancedFilterValues>({
    activityFilter: 'all',
    leadStatusFilters: [],
    leadResponsavelFilters: [],
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount = (filters.activityFilter !== 'all' ? 1 : 0) + filters.leadStatusFilters.length + filters.leadResponsavelFilters.length;

  useLayoutEffect(() => {
    if (!filtersOpen) return;
    const sync = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      setPosition(getAdvancedFiltersPosition(trigger.getBoundingClientRect(), {
        width: window.innerWidth,
        height: window.innerHeight,
      }));
    };
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [filtersOpen]);

  return (
    <div className={`painel-theme kifer-ds kds-operational comm-terracotta theme-${theme} min-h-screen`}>
      <header className="flex min-h-24 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4">
        <div className="min-w-0">
          <Text size="xs" tone="brand" weight="semibold" className="uppercase tracking-[0.14em]">Kifer Saúde · Comunicação</Text>
          <Heading level={1} size="lg" family="interface" className="mt-1">WhatsApp Inbox</Heading>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}>
            Tema {theme === 'light' ? 'escuro' : 'claro'}
          </Button>
          <Button type="button" variant="primary"><MessageCircle aria-hidden="true" /> Nova conversa</Button>
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-6rem)] grid-cols-1 overflow-hidden xl:grid-cols-[19rem_minmax(0,1fr)_18rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="whatsapp-inbox-panel flex min-h-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Text size="xs" weight="semibold" className="uppercase tracking-[0.14em]">Conversas</Text>
            <Badge tone="neutral" size="sm">6 abertas</Badge>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <Input aria-label="Buscar conversas" placeholder="Buscar por nome ou telefone" className="pl-9" />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant={activeFilterCount ? 'secondary' : 'soft'} size="sm" onClick={() => setFilters({ activityFilter: 'all', leadStatusFilters: [], leadResponsavelFilters: [] })}>Todas</Button>
            <Button ref={triggerRef} type="button" variant={filtersOpen || activeFilterCount ? 'soft' : 'secondary'} size="sm" aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}>
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>
          {[
            ['Ana Oliveira', 'Preciso de uma cotação', '09:41', 'Atendimento'],
            ['Bruno Martins', 'Pode me explicar os planos?', '09:33', 'Contato inicial'],
            ['Camila Santos', 'Obrigada pelo retorno', '09:18', 'Convertido'],
            ['Daniela Rocha', 'Tenho interesse para minha família', 'Ontem', 'Proposta enviada'],
          ].map(([name, message, time, status]) => (
            <button key={name} type="button" className="flex items-start gap-3 border-t border-[var(--border-subtle)] px-2 py-3 text-left hover:bg-[var(--bg-hover)]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--brand-primary-muted)] text-xs font-semibold text-[var(--brand-primary-active)]">{name.split(' ').map(part => part[0]).join('')}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2"><Text as="span" size="sm" weight="semibold" className="truncate">{name}</Text><Text as="span" size="xs" tone="muted">{time}</Text></span>
                <Text size="xs" tone="muted" className="truncate">{message}</Text>
                <Badge tone="neutral" size="sm" className="mt-1">{status}</Badge>
              </span>
            </button>
          ))}
        </aside>

        <section className="flex min-h-[32rem] min-w-0 flex-col bg-[var(--bg-inset)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-4">
            <div className="min-w-0"><Heading level={3} size="sm" family="interface">Ana Oliveira</Heading><Text size="xs" tone="muted">Em atendimento · WhatsApp</Text></div>
            <Button type="button" variant="secondary" size="sm"><Search aria-hidden="true" /> Buscar</Button>
          </div>
          <div className="flex-1 space-y-4 overflow-hidden p-5">
            <div className="max-w-[70%] rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"><Text size="sm">Olá! Gostaria de conhecer as opções de planos de saúde para minha família.</Text><Text size="xs" tone="muted" className="mt-2">09:41</Text></div>
            <div className="ml-auto max-w-[70%] rounded-[var(--radius-panel)] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-muted)] p-3"><Text size="sm">Claro! Posso ajudar. Quantas pessoas fazem parte da família?</Text><Text size="xs" tone="muted" className="mt-2 text-right">09:42 <CheckCheck className="inline h-3.5 w-3.5" aria-label="Entregue" /></Text></div>
          </div>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"><Input aria-label="Escreva uma mensagem" placeholder="Escreva uma mensagem..." /></div>
        </section>

        <aside className="hidden min-h-0 border-l border-[var(--border-default)] bg-[var(--bg-surface)] p-4 xl:block">
          <Text size="xs" tone="brand" weight="semibold" className="uppercase tracking-[0.12em]">Informações do contato</Text>
          <Heading level={3} size="sm" family="interface" className="mt-3">Ana Oliveira</Heading>
          <Text size="sm" tone="muted" className="mt-1">+55 (21) 98888-0000</Text>
          <div className="mt-4 flex items-center gap-2"><UserRound className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /><Text size="sm">Responsável: Luiza</Text></div>
          <div className="mt-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /><Text size="sm">Próximo lembrete: amanhã</Text></div>
        </aside>
      </main>

      <WhatsAppInboxAdvancedFiltersDialog
        isOpen={filtersOpen}
        position={position}
        activityFilter={filters.activityFilter}
        leadStatusFilters={filters.leadStatusFilters}
        leadResponsavelFilters={filters.leadResponsavelFilters}
        statusOptions={[
          { value: 'Contato inicial', label: 'Contato inicial' },
          { value: 'Atendimento', label: 'Atendimento' },
          { value: 'Proposta enviada', label: 'Proposta enviada' },
          { value: 'Convertido', label: 'Convertido' },
        ]}
        responsavelOptions={[
          { value: 'luiza', label: 'Luiza' },
          { value: 'nick', label: 'Nick' },
          { value: 'claudia', label: 'Claudia' },
        ]}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<InboxFiltersPreview />);
