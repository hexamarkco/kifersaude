import { Button, Heading, Surface, Text } from '../../../../design-system';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import { useAttendanceBriefing } from '../hooks/useAttendanceBriefing';

export function WhatsAppAttendanceBriefing({ chatId, leadId, handedOff }: { chatId: string; leadId: string; handedOff: boolean }) {
  const { data, loading, error, refresh } = useAttendanceBriefing(chatId, leadId);
  if (loading) return <Text size="sm" role="status">Carregando resumo do atendimento…</Text>;
  if (error) return <Surface variant="warning" padding="sm"><Text size="sm" role="alert">{error}</Text><Button variant="secondary" size="sm" onClick={refresh}>Tentar novamente</Button></Surface>;
  if (!data) return null;
  return <Surface variant="muted" padding="sm" className="space-y-3" aria-label="Resumo interno do atendimento">
    <Heading level={3} size="sm">Resumo do atendimento</Heading>
    <Text size="xs">Uso interno. Este resumo não é enviado ao cliente.</Text>
    <Text size="sm" weight="semibold">{handedOff ? data.qualificationComplete ? 'Qualificação inicial concluída' : 'Atendimento transferido com pontos a conferir' : 'Qualificação em andamento'}</Text>
    <Text size="sm">{data.reason}</Text>
    {data.facts.map((fact) => <div key={fact.label}><Text size="xs" weight="semibold">{fact.label}</Text><Text size="sm">{fact.value}</Text></div>)}
    {data.pending.length ? <div><Text size="sm" weight="semibold">Ainda falta confirmar</Text>{data.pending.map((item) => <Text size="sm" key={item}>{item}</Text>)}</div> : null}
    {data.review.length ? <div><Text size="sm" weight="semibold">Conferência comercial</Text>{data.review.map((item) => <Text size="sm" key={item}>{item}</Text>)}</div> : null}
    <Text size="xs">Atualizado em {formatDateTimeFullBR(data.updatedAt)}</Text>
    <Button variant="ghost" size="sm" onClick={refresh}>Atualizar resumo</Button>
  </Surface>;
}
