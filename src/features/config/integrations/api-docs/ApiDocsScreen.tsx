import { Text, Heading } from '../../../../design-system';
import { useState } from 'react';
import { ArrowLeft, BookOpen, LockKeyhole, Play, RotateCcw, Search, Terminal, Unplug } from 'lucide-react';
import { Alert, Badge, Button, Card, ConfirmDialog, Field, Input, LinkButton, PageContainer, PageHeader, SectionHeader, Select, Textarea } from '../../../../design-system';
import { apiEndpoints, endpointAccessLabels, endpointPath, type ApiParameter } from './domain/catalog';
import { useApiExplorer } from './hooks/useApiExplorer';
import { ApiCodeBlock } from './components/ApiCodeBlock';

function ParameterTable({ fields }: { fields: ApiParameter[] }) {
  return (
    <div className="kds-api-parameters">
      {fields.map((field) => (
        <div key={field.name}>
          <div><code>{field.name}</code>{field.required && <Badge tone="warning" size="sm">Obrigatório</Badge>}</div>
          <Text>{field.description}</Text>
        </div>
      ))}
    </div>
  );
}

export default function ApiDocsScreen() {
  const explorer = useApiExplorer();
  const { endpoint, draft, result, running } = explorer;
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('ALL');
  const [responseTab, setResponseTab] = useState('body');
  const filtered = apiEndpoints.filter((item) => (method === 'ALL' || item.method === method)
    && `${item.title} ${endpointPath(item)} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const groups = [...new Set(apiEndpoints.map((item) => item.group))];
  const query = new URLSearchParams(draft.query);
  const resultTone = result && (!result.ok ? 'danger' : result.applicationIssue ? 'warning' : 'success');

  return (
    <PageContainer size="full" className="kds-api-page">
      <PageHeader eyebrow="Kifer Saúde · Integrações" title="Documentação da API"
        description="Explore as operações, prepare uma chamada e confira a resposta sem sair do painel."
        descriptionPlacement="visible"
        actions={<LinkButton href="/painel/leads" variant="secondary"><ArrowLeft size={16} />Voltar aos leads</LinkButton>}
      />

      <div className="kds-api-overview">
        <Card><BookOpen size={20} /><div><strong>{apiEndpoints.length} operações documentadas</strong><Text>Consultas, cadastros e automações</Text></div></Card>
        <Card><LockKeyhole size={20} /><div><strong>Acesso pela sua sessão</strong><Text>As mesmas permissões do CRM</Text></div></Card>
        <Card><Terminal size={20} /><div><strong>Teste e acompanhe</strong><Text>Resposta, tempo e código HTTP</Text></div></Card>
      </div>

      <div className="kds-api-layout">
        <aside className="kds-api-sidebar" aria-label="Catálogo de operações">
          <Card className="space-y-4">
            <SectionHeader title="Operações" as="h2" description="Escolha o que deseja testar." />
            <Field label="Buscar operação"><Input leftIcon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou caminho" /></Field>
            <Field label="Método"><Select value={method} onChange={(event) => setMethod(event.target.value)} options={[
              { value: 'ALL', label: 'Todos os métodos' }, { value: 'GET', label: 'GET · Consultar' },
              { value: 'POST', label: 'POST · Executar ou criar' }, { value: 'PUT', label: 'PUT · Atualizar' },
            ]} /></Field>
            <Text className="kds-api-muted">{filtered.length} de {apiEndpoints.length} operações</Text>
            <nav aria-label="Endpoints da API" className="space-y-4">
              {groups.map((group) => {
                const items = filtered.filter((item) => item.group === group);
                return items.length > 0 && <div key={group}>
                  <Heading level={3} className="kds-api-nav-heading">{group}</Heading>
                  <div className="space-y-1">{items.map((item) => (
                    <Button variant="ghost" key={item.id} type="button" className={`kds-api-endpoint ${item.id === endpoint.id ? "is-active" : ""}`}
                      aria-current={item.id === endpoint.id ? 'true' : undefined} disabled={running}
                      onClick={() => { explorer.selectEndpoint(item.id); setResponseTab('body'); }}>
                      <span className="kds-api-endpoint-meta"><Badge tone={item.method === 'GET' ? 'info' : item.method === 'PUT' ? 'warning' : 'primary'} size="sm">{item.method}</Badge>
                        {item.access === 'server' && <LockKeyhole size={13} aria-label="Somente servidor" />}</span>
                      <span className="kds-api-endpoint-main"><strong>{item.title}</strong><code>{endpointPath(item)}</code></span>
                    </Button>
                  ))}</div>
                </div>;
              })}
              {filtered.length === 0 && <Text className="kds-api-muted" role="status">Nenhuma operação encontrada. Ajuste a busca ou o método.</Text>}
            </nav>
          </Card>
        </aside>

        <section className="kds-api-workspace" aria-label="Documentação e testes">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={endpoint.method === 'GET' ? 'info' : 'primary'}>{endpoint.method}</Badge>
              <code className="kds-api-path">/leads-api{endpointPath(endpoint)}</code>
              <Badge tone="neutral">{endpointAccessLabels[endpoint.access]}</Badge>
            </div>
            <SectionHeader title={endpoint.title} description={endpoint.description} />
            {endpoint.impact && <Alert tone="warning" title="Antes de executar">{endpoint.impact}</Alert>}
            {endpoint.access === 'server' && <Alert tone="info" title="Execução no servidor">
              Esta rotina usa uma credencial exclusiva do servidor e não pode ser executada pela sessão do CRM.
              Prepare os dados abaixo e copie o cURL para um ambiente de servidor autorizado.
            </Alert>}
            {endpoint.notes && <ul className="kds-api-notes">{endpoint.notes.map((note) => <li key={note}>{note}</li>)}</ul>}
            <details className="kds-api-details">
              <summary>Campos e contrato da operação</summary>
              {endpoint.parameters.length > 0 && <><Heading level={3}>Parâmetros de consulta</Heading><ParameterTable fields={endpoint.parameters} /></>}
              {endpoint.fields.length > 0 && <><Heading level={3}>Campos do corpo JSON</Heading><ParameterTable fields={endpoint.fields} /></>}
              {!endpoint.parameters.length && !endpoint.fields.length && <Text>Esta operação não precisa de campos adicionais.</Text>}
              <ApiCodeBlock title="Exemplo de resposta · dados ilustrativos" value={JSON.stringify(endpoint.response, null, 2)} />
            </details>
          </Card>

          <Card className="space-y-5">
            <SectionHeader eyebrow="Área de testes" title="Prepare sua chamada" description="Confira os dados antes de executar. Nenhuma chamada é enviada automaticamente."
              action={<Button variant="ghost" size="sm" disabled={running} onClick={explorer.reset}><RotateCcw size={14} />Restaurar exemplo</Button>} />
            <form onSubmit={(event) => { event.preventDefault(); explorer.requestExecution(); }} className="space-y-5">
              <fieldset disabled={running} className="space-y-4 min-w-0">
                {endpoint.path.includes('{id}') && <Field label="Identificador do lead" required hint="Copie o UUID do lead que deseja atualizar.">
                  <Input value={draft.leadId} onChange={(event) => explorer.updateDraft({ leadId: event.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </Field>}
                {endpoint.parameters.length > 0 && <div className="kds-api-query-grid">
                  {endpoint.parameters.map((parameter) => <Field key={parameter.name} label={parameter.name} hint={parameter.description}>
                    <Input value={query.get(parameter.name) ?? ''} onChange={(event) => {
                      const next = new URLSearchParams(draft.query);
                      if (event.target.value) next.set(parameter.name, event.target.value); else next.delete(parameter.name);
                      explorer.updateDraft({ query: next.toString() });
                    }} />
                  </Field>)}
                </div>}
                {endpoint.method !== 'GET' && <div className="space-y-2">
                  <Field label="Corpo da chamada (JSON)" hint="Edite o exemplo com os dados do seu ambiente.">
                    <Textarea className="kds-api-json-editor" rows={Math.min(16, Math.max(5, draft.body.split('\n').length))}
                      value={draft.body} onChange={(event) => explorer.updateDraft({ body: event.target.value })} spellCheck={false} />
                  </Field>
                  <Button variant="ghost" size="sm" onClick={explorer.formatBody}>Formatar JSON</Button>
                </div>}
                <details className="kds-api-details">
                  <summary>Endereço, autenticação e código cURL</summary>
                  <Text>Serviço deste ambiente: <code className="kds-api-path">{explorer.baseUrl}</code></Text>
                  <Text>Chamadas no navegador usam a sessão atual e a chave pública do projeto. Nenhuma chave de servidor é necessária ou armazenada aqui.</Text>
                  {endpoint.parameters.length > 0 && <Field label="Parâmetros de consulta completos" hint="Permite usar também os filtros por ID, como origem_id e status_id.">
                    <Input value={draft.query} onChange={(event) => explorer.updateDraft({ query: event.target.value })} />
                  </Field>}
                  <Text>O cURL usa variáveis de ambiente: SUPABASE_ANON_KEY e {endpoint.access === 'server' ? 'SUPABASE_SERVICE_ROLE_KEY (somente no servidor)' : 'ACCESS_TOKEN (token de acesso do usuário, quando exigido)'}.</Text>
                  <ApiCodeBlock title="cURL" value={explorer.curl} />
                </details>
              </fieldset>
              {explorer.error && <Alert tone="danger" title="A chamada não foi concluída">{explorer.error}</Alert>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!explorer.canExecute || running} loading={running}><Play size={16} />{running ? 'Aguardando resposta' : 'Executar chamada'}</Button>
                {running && <Button variant="secondary" onClick={explorer.cancel}><Unplug size={16} />Cancelar espera</Button>}
                {!explorer.canExecute && endpoint.access !== 'server' && <Text className="kds-api-muted">Seu perfil não permite esta operação. Acesso necessário: {endpointAccessLabels[endpoint.access]}.</Text>}
                {endpoint.access === 'server' && <Text className="kds-api-muted">Disponível para execução por cURL no servidor.</Text>}
              </div>
            </form>
          </Card>

          <Card className="space-y-4" aria-busy={running}>
            <SectionHeader title="Resposta da chamada" description="O resultado real da última execução aparece aqui." />
            <div aria-live="polite" role="status">
              {running ? <Text className="kds-api-muted">Aguardando resposta do serviço…</Text>
                : result ? <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={resultTone || 'neutral'}>HTTP {result.status} {result.statusText}</Badge><Badge tone="neutral">{result.durationMs} ms</Badge></div>
                  <Text className="kds-api-muted">{!result.ok ? 'O serviço recusou a chamada. Confira a resposta para corrigir os dados ou o acesso.'
                    : result.applicationIssue ? 'A resposta informa falhas ou uma operação não executada. Confira o corpo antes de continuar.'
                      : 'Resposta recebida. Confira o corpo para verificar os dados e o resultado da operação.'}</Text>
                </div>
                  : <Text className="kds-api-empty"><Terminal size={24} />Nenhuma chamada executada. Escolha uma operação e clique em Executar chamada.</Text>}
            </div>
            {result && <>
              <Text className="kds-api-path">{result.url}</Text>
              <div className="flex gap-2" role="group" aria-label="Visualização da resposta">
                <Button size="sm" variant={responseTab === 'body' ? 'secondary' : 'ghost'} aria-pressed={responseTab === 'body'} onClick={() => setResponseTab('body')}>Corpo</Button>
                <Button size="sm" variant={responseTab === 'headers' ? 'secondary' : 'ghost'} aria-pressed={responseTab === 'headers'} onClick={() => setResponseTab('headers')}>Cabeçalhos</Button>
              </div>
              <ApiCodeBlock key={`${result.endpointId}-${responseTab}-${result.durationMs}`} title={responseTab === 'body' ? 'Corpo da resposta' : 'Cabeçalhos da resposta'} value={responseTab === 'body' ? result.body : result.headers || 'Nenhum cabeçalho disponível para o navegador.'} />
            </>}
          </Card>

          <details className="kds-api-details kds-api-help">
            <summary>Ajuda para interpretar erros HTTP</summary>
            <ParameterTable fields={[
              { name: '400', description: 'Revise os campos, datas, filtros e IDs enviados.' },
              { name: '401', description: 'A sessão ou credencial não foi aceita. Entre novamente no CRM.' },
              { name: '403', description: 'Seu perfil não tem permissão para esta operação.' },
              { name: '404', description: 'Confira o identificador ou o recurso solicitado.' },
              { name: '409', description: 'Há um conflito ou bloqueio de contato. Leia a mensagem retornada.' },
              { name: '500 / 502 / 503', description: 'Falha no serviço ou na integração. Confira se houve alteração ou envio antes de tentar novamente.' },
            ]} />
          </details>
        </section>
      </div>
      <ConfirmDialog open={Boolean(explorer.pending)} onOpenChange={(open) => { if (!open) explorer.setPending(null); }}
        title={`Executar: ${endpoint.title}?`} description={endpoint.impact} confirmLabel="Confirmar e executar" cancelLabel="Revisar dados"
        onConfirm={async () => { if (explorer.pending) await explorer.execute(explorer.pending); }}>
        <Text>A chamada será enviada ao ambiente atual. Confira os dados e o destinatário antes de continuar.</Text>
        {explorer.pending && <ApiCodeBlock title="Chamada a executar" value={`${explorer.pending.method} ${explorer.pending.url}\n${explorer.pending.body ?? ''}`} />}
      </ConfirmDialog>
    </PageContainer>
  );
}
