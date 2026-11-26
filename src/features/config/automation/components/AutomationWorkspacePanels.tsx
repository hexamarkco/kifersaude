import { useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Edit3, Layers3, MessageCircle, Pause, Search, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, CardIcon, DialogDescription, DialogTitle, Drawer, DrawerBody, DrawerFooter, DrawerHeader,
  EmptyState, Heading, IconButton, Input, KpiCard, Pagination, RecordActions, Surface, Table, TableBody,
  TableCell, TableHead, TableHeader, TableRow, Text,
} from '../../../../design-system';
import { getTemplateMessages, type AutoContactFlow, type AutoContactTemplate } from '../../../../lib/autoContactService';
import { automationTriggerLabels } from '../automationPresentation';

type TemplateProps = {
  templates: AutoContactTemplate[];
  busy: boolean;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

export function AutomationTemplates({ templates, busy, onEdit, onRemove }: TemplateProps) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase('pt-BR');
  const visible = templates.filter((template) => !term ||
    [template.name, ...getTemplateMessages(template).flatMap(({ text, caption }) => [text, caption])]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(term)));

  return (
    <section className="kds-automation-journeys" aria-label="Modelos de mensagem">
      <div className="kds-automation-list-toolbar kds-automation-templates-toolbar">
        <Input aria-label="Buscar modelo de mensagem" placeholder="Buscar modelo de mensagem…" type="search" leftIcon={Search} value={query} onChange={(event) => setQuery(event.target.value)} />
        <Text size="sm" tone="muted" role="status">{visible.length} {visible.length === 1 ? 'modelo da equipe' : 'modelos da equipe'}</Text>
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={<MessageCircle />} title={term ? 'Nenhum modelo encontrado' : 'Nenhum modelo cadastrado'} description={term ? 'Tente outro nome ou trecho da mensagem.' : 'Crie um modelo para reutilizar mensagens nos fluxos.'} />
      ) : (
        <ul className="kds-automation-journey-grid">
          {visible.map((template) => {
            const messages = getTemplateMessages(template);
            const name = template.name?.trim() || 'Modelo sem nome';
            const preview = messages[0];
            return (
              <li key={template.id}>
                <Card padding="md" className="kds-automation-journey-card">
                  <div className="kds-automation-card-top">
                    <CardIcon><MessageCircle aria-hidden="true" /></CardIcon>
                    <RecordActions visibleCount={0} label={`Ações do modelo ${name}`} actions={[
                      { label: 'Editar modelo', icon: Edit3, disabled: busy, onClick: () => onEdit(template.id) },
                      { label: 'Remover modelo', icon: Trash2, destructive: true, disabled: busy, onClick: () => onRemove(template.id) },
                    ]} />
                  </div>
                  <Heading level={2} size="sm" className="kds-card-title">{name}</Heading>
                  <Text size="sm" tone="muted" className="kds-automation-template-preview">
                    {preview?.text?.trim() || preview?.caption?.trim() || (preview ? 'Modelo com mídia' : 'Nenhuma mensagem configurada')}
                  </Text>
                  <div className="kds-automation-card-footer">
                    <Text size="sm" tone="muted">WhatsApp · {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}</Text>
                    <Button variant="text" size="sm" disabled={busy} onClick={() => onEdit(template.id)}>
                      Editar modelo <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type OperationProps = {
  flows: AutoContactFlow[];
  enabled: boolean;
  dailyCount: number | null;
  dailyLoading: boolean;
  dailyError: string | null;
  getConditionPreview: (flow: AutoContactFlow) => string;
  getSchedule: (flow: AutoContactFlow) => { startHour: string; endHour: string; timezone: string; dailySendLimit: number | null };
  onOpenFlow: (id: string) => void;
};

export function AutomationOperation({ flows, enabled, dailyCount, dailyLoading, dailyError, getConditionPreview, getSchedule, onOpenFlow }: OperationProps) {
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const paused = flows.filter((flow) => flow.ativo === false).length;
  const detail = flows.find(({ id }) => id === detailId);
  const schedule = detail ? getSchedule(detail) : null;
  const totalPages = Math.max(1, Math.ceil(flows.length / 10));
  const currentPage = Math.min(page, totalPages);
  const rows = flows.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <>
      <section className="kds-workspace-record-metrics" aria-label="Resumo da operação">
        <KpiCard title="Fluxos ativos" value={String(flows.length - paused)} trend="Disponíveis para acompanhar contatos" icon={<Activity />} />
        <KpiCard title="Mensagens hoje" value={dailyLoading ? '…' : dailyError || dailyCount === null ? '—' : String(dailyCount)} trend={dailyError || 'Registros de mensagens automáticas'} icon={<Clock3 />} data-tone="cyan" />
        <KpiCard title="Etapas configuradas" value={String(flows.reduce((count, flow) => count + flow.steps.length, 0))} trend="Nos fluxos cadastrados" icon={<Layers3 />} data-tone="info" />
        <KpiCard title="Fluxos pausados" value={String(paused)} trend={enabled ? 'Envio automático liberado' : 'Envio automático pausado na central'} icon={<Pause />} data-tone="warning" />
      </section>
      <Surface padding="none" className="kds-automation-operation-table">
        {rows.length > 0 ? (
          <>
            <Table size="sm" aria-label="Situação dos fluxos">
              <TableHeader><TableRow><TableHead>Fluxo</TableHead><TableHead>Gatilho</TableHead><TableHead>Situação</TableHead><TableHead>Janela de envio</TableHead><TableHead align="right" aria-label="Ações" /></TableRow></TableHeader>
              <TableBody>
                {rows.map((flow) => {
                  const timing = getSchedule(flow);
                  const name = flow.name || 'Fluxo sem nome';
                  return (
                    <TableRow key={flow.id}>
                      <TableCell>{name}</TableCell>
                      <TableCell>{automationTriggerLabels[flow.triggerType]}</TableCell>
                      <TableCell><Badge size="sm" tone={flow.ativo === false ? 'warning' : enabled ? 'success' : 'neutral'}>{flow.ativo === false ? 'Pausado' : enabled ? 'Ativo' : 'Envio pausado na central'}</Badge></TableCell>
                      <TableCell>{timing.startHour} às {timing.endHour}</TableCell>
                      <TableCell align="right"><IconButton size="sm" aria-label={`Detalhes de ${name}`} onClick={() => setDetailId(flow.id)}><ArrowUpRight /></IconButton></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={flows.length} itemsPerPage={10} onPageChange={setPage} />}
          </>
        ) : <EmptyState icon={<Activity />} title="Nenhum fluxo na operação" description="Cadastre um fluxo na central para acompanhar sua configuração." />}
      </Surface>
      {detail && schedule && (
        <Drawer open side="right" size="lg" className="kds-crm-dialog kds-automation-drawer kds-automation-execution-drawer" onOpenChange={(open) => !open && setDetailId(null)}>
          <DrawerHeader onClose={() => setDetailId(null)}>
            <div className="kds-dialog-eyebrow">Automações</div>
            <DialogTitle>Detalhes do fluxo</DialogTitle>
            <DialogDescription placement="visible">Configuração atual, não um histórico de execução.</DialogDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <Heading level={3} className="kds-record-entity-title">{detail.name || 'Fluxo sem nome'}</Heading>
            <dl className="kds-automation-detail-data">
              <dt>Situação</dt><dd>{detail.ativo === false ? 'Pausado' : enabled ? 'Ativo' : 'Envio pausado na central'}</dd>
              <dt>Gatilho</dt><dd>{automationTriggerLabels[detail.triggerType]}</dd>
              <dt>Condições</dt><dd>{getConditionPreview(detail)}</dd>
              <dt>Etapas</dt><dd>{detail.steps.length}</dd>
              <dt>Janela de envio</dt><dd>{schedule.startHour} às {schedule.endHour}</dd>
              <dt>Fuso horário</dt><dd>{schedule.timezone}</dd>
              <dt>Limite por dia</dt><dd>{schedule.dailySendLimit ?? 'Sem limite próprio'}</dd>
            </dl>
          </DrawerBody>
          <DrawerFooter><Button onClick={() => { setDetailId(null); onOpenFlow(detail.id); }}>Abrir jornada</Button></DrawerFooter>
        </Drawer>
      )}
    </>
  );
}
