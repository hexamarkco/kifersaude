import { Activity, BarChart3, Bot, Settings2 } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';

type WhatsAppDashboardModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const placeholderCards = [
  {
    title: 'Saude do canal',
    description: 'Status da conexao, webhook, fila e disponibilidade operacional do WhatsApp.',
    icon: Activity,
  },
  {
    title: 'Metricas e volume',
    description: 'Conversas por periodo, tempo de resposta, nao lidas e indicadores do time.',
    icon: BarChart3,
  },
  {
    title: 'Configuracoes do modulo',
    description: 'Preferencias do inbox, acoes rapidas, politicas de atendimento e integracoes do canal.',
    icon: Settings2,
  },
  {
    title: 'Automacoes futuras',
    description: 'Espaco reservado para controles de IA, follow-up, regras operacionais e stats dedicadas.',
    icon: Bot,
  },
];

export default function WhatsAppDashboardModal({ isOpen, onClose }: WhatsAppDashboardModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Painel WhatsApp"
      description="Area reservada para configuracoes e dashboard do modulo. O painel ja esta estruturado, mas permanece desabilitado nesta etapa."
      size="lg"
      panelClassName="config-transparent-buttons"
      footer={(
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--panel-text-muted,#876f5c)]">
            Em breve vamos trazer controles operacionais e estatisticas detalhadas aqui.
          </div>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                Roadmap do modulo
              </p>
              <h3 className="mt-1 text-base font-semibold text-[var(--panel-text,#1a120d)]">
                Painel estruturado, ainda indisponivel
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">
                Este espaco vai concentrar configuracoes do canal, indicadores do inbox e operacao do WhatsApp.
                Por enquanto, o acesso fica restrito a este placeholder para sinalizar a evolucao futura do modulo.
              </p>
            </div>

            <div className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
              Desabilitado por enquanto
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {placeholderCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-4 opacity-80"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-accent-ink,#8b4d12)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">{card.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">{card.description}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                      Disponivel em breve
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
