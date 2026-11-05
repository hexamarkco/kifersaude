import { Alert, Button, Card, Field, Heading, Select, Text, TextLink } from '../../../../design-system';
import { zapiOperations, type ZapiOperation } from '../domain/zapiOperationContract.generated';
import { useProviderOperations } from '../hooks/useProviderOperations';
import { WhatsAppOperationFields } from './WhatsAppOperationFields';
import { providerResultFields } from '../domain/providerOperationPresentation';

const areas = [...new Set(Object.values(zapiOperations).map((definition) => definition.area))];

export default function WhatsAppProviderOperationsPanel({ revision }: { revision: number }) {
  const controller = useProviderOperations(revision);
  const definition = zapiOperations[controller.operation];
  const results = controller.result?.result;
  const noResults = results === null || results === undefined || (typeof results === 'object' && Object.keys(results).length === 0);
  const historyPending = controller.result?.historyPending === true;
  return <Card className="space-y-4">
    <Heading level={3}>Operações do WhatsApp</Heading>
    <Text>Consulte e gerencie mensagens, contatos, grupos, comunidades, canais e listas de transmissão do número conectado.</Text>
    <Text className="text-sm text-[var(--text-secondary)]">As alterações são feitas no WhatsApp. Para localizar o identificador de um grupo, canal ou lista, consulte primeiro a opção de listagem correspondente.</Text>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void controller.execute(); }}>
      <Field label="Área">
        <Select value={definition.area} disabled={controller.pending || controller.uncertain}
          onChange={(event) => {
            const entry = Object.entries(zapiOperations).find(([, item]) => item.area === event.target.value);
            if (entry) controller.selectOperation(entry[0] as ZapiOperation);
          }}>
          {areas.map((area) => <option value={area} key={area}>{area}</option>)}
        </Select>
      </Field>
      <Field label="O que deseja fazer?">
        <Select value={controller.operation} disabled={controller.pending || controller.uncertain}
          onChange={(event) => controller.selectOperation(event.target.value as ZapiOperation)}>
          {Object.entries(zapiOperations).filter(([, item]) => item.area === definition.area)
            .map(([operation, item]) => <option value={operation} key={operation}>{item.label}</option>)}
        </Select>
      </Field>
      <WhatsAppOperationFields key={controller.operation} schema={definition.input} value={controller.input} disabled={controller.pending || controller.uncertain || Boolean(controller.result && definition.mutation)}
        onChange={(value) => controller.changeInput(value && typeof value === 'object' && !Array.isArray(value) ? value : {})} />
      {definition.mutation && <Text className="text-sm text-[var(--text-secondary)]">{definition.sendsMessage ? 'O conteúdo será enviado ao destino informado.' : 'Esta ação pode alterar contatos, participantes ou configurações do WhatsApp. Operações administrativas exigem acesso de administrador.'}</Text>}
      {controller.error && <Alert tone="danger">{controller.error}</Alert>}
      {controller.uncertain && <Alert tone="warning">A confirmação está pendente. Use o botão abaixo para consultar a mesma solicitação sem repetir o envio.</Alert>}
      <Button type="submit" loading={controller.pending} disabled={controller.pending || Boolean(controller.result && definition.mutation && !historyPending)}>
        {controller.uncertain || historyPending ? 'Consultar a mesma solicitação' : definition.mutation ? definition.label : 'Consultar'}
      </Button>
    </form>
    {controller.result && <div className="space-y-3" aria-live="polite">
      <Alert tone={controller.result.historyPending ? 'warning' : 'info'}>
        {controller.result.state === 'queued' ? 'A Z-API aceitou o envio. Entrega e leitura ainda dependem da confirmação do WhatsApp.'
          : controller.result.state === 'queried' ? noResults ? 'A consulta não retornou registros.' : 'A consulta retornou os dados abaixo.'
            : 'A Z-API respondeu à solicitação. Confira o resultado abaixo.'}
        {controller.result.historyPending && ' O registro no CRM ainda precisa ser conciliado; não repita o envio.'}
      </Alert>
      {!noResults && <div className="max-h-96 overflow-auto rounded-lg border border-[var(--border-subtle)] p-3">
        {(Array.isArray(results) ? results : [results]).slice(0, 100).map((item, index) => <div key={index} className="border-b border-[var(--border-subtle)] py-2 text-sm">
          {providerResultFields(item).length ? <dl className="space-y-1">{providerResultFields(item).map((field) => <div key={field.label}>
            <dt className="font-medium">{field.label}</dt><dd className="break-words">{field.value.slice(0, 500)}</dd>
          </div>)}</dl> : <Text>O provedor retornou informações adicionais. Consulte os detalhes para suporte.</Text>}
        </div>)}
      </div>}
      {Array.isArray(results) && results.length > 100 && <Text>Exibindo os primeiros 100 resultados. Consulte outras páginas para continuar.</Text>}
      {definition.mutation && !controller.uncertain && <Button type="button" variant="secondary" onClick={() => controller.changeInput({})}>Iniciar outra operação</Button>}
    </div>}
    <details className="text-sm text-[var(--text-secondary)]">
      <summary>Detalhes para suporte</summary>
      <Text>{definition.method} /{definition.path}</Text>
      <TextLink href={definition.documentation} target="_blank" rel="noreferrer">Referência da Z-API</TextLink>
      {controller.result && <pre className="max-h-72 overflow-auto whitespace-pre-wrap">{JSON.stringify(controller.result, null, 2)}</pre>}
    </details>
  </Card>;
}
