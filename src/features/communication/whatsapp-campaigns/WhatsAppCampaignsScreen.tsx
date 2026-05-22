import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Bot, CalendarClock, FileSpreadsheet, MessageCircle, PauseCircle, PlayCircle, RefreshCw, Send, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

import { Alert, Badge, Button, Card, Input, PageHeader, Textarea } from '../../../design-system';
import { toast } from '../../../lib/toast';
import { cx } from '../../../lib/cx';
import {
  commWhatsAppCampaignService,
  type CampaignStats,
  type CommWhatsAppCampaign,
  type CommWhatsAppCampaignAudienceSource,
  type CommWhatsAppCsvTargetDraft,
} from './commWhatsAppCampaignService';

type AudienceMode = 'crm' | 'csv';

const statusLabels: Record<CommWhatsAppCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  queued: 'Na fila',
  running: 'Rodando',
  paused: 'Pausado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
};

const statusTones: Record<CommWhatsAppCampaign['status'], 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'accent',
  queued: 'warning',
  running: 'success',
  paused: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

const splitCsvLine = (line: string) => {
  const delimiter = line.includes(';') ? ';' : ',';
  return line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
};

const parseCsvTargets = (raw: string): CommWhatsAppCsvTargetDraft[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const hasHeader = headers.some((header) => ['nome', 'name', 'telefone', 'phone', 'celular'].includes(header));
  const startIndex = hasHeader ? 1 : 0;
  const nameIndex = hasHeader ? Math.max(headers.indexOf('nome'), headers.indexOf('name')) : 0;
  const phoneIndex = hasHeader
    ? ['telefone', 'phone', 'celular', 'whatsapp'].map((key) => headers.indexOf(key)).find((index) => index >= 0) ?? 1
    : 1;

  return lines.slice(startIndex).flatMap((line) => {
    const values = splitCsvLine(line);
    const phoneNumber = values[phoneIndex] ?? '';
    const displayName = values[nameIndex] ?? '';
    const payload = Object.fromEntries(values.map((value, index) => [hasHeader ? headers[index] || `coluna_${index + 1}` : `coluna_${index + 1}`, value]));

    if (!phoneNumber.trim()) return [];
    return [{ displayName, phoneNumber, payload }];
  });
};

const defaultStats: CampaignStats = {
  total: 0,
  drafts: 0,
  scheduled: 0,
  active: 0,
  aiSuggestionsPending: 0,
};

export default function WhatsAppCampaignsScreen() {
  const [campaigns, setCampaigns] = useState<CommWhatsAppCampaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('crm');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [messageText, setMessageText] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [leadOwner, setLeadOwner] = useState('');
  const [csvText, setCsvText] = useState('');
  const [createLeadsFromCsv, setCreateLeadsFromCsv] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [pacingPerMinute, setPacingPerMinute] = useState(12);

  const csvTargets = useMemo(() => parseCsvTargets(csvText), [csvText]);
  const csvValidTargets = useMemo(
    () => csvTargets.filter((target) => commWhatsAppCampaignService.normalizePhoneDigits(target.phoneNumber).length > 0),
    [csvTargets],
  );

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCampaigns, nextStats] = await Promise.all([
        commWhatsAppCampaignService.listCampaigns(),
        commWhatsAppCampaignService.getStats(),
      ]);
      setCampaigns(nextCampaigns);
      setStats(nextStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar os disparos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleCreateDraft = async () => {
    if (!name.trim()) {
      toast.warning('Informe um nome para o disparo.');
      return;
    }

    if (!messageText.trim()) {
      toast.warning('Escreva a mensagem do disparo.');
      return;
    }

    if (audienceMode === 'csv' && csvValidTargets.length === 0) {
      toast.warning('Cole ou importe um CSV com pelo menos um telefone valido.');
      return;
    }

    setSaving(true);
    try {
      const audienceSource: CommWhatsAppCampaignAudienceSource = audienceMode;
      const audienceConfig = audienceMode === 'crm'
        ? {
            filters: {
              status: leadStatus.trim() || null,
              responsavel: leadOwner.trim() || null,
              only_active: true,
              exclude_opt_out: true,
            },
          }
        : {
            csv: {
              parsed_rows: csvTargets.length,
              valid_rows: csvValidTargets.length,
              create_leads: createLeadsFromCsv,
              exclude_opt_out: true,
            },
          };

      await commWhatsAppCampaignService.createDraft({
        name,
        objective,
        audienceSource,
        audienceConfig,
        messageText,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        pacingPerMinute,
        stopOnReply: true,
        createLeadsFromCsv,
        csvTargets: audienceMode === 'csv' ? csvValidTargets : [],
      });

      toast.success('Disparo salvo como rascunho.');
      setName('');
      setObjective('');
      setMessageText('');
      setCsvText('');
      setScheduledAt('');
      await loadCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o disparo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos WhatsApp"
        description="Crie campanhas conversacionais para leads do CRM ou contatos importados por CSV, com base preparada para opt-out sinalizado por IA."
        actions={(
          <Button variant="secondary" onClick={() => void loadCampaigns()} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Send} label="Campanhas" value={stats.total} />
        <MetricCard icon={PauseCircle} label="Rascunhos" value={stats.drafts} />
        <MetricCard icon={CalendarClock} label="Agendadas" value={stats.scheduled} />
        <MetricCard icon={PlayCircle} label="Ativas" value={stats.active} />
        <MetricCard icon={Bot} label="Sugestoes IA" value={stats.aiSuggestionsPending} />
      </div>

      <Alert tone="accent" title="MVP com seguranca operacional">
        Esta tela cria a campanha, registra publico CSV quando houver e guarda a configuracao para o worker de envio. A IA entra como sinalizador de possivel opt-out para revisao humana antes de bloquear disparos futuros.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Novo disparo</h2>
            <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">Configure a primeira versao como rascunho. O envio em fila entra na proxima etapa.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <LabelledField label="Nome da campanha">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Reativacao PME maio" />
            </LabelledField>
            <LabelledField label="Objetivo">
              <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Ex: retomar cotacoes paradas" />
            </LabelledField>
          </div>

          <div className="flex flex-wrap gap-2">
            <AudienceButton active={audienceMode === 'crm'} icon={Users} label="Leads do CRM" onClick={() => setAudienceMode('crm')} />
            <AudienceButton active={audienceMode === 'csv'} icon={FileSpreadsheet} label="Importar CSV" onClick={() => setAudienceMode('csv')} />
          </div>

          {audienceMode === 'crm' ? (
            <div className="grid gap-4 rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4 md:grid-cols-2">
              <LabelledField label="Status do lead">
                <Input value={leadStatus} onChange={(event) => setLeadStatus(event.target.value)} placeholder="Opcional" />
              </LabelledField>
              <LabelledField label="Responsavel">
                <Input value={leadOwner} onChange={(event) => setLeadOwner(event.target.value)} placeholder="Opcional" />
              </LabelledField>
              <p className="md:col-span-2 text-xs text-[color:var(--panel-text-muted)]">O worker vai materializar os alvos no momento de ativar a campanha, removendo arquivados, duplicados, numeros invalidos e opt-outs.</p>
            </div>
          ) : (
            <div className="space-y-4 rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface-soft)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text)]">CSV com nome e telefone</p>
                  <p className="text-xs text-[color:var(--panel-text-muted)]">Aceita cabecalhos como nome, telefone, phone, celular ou whatsapp.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--kds-radius-md)] border border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] px-3 py-2 text-sm font-medium text-[color:var(--panel-text)] transition hover:border-[color:var(--panel-accent)]">
                  <FileSpreadsheet className="h-4 w-4" />
                  Escolher arquivo
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleCsvFile(event)} />
                </label>
              </div>
              <Textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder={'nome;telefone\nMaria Silva;(11) 99999-9999'} />
              <label className="flex items-start gap-3 text-sm text-[color:var(--panel-text-soft)]">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600" checked={createLeadsFromCsv} onChange={(event) => setCreateLeadsFromCsv(event.target.checked)} />
                Criar ou atualizar leads no CRM quando o CSV nao encontrar um lead existente.
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{csvTargets.length} linha(s)</Badge>
                <Badge tone={csvValidTargets.length > 0 ? 'success' : 'warning'}>{csvValidTargets.length} telefone(s) validos</Badge>
              </div>
            </div>
          )}

          <LabelledField label="Mensagem">
            <Textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Oi {{nome}}, tudo bem? Vi que sua cotacao ficou pendente e posso te ajudar a comparar as opcoes." />
          </LabelledField>

          <div className="grid gap-4 md:grid-cols-2">
            <LabelledField label="Agendar para">
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </LabelledField>
            <LabelledField label="Ritmo por minuto">
              <Input type="number" min={1} max={120} value={pacingPerMinute} onChange={(event) => setPacingPerMinute(Number(event.target.value) || 1)} />
            </LabelledField>
          </div>

          <div className="flex flex-col gap-3 border-t border-[color:var(--panel-border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[color:var(--panel-text-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--panel-accent)]" />
              Respostas inbound param novos envios para aquele contato; opt-outs bloqueados serao excluidos da fila.
            </div>
            <Button onClick={() => void handleCreateDraft()} loading={saving}>
              <Send className="h-4 w-4" />
              Salvar rascunho
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--panel-text)]">Campanhas recentes</h2>
              <p className="text-sm text-[color:var(--panel-text-soft)]">Base criada para ativacao por worker.</p>
            </div>
            <MessageCircle className="h-5 w-5 text-[color:var(--panel-accent)]" />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-surface-soft)]" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-[var(--kds-radius-xl)] border border-dashed border-[color:var(--panel-border)] p-6 text-center">
              <p className="text-sm font-medium text-[color:var(--panel-text)]">Nenhum disparo criado ainda.</p>
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted)]">Crie o primeiro rascunho para validar publico e mensagem.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-[var(--kds-radius-xl)] border border-[color:var(--panel-border-subtle)] bg-[color:var(--panel-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--panel-text)]">{campaign.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[color:var(--panel-text-soft)]">{campaign.message_text || 'Sem mensagem definida.'}</p>
                    </div>
                    <Badge tone={statusTones[campaign.status]} size="sm">{statusLabels[campaign.status]}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniStat label="Alvos" value={campaign.total_targets} />
                    <MiniStat label="Enviados" value={campaign.sent_targets} />
                    <MiniStat label="Resp." value={campaign.responded_targets} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--kds-radius-lg)] bg-[color:var(--panel-accent-soft)] text-[color:var(--panel-accent-strong)]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-lg font-semibold text-[color:var(--panel-text)]">{value}</span>
        <span className="block text-xs text-[color:var(--panel-text-muted)]">{label}</span>
      </span>
    </Card>
  );
}

function LabelledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--panel-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function AudienceButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded-[var(--kds-radius-md)] border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-[color:var(--panel-accent)] bg-[color:var(--panel-accent-soft)] text-[color:var(--panel-accent-ink)]'
          : 'border-[color:var(--panel-border)] bg-[color:var(--panel-surface)] text-[color:var(--panel-text-soft)] hover:border-[color:var(--panel-accent)]',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-[var(--kds-radius-md)] bg-[color:var(--panel-surface-soft)] px-2 py-2">
      <span className="block font-semibold text-[color:var(--panel-text)]">{value}</span>
      <span className="block text-[color:var(--panel-text-muted)]">{label}</span>
    </span>
  );
}
