import { useState } from 'react';
import { Alert, Button, Card, Field, Select, Input, SectionHeader } from '../../../../design-system';
import { isMetaQualified, metaConnectionLabel, type MetaAttribution, type MetaReviewInput } from '../domain/metaAds';
import { useMetaAds } from '../hooks/useMetaAds';

const date = (value: string | null) => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Ainda não registrado';
const outcome: Record<string, string> = {
  started: 'Processamento iniciado', success: 'Concluído', retry: 'Nova tentativa agendada',
  dead: 'Precisa de correção', requeued: 'Recolocado na fila',
};
const failure: Record<string, string> = {
  GRAPH_AUTH: 'Acesso à Meta recusado. Peça ao administrador para verificar a credencial.',
  MISSING_CONTACT_FIELDS: 'O formulário não trouxe nome e telefone válidos.',
  ORIGIN_MISMATCH: 'A origem recebida não corresponde à página e ao formulário configurados.',
  AMBIGUOUS_CONTACT: 'Há mais de um contato com o mesmo telefone. Confira os cadastros antes de tentar novamente.',
  LEAD_DEFAULTS_MISSING: 'Configure origem, responsável e status inicial para receber leads.',
  GRAPH_REJECTED: 'A Meta recusou a consulta. Confira as permissões do aplicativo e do formulário.',
  EVENT_TIME_INVALID: 'O sinal ficou fora do prazo de envio. A data original deve ser preservada.',
  QUALIFICATION_REVOKED: 'Uma nova avaliação retirou a qualificação deste lead.',
  COMMERCIAL_SIGNAL_REVOKED: 'O vínculo ou a avaliação comercial mudou. Confira o registro antes de continuar.',
};

function CommercialReview({ attribution, saving, save }: {
  attribution: MetaAttribution; saving: boolean; save: (input: MetaReviewInput) => Promise<void>;
}) {
  const previous = attribution.latest_review;
  const [eligible, setEligible] = useState(previous?.eligible_business ?? false);
  const [lives, setLives] = useState(previous ? String(previous.lives) : '');
  const [region, setRegion] = useState(previous?.region_served ?? false);
  const [interest, setInterest] = useState(previous?.interest_confirmed ?? false);
  const [opportunity, setOpportunity] = useState(previous?.opportunity_id ?? '');
  const [contract, setContract] = useState(previous?.contract_id ?? '');
  const [completed, setCompleted] = useState(false);
  const input: MetaReviewInput = {
    attributionId: attribution.id, eligibleBusiness: eligible, lives: Number(lives), regionServed: region,
    interestConfirmed: interest, opportunityId: opportunity || null, contractId: contract || null, contractCompleted: completed,
  };
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(input); }}>
    <h3 className="font-[var(--font-display)] text-lg">Avaliação comercial</h3>
    <p className="text-sm text-[var(--text-muted)]">Confirme cada critério com o cliente. Atendimento e proposta enviada não comprovam qualificação. Esta avaliação registra o administrador, a data e os critérios utilizados.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eligible} onChange={(e) => setEligible(e.target.checked)} />Empresário ou MEI com elegibilidade confirmada</label>
    <Field label="Quantidade de vidas confirmada"><Input type="number" min={1} max={100000} step={1} required value={lives} onChange={(e) => setLives(e.target.value)} /></Field>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={region} onChange={(e) => setRegion(e.target.checked)} />Região atendida confirmada</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={interest} onChange={(e) => setInterest(e.target.checked)} />Interesse em contratar confirmado com o cliente</label>
    <p className="text-sm font-medium">{isMetaQualified(input) ? 'Critérios de qualificação atendidos' : 'Qualificação ainda não confirmada'}</p>
    <Field label="Oportunidade ou proposta vinculada"><Select value={opportunity} onChange={(e) => setOpportunity(e.target.value)}>
      <option value="">Sem vínculo selecionado</option>
      {attribution.opportunities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </Select></Field>
    <Field label="Contrato do cliente"><Select value={contract} onChange={(e) => { setContract(e.target.value); setCompleted(false); }}>
      <option value="">Sem contrato selecionado</option>
      {attribution.contracts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
    </Select></Field>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={!contract} checked={completed} onChange={(e) => setCompleted(e.target.checked)} />Conferi o contrato selecionado e confirmo que a contratação foi efetivamente concluída.</label>
    <p className="text-sm text-[var(--text-muted)]">Selecione somente o contrato relacionado a esta entrada da Meta. O cadastro do contrato ou a mudança de status do lead, isoladamente, não confirma uma venda.</p>
    {previous && <p className="text-sm">Última avaliação: {date(previous.reviewed_at)} · {previous.qualified ? 'Qualificado' : 'Não qualificado'}{previous.contract_completed ? ' · Contratação confirmada' : ''}</p>}
    <Button type="submit" loading={saving} disabled={!Number.isInteger(Number(lives)) || Number(lives) < 1}>Registrar avaliação</Button>
  </form>;
}

export default function MetaAdsPanel() {
  const state = useMetaAds();
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const snapshot = state.snapshot;
  const attribution = snapshot?.attributions.find((item) => item.id === selected);
  return <section className="space-y-4">
    <SectionHeader title="Meta Ads" description="Acompanhe os formulários, a origem das oportunidades e as avaliações comerciais." />
    <Button variant="secondary" onClick={() => void state.refresh()} loading={state.loading}>Atualizar recebimentos</Button>
    {state.error && <Alert tone="danger">{state.error}</Alert>}
    {state.message && <Alert>{state.message}</Alert>}
    {snapshot && <>
      <Card>
        <h3 className="font-[var(--font-display)] text-lg">{metaConnectionLabel(snapshot)}</h3>
        <p className="mt-2 text-sm">Formulário configurado: {snapshot.settings.formId || 'Pendente'}</p>
        <p className="text-sm text-[var(--text-muted)]">A configuração do formulário não comprova a assinatura da página. O primeiro recebimento confirma o caminho até o CRM.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <p>Recebimentos: <strong>{snapshot.received}</strong></p>
          <p>Importados: <strong>{snapshot.imported}</strong></p>
          <p>Aguardando processamento: <strong>{snapshot.pending}</strong></p>
          <p>Falhas de recebimento: <strong>{snapshot.failed}</strong></p>
          <p>Sinais aguardando liberação: <strong>{snapshot.eventsHeld}</strong></p>
          <p>Sinais na fila de envio: <strong>{snapshot.eventsPending}</strong></p>
          <p>Falhas nos sinais: <strong>{snapshot.eventsFailed}</strong></p>
        </div>
        <p className="mt-4 text-sm">Último recebimento: {date(snapshot.lastReceivedAt)}</p>
        <p className="text-sm">Última importação concluída: {date(snapshot.lastImportedAt)}</p>
      </Card>
      <Alert tone="warning" title={snapshot.capiEnabled ? 'Envio comercial liberado no servidor' : 'Envio à Meta desabilitado'}>
        {snapshot.capiEnabled ? 'Somente sinais liberados individualmente podem ser enviados.' : 'As avaliações ficam registradas no CRM. O envio exige revisão das restrições de dados de saúde, aprovação da configuração e autorização explícita.'}
      </Alert>
      <Card>
        <h3 className="font-[var(--font-display)] text-lg">Origem e progresso comercial</h3>
        <form className="my-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); state.search(search); setSelected(''); }}>
          <Field label="Buscar lead por nome ou identificação da Meta"><Input value={search} maxLength={100} onChange={(e) => setSearch(e.target.value)} /></Field>
          <Button variant="secondary" type="submit" disabled={state.loading}>Buscar</Button>
        </form>
        {snapshot.attributions.length === 0 ? <p className="mt-2 text-sm">{snapshot.imported===0 ? 'Nenhum lead da Meta foi importado. Após configurar e ativar o recebimento, acompanhe o primeiro formulário enviado.' : 'Nenhum lead encontrado nesta busca. Confira o nome ou a identificação informada.'}</p> : <>
          <Field label="Lead recebido pela Meta"><Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Selecione um lead para conferir</option>
            {snapshot.attributions.map((item) => <option key={item.id} value={item.id}>{item.lead_name} · {date(item.received_at)}</option>)}
          </Select></Field>
          {attribution && <div className="mt-4 space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt>Campanha</dt><dd>{attribution.campaign_name || attribution.campaign_id || 'Não informada pela Meta'}</dd></div>
              <div><dt>Conjunto</dt><dd>{attribution.adset_name || attribution.adset_id || 'Não informado pela Meta'}</dd></div>
              <div><dt>Anúncio</dt><dd>{attribution.ad_name || attribution.ad_id || 'Não informado pela Meta'}</dd></div>
              <div><dt>Preenchimento na Meta</dt><dd>{date(attribution.meta_created_at)}</dd></div>
              <div><dt>Resposta comercial do formulário</dt><dd>{attribution.commercial_answer || 'Não recebida ou campo ainda não mapeado'}</dd></div>
              <div><dt>Cadastro no CRM</dt><dd>{attribution.matched_existing ? 'Contato existente preservado' : 'Novo contato'}</dd></div>
              <div><dt>Origem do formulário</dt><dd>{attribution.traffic_type === 'paid' ? 'Anúncio identificado' : attribution.traffic_type === 'organic' ? 'Preenchimento orgânico · sem sinal publicitário' : 'Origem ainda não confirmada · sem sinal publicitário'}</dd></div>
            </dl>
            <CommercialReview key={`${attribution.id}:${attribution.latest_review?.reviewed_at ?? ''}`} attribution={attribution} saving={state.saving} save={state.review} />
          </div>}
        </>}
        <p className="mt-3 text-xs text-[var(--text-muted)]">Exibindo até 50 entradas recentes. O histórico completo permanece armazenado.</p>
      </Card>
      {snapshot.failed > 0 && <Card>
        <h3 className="font-[var(--font-display)] text-lg">Recebimentos que precisam de correção</h3>
        {snapshot.receipts.filter((receipt) => receipt.status === 'dead').map((receipt) => <div key={receipt.leadgen_id} className="mt-3 space-y-2">
          <p className="text-sm">{date(receipt.received_at)} · {failure[receipt.last_error_code ?? ''] || 'Confira a configuração e as permissões antes de tentar novamente.'}</p>
          <Button variant="secondary" loading={state.saving} onClick={() => void state.requeue(receipt.leadgen_id)}>Tentar receber novamente</Button>
        </div>)}
      </Card>}
      {snapshot.eventsFailed > 0 && <Card>
        <h3 className="font-[var(--font-display)] text-lg">Sinais comerciais com falha</h3>
        {snapshot.events.filter((event) => event.status === 'dead').map((event) => <div key={event.event_id} className="mt-3 space-y-2">
          <p className="text-sm">{date(event.occurred_at)} · {event.kind === 'qualified_lead' ? 'Qualificação' : 'Contratação'} · {failure[event.last_error_code ?? ''] || 'Confira as permissões e a configuração antes de liberar este sinal.'}</p>
          <Button variant="secondary" loading={state.saving} onClick={() => void state.requeueEvent(event.event_id)}>Reter para revisão do envio</Button>
        </div>)}
        <p className="mt-3 text-sm text-[var(--text-muted)]">A revisão mantém a data original e não envia o sinal. Sinais expirados ou invalidados pela avaliação comercial não podem ser reenviados.</p>
      </Card>}
      <Card>
        <h3 className="font-[var(--font-display)] text-lg">Histórico da integração</h3>
        {snapshot.history.length === 0 ? <p className="text-sm">Nenhuma tentativa registrada.</p> : <ul className="mt-3 space-y-2 text-sm">
          {snapshot.history.map((item, index) => <li key={`${item.created_at}:${index}`}>
            {date(item.created_at)} · {item.direction === 'inbound' ? 'Recebimento' : 'Sinal comercial'} · {outcome[item.outcome] || 'Aguardando verificação'}
            {item.error_code && <p className="text-[var(--text-muted)]">{failure[item.error_code] || 'Falha de processamento. Verifique a configuração ou aguarde a próxima tentativa.'}</p>}
          </li>)}
        </ul>}
        {snapshot.history.length>=50 && !state.historyEnd && <Button className="mt-3" variant="secondary" loading={state.historyLoading} onClick={() => void state.loadHistory()}>Carregar histórico anterior</Button>}
        <details className="mt-4 text-xs text-[var(--text-muted)]">
          <summary>Informações para suporte</summary>
          <p className="mt-2 break-all">Recebimento: {snapshot.webhookUrl}</p>
          <p>Página: {snapshot.settings.pageId} · Formulário: {snapshot.settings.formId}</p>
          {attribution && <p>Lead Meta: {attribution.leadgen_id} · CRM: {attribution.lead_id} · Anúncio: {attribution.ad_id || 'Ausente'}</p>}
          {snapshot.history.filter((item) => item.error_code).slice(0,20).map((item) => <p key={item.id}>{item.entity_id} · tentativa {item.attempt} · {item.error_code}</p>)}
          <p>As credenciais são configuradas exclusivamente no servidor.</p>
        </details>
      </Card>
    </>}
  </section>;
}
