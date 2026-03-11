import { Bot, Sparkles } from 'lucide-react';

import AutoContactFlowSettings from './AutoContactFlowSettings';

export default function AutomationFlowsTab() {
  return (
    <div className="panel-page-shell space-y-6">
      <section className="rounded-3xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--panel-text-muted)]">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              Automacoes
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-[var(--panel-text)]">Fluxos de automacao</h2>
                <p className="max-w-3xl text-sm leading-6 text-[var(--panel-text-muted)]">
                  Crie automacoes generalistas com gatilhos, condicoes, bifurcacoes e acoes em um fluxo mais
                  consistente com o restante de configuracoes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4 shadow-sm md:p-6">
        <AutoContactFlowSettings />
      </section>
    </div>
  );
}
