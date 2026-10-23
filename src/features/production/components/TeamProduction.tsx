import { Alert, Button, Field, Input, Select, Table, TableHeader, SortableTableHead, TableBody, TableRow, TableCell, useTableSorting, useSortedTableRows } from '../../../design-system';
import { useAuth } from '../../../contexts/AuthContext';
import { useProduction } from '../hooks/useProduction';
import { productionActionLabels, productionRange, type ProductionSummary } from '../domain/types';

const metrics: Array<[keyof ProductionSummary, string]> = [
  ['clients','Clientes'],['messages','Envios imediatos'],['scheduled_messages','Envios agendados'],['schedules','Agendamentos criados'],
  ['reminders','Retornos concluídos'],['advances','Avanços'],['regressions','Regressões'],['losses','Perdas'],['sales','Vendas'],['cancellations','Cancelamentos'],
];
const origins: Record<string, string> = { crm:'CRM',mcp:'Assistente conectado',automation:'Automação',external:'WhatsApp externo',unknown:'Sem identificação' };
const states: Record<string, string> = { scheduled:'Agendado',sending:'Enviando',sent:'Enviado',delivered:'Entregue',read:'Lido',played:'Reproduzido',failed:'Falhou',cancelled:'Cancelado',expired:'Expirado',running:'Em andamento',paused:'Pausado',completed:'Concluído' };
const entities: Record<string, string> = { comm_whatsapp_messages:'Mensagem',comm_whatsapp_scheduled_messages:'Agendamento',comm_whatsapp_scheduled_sequences:'Sequência',contracts:'Contrato',reminders:'Lembrete',interactions:'Interação',leads:'Cliente' };

export function TeamProduction({ onNavigateToLead }: { onNavigateToLead: (id: string) => void }) {
  const { isAdmin } = useAuth();
  const model = useProduction();
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
  return <section aria-labelledby="team-production-title" className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="team-production-title" className="font-[var(--font-display)] text-xl">Produção da equipe</h2>
        <p className="text-sm text-[var(--text-muted)]">Atividade por executor · carteira compartilhada · horário de Brasília</p></div>
      <Button variant="secondary" disabled={model.loading} onClick={() => void model.reload()}>Atualizar produção</Button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      {[1,7,30].map((days) => <Button key={days} variant="secondary" onClick={() => model.setRange(productionRange(days))}>{days === 1 ? 'Hoje' : `${days} dias`}</Button>)}
      <Field label="De"><Input type="date" value={model.range.start} onChange={(event) => model.setRange({ ...model.range, start: event.target.value })} /></Field>
      <Field label="Até"><Input type="date" value={model.range.end} onChange={(event) => model.setRange({ ...model.range, end: event.target.value })} /></Field>
      <Field label="Executor"><Select value={model.operator} onChange={(event) => model.setOperator(event.target.value)}>
        <option value="">Toda a equipe</option>{report?.operators.map((operator) => <option key={operator.user_id} value={operator.user_id}>{operator.display_name}</option>)}
      </Select></Field>
    </div>
    {model.loading && <p role="status">Carregando produção…</p>}
    {model.error && <Alert tone="warning">{model.error}</Alert>}
    {report && !report.started_at && <Alert tone="info">A medição individual ainda não foi ativada. O histórico do login compartilhado não será atribuído a uma pessoa.
      {isAdmin && <Button className="mt-3" onClick={() => void model.activate()}>Iniciar medição a partir de agora</Button>}</Alert>}
    {report?.started_at && <>
      <p className="text-xs text-[var(--text-muted)]">Medição iniciada em {new Date(report.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. No painel, a conta identifica o responsável. No assistente conectado, informe quem está atendendo em cada ação.</p>
      <div className="overflow-x-auto"><Table size="sm" className="min-w-[100rem]" columnWidths={['16%', ...metrics.map(() => '8.4%')]}><TableHeader><TableRow><SortableTableHead label="Atendente" sortDirection={summarySorting.key === 'display_name' ? summarySorting.direction : null} onSort={() => sortSummaryBy('display_name')} />{metrics.map(([key,label]) => <SortableTableHead key={key} align="right" label={label} sortDirection={summarySorting.key === key ? summarySorting.direction : null} onSort={() => sortSummaryBy(key)} />)}</TableRow></TableHeader>
        <TableBody>{sortedSummary.map((row) => <TableRow key={row.user_id ?? 'team'}><TableCell>{row.display_name}</TableCell>{metrics.map(([key]) => <TableCell key={key} align="right">{row[key]}</TableCell>)}</TableRow>)}</TableBody>
      </Table></div>
      <p className="text-sm text-[var(--text-muted)]">Fora da comparação individual: automações {report.unattributed.automation} · WhatsApp externo — autoria não identificada {report.unattributed.external} · outros envios sem autoria {report.unattributed.unknown}.</p>
      <p className="text-xs text-[var(--text-muted)]">Clientes podem aparecer para os dois atendentes; o total da equipe elimina duplicidades. Agendamentos criados e envios efetivos são indicadores distintos.</p>
      <details><summary className="cursor-pointer text-sm font-medium">Registros que compõem os indicadores ({report.total_events})</summary>
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
  </section>;
}
