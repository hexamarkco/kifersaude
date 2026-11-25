import { useState } from 'react';
import {
  CrmCard, DateTimePicker, Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DisclosureTrigger, IconButton, KpiCard, LoadingState, RecordListSkeleton, MonthlyTrendChart, Progress, Surface, Text,
} from '../../../design-system';
import { Alert, Button, Field, Input, Select, Table, TableHeader, TableHead, SortableTableHead, TableBody, TableRow, TableCell, useTableSorting, useSortedTableRows } from '../../../design-system';
import { CalendarCheck, CalendarDays, FileCheck, RefreshCw, Users, UserRoundCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useProduction } from '../hooks/useProduction';
import { productionActionLabels, productionDay, productionRange, productionSalesTrend, type ProductionSummary } from '../domain/types';

const metrics: Array<[Exclude<keyof ProductionSummary, 'user_id' | 'display_name'>, string]> = [
  ['clients','Clientes'],['messages','Envios imediatos'],['scheduled_messages','Envios agendados'],['schedules','Agendamentos criados'],
  ['reminders','Retornos concluídos'],['advances','Avanços'],['regressions','Regressões'],['losses','Perdas'],['sales','Vendas'],['cancellations','Cancelamentos'],
];
const origins: Record<string, string> = { crm:'CRM',mcp:'Assistente conectado',automation:'Automação',external:'WhatsApp externo',unknown:'Sem identificação' };
const states: Record<string, string> = { scheduled:'Agendado',sending:'Enviando',sent:'Enviado',delivered:'Entregue',read:'Lido',played:'Reproduzido',failed:'Falhou',cancelled:'Cancelado',expired:'Expirado',running:'Em andamento',paused:'Pausado',completed:'Concluído' };
const entities: Record<string, string> = { comm_whatsapp_messages:'Mensagem',comm_whatsapp_scheduled_messages:'Agendamento',comm_whatsapp_scheduled_sequences:'Sequência',contracts:'Contrato',reminders:'Lembrete',interactions:'Interação',leads:'Cliente' };

export function TeamProduction({ onNavigateToLead, appearance = 'dashboard' }: {
  onNavigateToLead: (id: string) => void;
  appearance?: 'dashboard' | 'finance';
}) {
  const finance = appearance === 'finance';
  const { isAdmin } = useAuth();
  const model = useProduction(finance ? 'month' : 'day');
  const [filterDraft, setFilterDraft] = useState<{ start: string; end: string; operator: string } | null>(null);
  const { report } = model;
  const names = new Map(report?.operators.map((operator) => [operator.user_id, operator.display_name]));
  const { sorting: summarySorting, sortBy: sortSummaryBy } = useTableSorting<keyof ProductionSummary | 'display_name'>();
  const { sorting: eventSorting, sortBy: sortEventsBy } = useTableSorting<'occurred_at' | 'executor' | 'action' | 'origin' | 'state' | 'record'>();
  const sortedSummary = useSortedTableRows(report?.summary ?? [], summarySorting, (row, key) => key === 'display_name' ? row.display_name : row[key]);
  const sortedEvents = useSortedTableRows(report?.events ?? [], eventSorting, (event, key) => {
    switch (key) {
      case 'occurred_at': return event.occurred_at;
      case 'executor': return names.get(event.operator_user_id ?? '') ?? 'Sem identificação';
      case 'action': return productionActionLabels[event.action] ?? event.action;
      case 'origin': return origins[event.origin] ?? 'Sem identificação';
      case 'state': return event.active ? states[event.state ?? ''] ?? event.state ?? 'Registrado' : 'Desfeito';
      case 'record': return entities[event.entity_table] ?? 'Registro';
    }
  });
  const participants = sortedSummary.filter((row) => row.user_id !== null);
  const team = sortedSummary.find((row) => row.user_id === null);
  const activeParticipants = participants.filter((row) => metrics.some(([metric]) => row[metric] > 0));
  const maxActivity = Math.max(1, ...participants.flatMap((row) => [row.sales, row.reminders]));
  const salesTrend = finance && report && model.offset === 0 ? productionSalesTrend(report, model.range) : [];
  const validDraft = Boolean(filterDraft?.start && filterDraft.end && filterDraft.start <= filterDraft.end);
  const formatDate = (date: string) => date.split('-').reverse().join('/');
  const periodLabel = model.range.start === model.range.end
    ? formatDate(model.range.start)
    : `${formatDate(model.range.start)} a ${formatDate(model.range.end)}`;
  const indicators = [
    { title: 'Vendas no período', value: team?.sales, icon: FileCheck, description: 'Vendas atribuídas', tone: 'brand' },
    { title: 'Clientes atendidos', value: team?.clients, icon: UserRoundCheck, description: 'Clientes únicos da equipe', tone: 'cyan' },
    { title: 'Retornos concluídos', value: team?.reminders, icon: CalendarCheck, description: 'Acompanhamentos realizados', tone: 'info' },
    { title: 'Pessoas na equipe', value: activeParticipants.length, icon: Users, description: 'Com atividade no período', tone: 'purple' },
  ];

  return <section aria-label="Relatório de produção da equipe" className={finance ? 'kds-finance-production' : 'kds-dashboard-overview'}>
    {report?.started_at && <section className={finance ? 'kds-workspace-record-metrics' : 'kds-dashboard-metric-grid kds-dashboard-metric-grid-compact'} aria-label="Indicadores de produção">
      {indicators.map(({ title, value, icon: Icon, description, tone }) => (
        <KpiCard key={title} title={title} value={<span>{value ?? '—'}</span>} trend={description} data-tone={tone} icon={<Icon aria-hidden="true" />} />
      ))}
    </section>}
    {finance ? (
      <div className="kds-finance-production-controls" role="group" aria-label="Filtros da produção">
        <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => setFilterDraft({ ...model.range, operator: model.operator })}>
          <CalendarDays className="kds-control-icon" aria-hidden="true" />
          {periodLabel}
        </Button>
        <IconButton variant="secondary" size="sm" aria-label="Atualizar produção" title="Atualizar produção" onClick={() => void model.reload()} disabled={model.loading}>
          <RefreshCw aria-hidden="true" />
        </IconButton>
      </div>
    ) : <Surface padding="sm" className="kds-production-filters" aria-label="Filtros da produção">
      <div className="kds-production-shortcuts" role="group" aria-label="Períodos rápidos">
        {[1, 7, 30].map((days) => {
          const range = productionRange(days);
          const active = model.range.start === range.start && model.range.end === range.end;
          return <Button size="sm" key={days} variant={active ? 'soft' : 'secondary'} aria-pressed={active} onClick={() => model.setRange(range)}>{days === 1 ? 'Hoje' : `${days} dias`}</Button>;
        })}
      </div>
      <Field label="De"><Input type="date" value={model.range.start} onChange={(event) => model.setRange({ ...model.range, start: event.target.value })} /></Field>
      <Field label="Até"><Input type="date" value={model.range.end} onChange={(event) => model.setRange({ ...model.range, end: event.target.value })} /></Field>
      <Field label="Executor"><Select value={model.operator} onChange={(event) => model.setOperator(event.target.value)}>
        <option value="">Toda a equipe</option>{report?.operators.map((operator) => <option key={operator.user_id} value={operator.user_id}>{operator.display_name}</option>)}
      </Select></Field>
      <Button variant="secondary" disabled={model.loading} onClick={() => void model.reload()}>Atualizar produção</Button>
    </Surface>}
    {model.loading && !report && <LoadingState placeholder={<RecordListSkeleton />} label="Carregando produção…" />}
    {model.error && <Alert tone="warning">{model.error}</Alert>}
    {report && !report.started_at && <Alert
      tone="info"
      action={isAdmin ? <Button size="sm" className="w-full whitespace-normal sm:w-auto" onClick={() => void model.activate()}>Iniciar medição a partir de agora</Button> : undefined}
    >A medição individual ainda não foi ativada. O histórico do login compartilhado não será atribuído a uma pessoa.</Alert>}
    {report?.started_at && <>
      <div className={finance ? 'kds-finance-production-charts' : 'kds-dashboard-columns'}>
        <CrmCard
          title={salesTrend.length > 0 ? 'Produção ao longo do período' : 'Produção no período'}
          subtitle={salesTrend.length > 0 ? 'Vendas fechadas por dia.' : 'Vendas e retornos concluídos por atendente.'}
        >
          {salesTrend.length > 0 ? (
            <MonthlyTrendChart data={salesTrend} height={220} embedded ariaLabel="Vendas fechadas por dia" />
          ) : activeParticipants.length > 0 ? (
            <ul className="kds-dashboard-bar-list">
              {activeParticipants.map((row) => (
                <li key={row.user_id}>
                  <div><strong>{row.display_name}</strong></div>
                  <div><span>Vendas</span><strong>{row.sales}</strong></div>
                  <Progress size="sm" value={row.sales} max={maxActivity} />
                  <div><span>Retornos concluídos</span><strong>{row.reminders}</strong></div>
                  <Progress className="kds-dashboard-progress-secondary" size="sm" value={row.reminders} max={maxActivity} />
                </li>
              ))}
            </ul>
          ) : <Text className="kds-dashboard-overview-empty">Sem atividade individual registrada neste período.</Text>}
        </CrmCard>
        <CrmCard title="Participação da equipe" subtitle="Proporção das vendas atribuídas a cada pessoa.">
          {team && team.sales > 0 && activeParticipants.length > 0 ? (
            <ul className={finance ? 'kds-finance-participation' : 'kds-dashboard-bar-list'}>
              {activeParticipants.map((row) => (
                <li key={row.user_id}>
                  {finance ? <span>{row.display_name}</span> : <div><span>{row.display_name}</span><strong>{row.sales} {row.sales === 1 ? 'venda' : 'vendas'}</strong></div>}
                  <Progress size="sm" value={row.sales} max={team.sales} />
                  {finance && <strong>{row.sales} {row.sales === 1 ? 'venda' : 'vendas'}</strong>}
                </li>
              ))}
            </ul>
          ) : <Text className="kds-dashboard-overview-empty">Sem base para calcular a participação no período.</Text>}
        </CrmCard>
      </div>
      <CrmCard title="Cada pessoa, uma contribuição." subtitle="Vendas, clientes atendidos e retornos no período selecionado." padding="none" className="kds-dashboard-table-card">
        <Table size="sm" aria-label="Resumo da produção por atendente" className="kds-production-summary-table" columnWidths={['30%', '13%', '15%', '17%', '25%']}>
          <TableHeader><TableRow>
            <SortableTableHead label="Atendente" sortDirection={summarySorting.key === 'display_name' ? summarySorting.direction : null} onSort={() => sortSummaryBy('display_name')} />
            {([['sales', 'Vendas'], ['clients', 'Clientes'], ['reminders', 'Retornos']] as const).map(([key, label]) => (
              <SortableTableHead key={key} align="right" label={label} sortDirection={summarySorting.key === key ? summarySorting.direction : null} onSort={() => sortSummaryBy(key)} />
            ))}
            <TableHead>Participação nas vendas</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {participants.length === 0 && <TableRow><TableCell colSpan={5}>Nenhum atendente neste recorte.</TableCell></TableRow>}
            {participants.map((row) => (
            <TableRow key={row.user_id}>
              <TableCell>{row.display_name}</TableCell>
              <TableCell align="right">{row.sales}</TableCell>
              <TableCell align="right">{row.clients}</TableCell>
              <TableCell align="right">{row.reminders}</TableCell>
              <TableCell>{team && team.sales > 0 ? <Progress size="sm" value={Math.round(row.sales / team.sales * 100)} showLabel /> : '—'}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CrmCard>
      <details className="kds-dashboard-details">
        <DisclosureTrigger size="sm">Indicadores detalhados de produção</DisclosureTrigger>
        <Surface className="space-y-3" padding="md">
      <Text className="text-xs text-[var(--text-muted)]">Medição iniciada em {new Date(report.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. No painel, a conta identifica o responsável. No assistente conectado, informe quem está atendendo em cada ação.</Text>
      <div className="overflow-x-auto"><Table size="sm" className="min-w-[100rem]" columnWidths={['16%', ...metrics.map(() => '8.4%')]}><TableHeader><TableRow><SortableTableHead label="Atendente" sortDirection={summarySorting.key === 'display_name' ? summarySorting.direction : null} onSort={() => sortSummaryBy('display_name')} />{metrics.map(([key,label]) => <SortableTableHead key={key} align="right" label={label} sortDirection={summarySorting.key === key ? summarySorting.direction : null} onSort={() => sortSummaryBy(key)} />)}</TableRow></TableHeader>
        <TableBody>{sortedSummary.map((row) => <TableRow key={row.user_id ?? 'team'}><TableCell>{row.display_name}</TableCell>{metrics.map(([key]) => <TableCell key={key} align="right">{row[key]}</TableCell>)}</TableRow>)}</TableBody>
      </Table></div>
      <Text className="text-sm text-[var(--text-muted)]">Fora da comparação individual: automações {report.unattributed.automation} · WhatsApp externo — autoria não identificada {report.unattributed.external} · outros envios sem autoria {report.unattributed.unknown}.</Text>
      <Text className="text-xs text-[var(--text-muted)]">Um cliente pode aparecer para mais de um atendente. O total da equipe elimina duplicidades. Agendamentos criados e envios efetivos são indicadores distintos.</Text>
        </Surface>
      </details>
      <details className="kds-dashboard-details"><DisclosureTrigger size="sm">Registros que compõem os indicadores ({report.total_events})</DisclosureTrigger>
        <div className="mt-3 overflow-x-auto"><Table size="sm" className="min-w-[70rem]" columnWidths={['15%', '14%', '17%', '21%', '13%', '20%']}><TableHeader><TableRow><SortableTableHead label="Quando" sortDirection={eventSorting.key === 'occurred_at' ? eventSorting.direction : null} onSort={() => sortEventsBy('occurred_at')} /><SortableTableHead label="Executor" sortDirection={eventSorting.key === 'executor' ? eventSorting.direction : null} onSort={() => sortEventsBy('executor')} /><SortableTableHead label="Ação" sortDirection={eventSorting.key === 'action' ? eventSorting.direction : null} onSort={() => sortEventsBy('action')} /><SortableTableHead label="Origem / autoria" sortDirection={eventSorting.key === 'origin' ? eventSorting.direction : null} onSort={() => sortEventsBy('origin')} /><SortableTableHead label="Situação" sortDirection={eventSorting.key === 'state' ? eventSorting.direction : null} onSort={() => sortEventsBy('state')} /><SortableTableHead label="Registro" sortDirection={eventSorting.key === 'record' ? eventSorting.direction : null} onSort={() => sortEventsBy('record')} /></TableRow></TableHeader>
          <TableBody>{sortedEvents.map((event) => <TableRow key={event.id}>
            <TableCell>{new Date(event.occurred_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</TableCell>
            <TableCell>{names.get(event.operator_user_id ?? '') ?? 'Sem identificação'}</TableCell>
            <TableCell>{productionActionLabels[event.action] ?? event.action}</TableCell>
            <TableCell>{origins[event.origin] ?? 'Sem identificação'} / {event.identity_kind === 'declared' ? 'declarada' : event.identity_kind === 'authenticated' ? 'autenticada' : 'não identificada'}</TableCell>
            <TableCell>{event.active ? states[event.state ?? ''] ?? event.state ?? 'Registrado' : 'Desfeito'}</TableCell>
            <TableCell>{event.lead_id ? <Button variant="text" size="sm" onClick={() => onNavigateToLead(event.lead_id!)}>Abrir cliente</Button> : <span>{entities[event.entity_table] ?? 'Registro'} · {event.entity_id}</span>}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={model.offset === 0} onClick={() => model.setOffset(Math.max(0,model.offset-50))}>Anteriores</Button><Button variant="secondary" disabled={model.offset+50 >= report.total_events} onClick={() => model.setOffset(model.offset+50)}>Próximos</Button></div>
      </details>
    </>}
    {filterDraft && (
      <Dialog open size="md" className="kds-finance-dialog" onOpenChange={(open) => !open && setFilterDraft(null)}>
        <DialogHeader onClose={() => setFilterDraft(null)}>
          <DialogTitle>Filtrar produção</DialogTitle>
          <DialogDescription placement="visible">Escolha o período e quem aparece no relatório.</DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
          event.preventDefault();
          if (!validDraft) return;
          model.setRange({ start: filterDraft.start, end: filterDraft.end });
          model.setOperator(filterDraft.operator);
          setFilterDraft(null);
        }}>
          <DialogBody className="space-y-4">
            <div className="kds-production-shortcuts" role="group" aria-label="Períodos rápidos">
              {[
                { label: 'Este mês', start: `${productionDay().slice(0, 7)}-01`, end: productionDay() },
                ...[1, 7, 30].map((days) => ({ label: days === 1 ? 'Hoje' : `${days} dias`, ...productionRange(days) })),
              ].map(({ label, start, end }) => (
                <Button key={label} size="sm" variant="secondary" onClick={() => setFilterDraft({ ...filterDraft, start, end })}>{label}</Button>
              ))}
            </div>
            <div className="kds-finance-form-grid">
              <Field label="De" htmlFor="finance-production-from" required>
                <DateTimePicker id="finance-production-from" type="date" value={filterDraft.start} onChange={({ target }) => setFilterDraft({ ...filterDraft, start: target.value })} />
              </Field>
              <Field label="Até" htmlFor="finance-production-to" required error={filterDraft.start && filterDraft.end && !validDraft ? 'Escolha uma data igual ou posterior à inicial.' : undefined}>
                <DateTimePicker id="finance-production-to" type="date" value={filterDraft.end} onChange={({ target }) => setFilterDraft({ ...filterDraft, end: target.value })} />
              </Field>
              <Field label="Responsável" htmlFor="finance-production-owner">
                <Select id="finance-production-owner" value={filterDraft.operator} onChange={({ target }) => setFilterDraft({ ...filterDraft, operator: target.value })}>
                  <option value="">Toda a equipe</option>
                  {report?.operators.map((operator) => <option key={operator.user_id} value={operator.user_id}>{operator.display_name}</option>)}
                </Select>
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFilterDraft(null)}>Cancelar</Button>
            <Button type="submit" disabled={!validDraft}>Aplicar filtros</Button>
          </DialogFooter>
        </form>
      </Dialog>
    )}
  </section>;
}
