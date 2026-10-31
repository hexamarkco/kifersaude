import { createRoot } from 'react-dom/client';
import { Activity, ArrowUpRight, Send } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  KpiCard,
  PageHeader,
  SectionHeader,
} from '../../../src/design-system';
import { CampaignDeliveryStatusCard } from '../../../src/features/communication/whatsapp-campaigns/components/CampaignDeliveryStatusCard';
import type { CommWhatsAppCampaignWorkerHealth } from '../../../src/features/communication/whatsapp-campaigns/commWhatsAppCampaignService';
import '../../../src/index.css';

const latestRun: CommWhatsAppCampaignWorkerHealth['latestRun'] = {
  id: 'demo-run',
  action: 'process',
  source: 'cron',
  status: 'failed',
  campaign_id: null,
  processed: 25,
  sent: 0,
  failed: 1,
  stopped: 0,
  duration_ms: 900,
  error_message: 'Falha de demonstração',
  started_at: '2026-10-29T15:00:00.000Z',
  finished_at: '2026-10-29T15:00:01.000Z',
  created_at: '2026-10-29T15:00:00.000Z',
};

const health: CommWhatsAppCampaignWorkerHealth = {
  latestRun,
  latestSuccess: null,
  latestFailure: latestRun,
  recentRuns: [latestRun],
};

function App() {
  return (
    <div className="painel-theme theme-light kifer-ds comm-terracotta comm-terracotta-campaigns min-h-screen bg-[var(--bg-canvas)] p-6">
      <main className="panel-page-shell mx-auto max-w-[1500px] space-y-5">
        <PageHeader
          eyebrow="Comunicação"
          title="Disparos WhatsApp"
          description="Planeje campanhas, acompanhe entregas e controle mensagens."
          actions={<Button><Send className="kds-control-icon" />Novo disparo</Button>}
        />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo das campanhas">
          <KpiCard padding="sm" title="Campanhas" value="12" trend="Total cadastrado" />
          <KpiCard padding="sm" title="Rascunhos" value="3" trend="Aguardam revisão" />
          <KpiCard padding="sm" title="Agendadas" value="5" trend="Com horário de envio" />
          <KpiCard padding="sm" title="Ativas ou pausadas" value="4" trend="Na fila, em execução ou pausadas" />
        </div>
        <CampaignDeliveryStatusCard health={health} available loading={false} />
        <Card>
          <SectionHeader title="Campanhas recentes" description="Acompanhe o público, os envios e o status de cada disparo." />
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-[color:var(--panel-border-subtle)] pt-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--panel-surface-soft)]"><Activity className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="truncate font-medium">Campanha de demonstração</div>
                <div className="text-xs text-[color:var(--panel-text-muted)]">Planilha CSV · 240 contatos</div>
              </div>
            </div>
            <Badge tone="warning">Pausado</Badge>
            <Button variant="tertiary" size="sm"><ArrowUpRight className="kds-control-icon" />Abrir</Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
