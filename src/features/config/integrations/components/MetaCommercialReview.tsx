import { useId, useState } from 'react';
import { Alert, Button, Checkbox, Field, FieldLabel, Heading, Input, Select, Text } from '../../../../design-system';
import {
  getMetaReviewContracts, getMetaReviewProgress, isMetaContractingModality, isMetaQualified,
  metaContractingModalityLabels, metaEligibilityLabels,
  type MetaAttribution, type MetaContractingModality, type MetaReviewInput,
} from '../domain/metaAds';

export function MetaCommercialReview({ attribution, saving, save }: {
  attribution: MetaAttribution; saving: boolean; save: (input: MetaReviewInput) => Promise<void>;
}) {
  const fieldId = useId();
  const previous = attribution.latest_review;
  const [modality, setModality] = useState<MetaContractingModality | ''>(previous?.contracting_modality ?? '');
  const [eligible, setEligible] = useState(previous?.eligibility_confirmed ?? false);
  const [lives, setLives] = useState(previous ? String(previous.lives) : '');
  const [region, setRegion] = useState(previous?.region_served ?? false);
  const [interest, setInterest] = useState(previous?.interest_confirmed ?? false);
  const [opportunity, setOpportunity] = useState(previous?.opportunity_id ?? '');
  const [contract, setContract] = useState(previous?.contract_id ?? '');
  const [saleClosed, setSaleClosed] = useState(Boolean(previous?.sale_closed || previous?.contract_completed));
  const [completed, setCompleted] = useState(previous?.contract_completed ?? false);
  const input: MetaReviewInput | null = modality ? {
    attributionId: attribution.id, contractingModality: modality, eligibilityConfirmed: eligible,
    lives: Number(lives), regionServed: region, interestConfirmed: interest,
    opportunityId: opportunity || null, contractId: contract || null, saleClosed, contractCompleted: completed,
  } : null;
  const contracts = getMetaReviewContracts(attribution, opportunity);

  return <form className="space-y-4" aria-label="Avaliação comercial" aria-busy={saving} onSubmit={(event) => {
    event.preventDefault();
    if (input && !saving) void save(input);
  }}>
    <Heading level={3} className="font-[var(--font-display)] text-lg">Avaliação comercial</Heading>
    <Text className="text-sm text-[var(--text-muted)]">Registre o perfil confirmado para o plano escolhido e o resultado da negociação. A avaliação anterior fica no histórico.</Text>
    {previous && !previous.contracting_modality ? <Alert tone="warning">A avaliação anterior usou critérios de PME/MEI. Escolha a modalidade e confira a elegibilidade ao atualizar.</Alert> : null}
    <Field label="Modalidade da contratação" htmlFor={`${fieldId}-modality`}>
      <Select id={`${fieldId}-modality`} value={modality} disabled={saving} placeholder="Selecione a modalidade" options={Object.entries(metaContractingModalityLabels).map(([value, label]) => ({ value, label }))} onChange={(event) => {
        const next = event.target.value;
        if (!isMetaContractingModality(next)) return;
        setModality(next); setEligible(false); setRegion(false);
      }} />
    </Field>
    <FieldLabel className="flex items-start gap-2 text-sm"><Checkbox disabled={saving || !modality} checked={eligible} onChange={(event) => setEligible(event.target.checked)} />{modality ? metaEligibilityLabels[modality] : 'Escolha a modalidade para confirmar a elegibilidade'}</FieldLabel>
    <Text className="text-sm text-[var(--text-muted)]">Confira as regras do produto, incluindo o mínimo de pessoas exigido. A pessoa que conversa com você pode estar contratando para outra pessoa.</Text>
    <Field label="Quantidade de pessoas no plano" htmlFor={`${fieldId}-lives`}><Input id={`${fieldId}-lives`} type="number" min={1} max={100000} step={1} required disabled={saving} value={lives} onChange={(event) => setLives(event.target.value)} /></Field>
    <FieldLabel className="flex items-start gap-2 text-sm"><Checkbox disabled={saving} checked={region} onChange={(event) => setRegion(event.target.checked)} />Atendimento na região necessária confirmado para o plano</FieldLabel>
    <FieldLabel className="flex items-start gap-2 text-sm"><Checkbox disabled={saving} checked={interest} onChange={(event) => setInterest(event.target.checked)} />Interesse em contratar confirmado com o cliente</FieldLabel>
    <Text className="text-sm font-medium">{input && isMetaQualified(input) ? 'Critérios de qualificação atendidos' : 'Qualificação ainda não confirmada'}</Text>
    <Field label="Negociação em conjunto ou proposta" htmlFor={`${fieldId}-opportunity`}>
      <Select id={`${fieldId}-opportunity`} value={opportunity} disabled={saving} options={[{ value: '', label: 'Sem negociação selecionada' }, ...attribution.opportunities.map((item) => ({ value: item.id, label: item.label }))]} onChange={(event) => {
        const next = event.target.value;
        setOpportunity(next);
        if (contract && !getMetaReviewContracts(attribution, next).some((item) => item.id === contract)) { setContract(''); setCompleted(false); }
      }} />
    </Field>
    <Heading level={4} className="text-base">Resultado da negociação</Heading>
    <FieldLabel className="flex items-start gap-2 text-sm"><Checkbox disabled={saving} checked={saleClosed} onChange={(event) => { setSaleClosed(event.target.checked); if (!event.target.checked) setCompleted(false); }} />Venda fechada com o cliente</FieldLabel>
    <Text className="text-sm text-[var(--text-muted)]">Você pode salvar o fechamento agora e associar o contrato depois.</Text>
    <Text className="text-sm font-medium" role="status">{getMetaReviewProgress({ sale_closed: saleClosed, contract_completed: completed })}</Text>
    <Field label="Contrato desta negociação" htmlFor={`${fieldId}-contract`}>
      <Select id={`${fieldId}-contract`} value={contract} disabled={saving} options={[{ value: '', label: 'Contrato ainda não selecionado' }, ...contracts.map((item) => ({ value: item.id, label: `${item.label || 'Contrato sem código'}${item.lead_name ? ` — ${item.lead_name}` : ''}` }))]} onChange={(event) => { setContract(event.target.value); setCompleted(false); }} />
    </Field>
    <Text className="text-sm text-[var(--text-muted)]">Para um contrato no cadastro de outra pessoa, selecione a negociação que reúne os contatos. Confira se o contrato corresponde a esta venda.</Text>
    <FieldLabel className="flex items-start gap-2 text-sm"><Checkbox disabled={saving || !saleClosed || !contract} checked={completed} onChange={(event) => setCompleted(event.target.checked)} />Conferi o contrato selecionado e confirmo que a contratação foi efetivamente concluída.</FieldLabel>
    {previous ? <Text className="text-sm">Última avaliação: {new Date(previous.reviewed_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {previous.qualified ? 'Qualificado' : 'Qualificação não confirmada'} · {getMetaReviewProgress(previous)}</Text> : null}
    <Button type="submit" loading={saving} disabled={!input || !Number.isInteger(Number(lives)) || Number(lives) < 1 || Number(lives) > 100000}>Registrar avaliação</Button>
  </form>;
}
