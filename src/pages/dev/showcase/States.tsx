import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  FormActions,
  Input,
  LoadingState,
  SearchInput,
  Select,
  Skeleton,
  Switch,
  useToast,
} from '../../../design-system';
import { ContactForm } from './WorkspacePreview';
import { demoContacts } from './demoData';
import { SectionIntro, Specimen, UsageNote } from './ShowcaseParts';

type DataState = 'ready' | 'loading' | 'empty' | 'error';
export default function States() {
  const [state, setState] = useState<DataState>('ready');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emptySearch, setEmptySearch] = useState('Sem correspondência');
  const matches = demoContacts.filter((contact) =>
    contact.name
      .toLocaleLowerCase('pt-BR')
      .includes(emptySearch.toLocaleLowerCase('pt-BR')),
  );
  const focusRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = window.setTimeout(() => setState('ready'), 1400);
    return () => window.clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => {
      setBusy(false);
      setSaved(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [busy]);
  return (
    <>
      <SectionIntro number="03" title="Cada estado tem uma resposta.">
        O que está acontecendo deve ser visível e compreensível. Teste as
        interações, percorra com Tab e simule a recuperação de uma falha.
      </SectionIntro>
      <UsageNote>
        Hover reforça a possibilidade de interação. Foco identifica a posição do
        teclado. Disabled impede uma ação indisponível. Loading bloqueia
        repetições. Erro orienta a recuperação; sucesso só aparece depois de uma
        ação concluída.
      </UsageNote>
      <div className="ds-grid">
        <Specimen
          title="Interação, foco e indisponibilidade"
          description="Passe o mouse, use Tab ou acione o botão de foco. São os estados reais dos componentes."
          source="Button / Input / Select / Checkbox / Switch · estados nativos"
          wide
        >
          <div className="ds-state-grid">
            <div className="ds-state-cell">
              <span>Disponível · passe o mouse</span>
              <Button
                onClick={() =>
                  toast({
                    variant: 'info',
                    description: 'Botão disponível acionado no exemplo.',
                  })
                }
              >
                <Plus />
                Novo contato
              </Button>
              <Input
                aria-label="Campo disponível"
                placeholder="Passe o mouse ou clique"
              />
              <Select
                aria-label="Seleção disponível"
                options={[
                  { value: 'Amil', label: 'Amil' },
                  { value: 'SulAmérica', label: 'SulAmérica' },
                ]}
              />
            </div>
            <div className="ds-state-cell">
              <span>Foco · use o teclado</span>
              <Button
                variant="secondary"
                onClick={() => focusRef.current?.focus()}
              >
                Testar foco no campo
              </Button>
              <Input
                ref={focusRef}
                aria-label="Campo para testar foco"
                placeholder="O foco virá para cá"
              />
              <p className="ds-caption">
                O contorno acompanha o elemento ativo. Continue com Tab para
                percorrer a interface.
              </p>
            </div>
            <div className="ds-state-cell">
              <span>Indisponível</span>
              <Button disabled>Salvar alterações</Button>
              <Input
                aria-label="Campo indisponível"
                disabled
                placeholder="Edição indisponível"
              />
              <Select
                aria-label="Seleção indisponível"
                disabled
                options={[{ value: 'locked', label: 'Opção indisponível' }]}
              />
              <label className="ds-choice">
                <Checkbox disabled />
                Seleção indisponível
              </label>
              <Switch
                disabled
                label="Preferência indisponível"
                aria-label="Preferência indisponível"
              />
            </div>
          </div>
        </Specimen>
        <Specimen
          title="Validação próxima ao campo"
          description="Rótulo, orientação e mensagem formam uma única unidade acessível."
          source="Field error | success / Input invalid | state"
        >
          <Field
            label="Nome"
            hint="Use o nome pelo qual o contato prefere ser chamado."
          >
            <Input placeholder="Nome do contato" />
          </Field>
          <Field
            label="Telefone"
            error="Informe o DDD e o número para continuar."
          >
            <Input invalid defaultValue="(11)" />
          </Field>
          <Field
            label="E-mail conferido"
            success="Formato do e-mail válido para este exemplo."
          >
            <Input state="success" defaultValue="ana@example.com" />
          </Field>
        </Specimen>
        <Specimen
          title="Salvamento e conclusão"
          description="Aguarde a simulação local. O botão bloqueia repetições e o cancelamento fica indisponível durante o processo."
          source="Button loading / FormActions / Alert / Badge"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);
              setBusy(true);
            }}
          >
            <div className="ds-stack">
              {busy ? (
                <LoadingState
                  compact
                  label="Salvando exemplo"
                  description="Concluindo a operação demonstrativa."
                />
              ) : saved ? (
                <Alert tone="success" title="Exemplo salvo nesta sessão">
                  <div className="ds-row">
                    <CheckCircle2 size={16} />A simulação terminou. Nenhum dado
                    foi enviado ao CRM.
                  </div>
                </Alert>
              ) : (
                <Badge tone="info">Pronto para testar o salvamento</Badge>
              )}
              <FormActions
                loading={busy}
                submitLabel={saved ? 'Salvar novamente' : 'Salvar exemplo'}
                onCancel={() => {
                  setSaved(false);
                  toast({
                    variant: 'info',
                    description: 'Simulação de edição cancelada.',
                  });
                }}
              />
            </div>
          </form>
          <div className="ds-row">
            <Button loading>Salvando</Button>
            <Button variant="secondary" loading>
              Carregando
            </Button>
          </div>
          <p className="ds-caption">
            Os dois botões acima são amostras permanentes do estado de
            carregamento.
          </p>
        </Specimen>
        <Specimen
          title="Dados: carregando, vazio e erro"
          description="Alterne os cenários. A recuperação termina em dados disponíveis, com retorno visível."
          source="LoadingState / Skeleton / EmptyState / Alert / Button"
          wide
        >
          <Field label="Cenário de dados">
            <Select
              value={state}
              onChange={(event) => setState(event.target.value as DataState)}
              options={[
                { value: 'ready', label: 'Dados disponíveis' },
                { value: 'loading', label: 'Carregamento' },
                { value: 'empty', label: 'Lista vazia' },
                { value: 'error', label: 'Falha ao carregar' },
              ]}
            />
          </Field>
          <div className="ds-state-preview" aria-live="polite">
            {state === 'ready' && (
              <div className="ds-stack">
                <div className="ds-between">
                  <strong>Contatos disponíveis</strong>
                  <Badge tone="info">2 exemplos</Badge>
                </div>
                <div className="ds-timeline">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Ana Paula Ribeiro</strong>
                    <p>Em atendimento · Amil</p>
                  </div>
                </div>
                <div className="ds-timeline">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>Bruno Costa</strong>
                    <p>Proposta enviada · Bradesco Saúde</p>
                  </div>
                </div>
              </div>
            )}
            {state === 'loading' && (
              <div className="ds-stack">
                <LoadingState
                  compact
                  label="Carregando contatos"
                  description="Os exemplos aparecerão em instantes."
                />
                <Skeleton variant="table-row" />
                <Skeleton variant="table-row" />
              </div>
            )}
            {state === 'empty' && (
              <EmptyState
                icon={<Inbox />}
                title="Sua lista está pronta para começar"
                description="Adicione um exemplo para visualizar como os contatos aparecem aqui."
                action={
                  <Button onClick={() => setState('ready')}>
                    <Plus />
                    Adicionar exemplos
                  </Button>
                }
              />
            )}
            {state === 'error' && (
              <Alert
                tone="danger"
                title="Não foi possível carregar os contatos"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setState('loading')}
                  >
                    <RefreshCw />
                    Tentar novamente
                  </Button>
                }
              >
                Este é um erro demonstrativo. Tente novamente para recuperar a
                lista de exemplos.
              </Alert>
            )}
          </div>
        </Specimen>
        <Specimen
          title="Nenhum resultado na busca"
          description="Um filtro sem resultados precisa de recuperação, não de confirmação de sucesso."
          source="EmptyState + Button"
        >
          <SearchInput
            aria-label="Buscar no exemplo de lista vazia"
            value={emptySearch}
            onChange={(event) => setEmptySearch(event.target.value)}
            placeholder="Buscar um contato"
          />
          {matches.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="Nenhum contato encontrado"
              description="Revise o nome buscado ou remova os filtros para ampliar a consulta."
              action={
                <Button variant="secondary" onClick={() => setEmptySearch('')}>
                  Limpar filtros do exemplo
                </Button>
              }
            />
          ) : (
            <div className="ds-stack">
              <Badge tone="info">{matches.length} contatos encontrados</Badge>
              {matches.slice(0, 3).map((contact) => (
                <div className="ds-timeline" key={contact.id}>
                  <Users size={18} />
                  <div>
                    <strong>{contact.name}</strong>
                    <p>{contact.operator}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Specimen>
        <Specimen
          title="Envio com campos obrigatórios"
          description="Tente enviar vazio. O primeiro erro recebe o foco e cada campo explica a correção."
          source="ContactForm demonstrativo · Field / Input / FormActions"
          wide
        >
          <ContactForm
            onCancel={() =>
              toast({
                variant: 'info',
                description: 'Exemplo cancelado. Nenhum cadastro foi criado.',
              })
            }
            onSave={() =>
              toast({
                variant: 'success',
                title: 'Validação concluída',
                description:
                  'Os campos obrigatórios estão preenchidos corretamente no exemplo.',
              })
            }
          />
        </Specimen>
      </div>
      <UsageNote title="Acessibilidade como padrão">
        Rótulos associados aos campos, indicação textual de erro, foco visível,
        suporte ao teclado e preferência por movimento reduzido. Em modais, o
        foco fica dentro da tarefa e volta ao acionador ao fechar. Evite
        esconder informação essencial em tooltips.
      </UsageNote>
    </>
  );
}
