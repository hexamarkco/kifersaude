import type { KeyboardEvent, RefObject } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CrmCard,
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerHeader,
  EmptyState,
  FieldLabel,
  IconButton,
  Input,
  LoadingState,
  PageContainer,
  PageHeader,
  Text,
  Textarea,
} from '../../../design-system';
import {
  Clock3,
  Download,
  FlaskConical,
  Lightbulb,
  MessageCirclePlus,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRoundPlus,
} from 'lucide-react';
import type {
  AiSandboxConversation,
  AiSandboxMessage,
  AiSandboxTestRun,
} from '../../../lib/aiSandboxChatService';

export type AiSandboxScenario = {
  key: string;
  label: string;
  p: string;
  lead?: boolean;
};

export type AiSandboxScenarioGroup = {
  cat: string;
  scenarios: AiSandboxScenario[];
};

export type AiSandboxChatPageProps = {
  conversations: AiSandboxConversation[];
  conversationsLoading: boolean;
  activeConversation: AiSandboxConversation | null;
  activeConversationId: string | null;
  messages: AiSandboxMessage[];
  messagesLoading: boolean;
  activeTestRun: AiSandboxTestRun | null;
  verdict: { violations: string[]; notes: string; playbookImprovements: string[] };
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  threadRef: RefObject<HTMLDivElement>;
  sendingDraft: boolean;
  secondsUntilReply: number | null;
  onReplyNow: () => void;
  generatingReply: boolean;
  runningScenario: boolean;
  startingApproach: boolean;
  leadNameForApproach: string;
  onLeadNameChange: (value: string) => void;
  onStartWithApproach: () => void | Promise<void>;
  isHandedOff: boolean;
  error: string | null;
  onNewConversation: () => void;
  onExportChat: () => void;
  onSelectConversation: (id: string) => void;
  onRequestDelete: (conversation: AiSandboxConversation) => void;
  historyOpen: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  showScenarioPicker: boolean;
  onScenarioPickerOpenChange: (open: boolean) => void;
  scenarioSearch: string;
  onScenarioSearchChange: (value: string) => void;
  scenarioGroups: AiSandboxScenarioGroup[];
  onChooseScenario: (scenario: AiSandboxScenario) => void;
  conversationToDelete: AiSandboxConversation | null;
  onDeleteOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void | Promise<void>;
};

export function AiSandboxChatPage({
  conversations,
  conversationsLoading,
  activeConversation,
  activeConversationId,
  messages,
  messagesLoading,
  activeTestRun,
  verdict,
  draft,
  onDraftChange,
  onSend,
  onKeyDown,
  threadRef,
  sendingDraft,
  secondsUntilReply,
  onReplyNow,
  generatingReply,
  runningScenario,
  startingApproach,
  leadNameForApproach,
  onLeadNameChange,
  onStartWithApproach,
  isHandedOff,
  error,
  onNewConversation,
  onExportChat,
  onSelectConversation,
  onRequestDelete,
  historyOpen,
  onHistoryOpenChange,
  showScenarioPicker,
  onScenarioPickerOpenChange,
  scenarioSearch,
  onScenarioSearchChange,
  scenarioGroups,
  onChooseScenario,
  conversationToDelete,
  onDeleteOpenChange,
  onConfirmDelete,
}: AiSandboxChatPageProps) {
  const runStatus = activeTestRun?.passed === true
    ? { label: 'Aprovado', tone: 'success' as const }
    : activeTestRun?.passed === false
      ? { label: 'Precisa de ajuste', tone: 'warning' as const }
      : activeTestRun
        ? { label: 'Sem avaliação', tone: 'neutral' as const }
        : { label: 'Ainda não executado', tone: 'neutral' as const };

  return (
    <PageContainer size="full" className="kds-ai-page kds-operational">
      <PageHeader
        eyebrow="Kifer Saúde · Inteligência artificial"
        title="Chat e testes de IA"
        description="Valide o atendimento automatizado em uma simulação controlada. As mensagens desta tela não são enviadas a clientes."
        descriptionPlacement="visible"
        actions={(
          <Button variant="primary" size="md" onClick={onNewConversation}>
            <MessageCirclePlus className="kds-control-icon" /> Nova simulação
          </Button>
        )}
      />

      {error && (
        <Alert tone="danger" title="Não foi possível concluir a ação" className="kds-ai-page-alert">
          {error}
        </Alert>
      )}

      <div className="kds-ai-chat-layout">
        <CrmCard
          className="kds-ai-chat-card"
          title="Simulação de atendimento"
          subtitle={activeConversation?.title ?? 'Converse como lead para testar o fluxo configurado.'}
          subtitlePlacement="visible"
          actions={messages.length > 0 ? (
            <>
              <Button variant="secondary" size="md" onClick={() => onHistoryOpenChange(true)}>
                <Clock3 className="kds-control-icon" /> Histórico
              </Button>
              <IconButton variant="secondary" size="md" onClick={onExportChat} title="Exportar conversa" aria-label="Exportar conversa">
                <Download className="kds-control-icon" />
              </IconButton>
            </>
          ) : (
            <Button variant="secondary" size="md" onClick={() => onHistoryOpenChange(true)}>
              <Clock3 className="kds-control-icon" /> Histórico
            </Button>
          )}
        >
          <div
            ref={threadRef}
            className="kds-ai-chat-thread"
            role="log"
            aria-label="Mensagens da simulação"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messagesLoading ? (
              <LoadingState compact label="Carregando conversa..." />
            ) : messages.length === 0 ? (
              <EmptyState
                className="kds-ai-thread-empty"
                icon={<Sparkles className="kds-control-icon kds-ai-empty-icon" />}
                title={activeConversationId ? 'Aguardando a primeira mensagem' : 'Comece uma simulação'}
                description="Envie uma mensagem como se fosse o lead ou peça para a IA iniciar a conversa."
              />
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`kds-ai-message-row ${message.role === 'lead' ? 'is-lead' : ''}`}>
                  <Card
                    variant={message.role === 'lead' ? 'strong' : 'muted'}
                    padding="sm"
                    className={`kds-ai-message-bubble ${message.role === 'lead' ? 'is-lead' : 'is-assistant'}`}
                  >
                    <Text className="kds-ai-message-copy">{message.content}</Text>
                  </Card>
                  {message.handoff_code && (
                    <Alert tone="warning" title={`Transferência para atendente: ${message.handoff_code}`} className="kds-ai-handoff-alert">
                      {message.handoff_reason || 'A IA encaminhou este atendimento para uma pessoa da equipe.'}
                    </Alert>
                  )}
                </div>
              ))
            )}

            {runningScenario && activeConversation?.is_automated && (
              <div className="kds-ai-run-progress" role="status">
                <LoadingState compact label="Cenário em execução — acompanhando os turnos ao vivo..." />
              </div>
            )}

            {secondsUntilReply !== null && (
              <div className="kds-ai-reply-countdown" role="status">
                <Clock3 className="kds-control-icon" />
                <Text>Resposta da IA em {secondsUntilReply}s</Text>
                <Button variant="text" size="sm" onClick={onReplyNow}>Responder agora</Button>
              </div>
            )}

            {generatingReply && (
              <div className="kds-ai-generating" role="status">
                <LoadingState compact label="A IA está preparando a resposta..." />
              </div>
            )}
          </div>

          {isHandedOff && (
            <Alert tone="warning" title="Atendimento encaminhado para a equipe" className="kds-ai-handoff-notice">
              A IA não responderá às próximas mensagens desta simulação.
            </Alert>
          )}

          <form
            className="kds-ai-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void onSend();
            }}
          >
            <FieldLabel className="sr-only" htmlFor="ai-sandbox-message">Mensagem de teste</FieldLabel>
            <Textarea
              id="ai-sandbox-message"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Digite como se fosse o lead..."
              rows={2}
              disabled={sendingDraft}
              aria-label="Mensagem de teste"
              className="kds-textarea kds-ai-composer-input"
            />
            <Button type="submit" variant="primary" size="md" loading={sendingDraft} disabled={!draft.trim()}>
              <Send className="kds-control-icon" /> Enviar
            </Button>
          </form>
        </CrmCard>

        <CrmCard
          className="kds-ai-context-card"
          title="Cenário de teste"
          subtitle="Acompanhe o contexto e o resultado desta simulação."
          subtitlePlacement="visible"
          actions={(
            <Badge tone="info" size="sm">Ambiente isolado</Badge>
          )}
        >
          <div className="kds-ai-context-list">
            <div className="kds-ai-context-row">
              <div>
                <Text className="kds-ai-context-label">Conversa atual</Text>
                <Text className="kds-ai-context-value">{activeConversation?.title ?? 'Nenhuma selecionada'}</Text>
              </div>
              <Badge tone={activeConversation ? 'success' : 'neutral'} size="sm">
                {activeConversation?.is_automated ? 'Automatizada' : activeConversation ? 'Manual' : 'Aguardando'}
              </Badge>
            </div>
            <div className="kds-ai-context-row">
              <div>
                <Text className="kds-ai-context-label">Avaliação mais recente</Text>
                <Text className="kds-ai-context-value">{activeTestRun?.scenario_label ?? 'Nenhum teste nesta conversa'}</Text>
              </div>
              <Badge tone={runStatus.tone} size="sm">{runStatus.label}</Badge>
            </div>
            <div className="kds-ai-context-row">
              <div>
                <Text className="kds-ai-context-label">Uso</Text>
                <Text className="kds-ai-context-value">Mensagens não são enviadas a clientes.</Text>
              </div>
              <Badge tone="success" size="sm">Simulação</Badge>
            </div>
          </div>

          {activeTestRun ? (
            <section className="kds-ai-evaluation" aria-label="Resultado do teste">
              <Alert
                tone={activeTestRun.passed ? 'success' : 'warning'}
                title={activeTestRun.passed ? 'Teste aprovado' : 'Teste precisa de ajuste'}
              >
                {verdict.notes || `${activeTestRun.turns} turno${activeTestRun.turns === 1 ? '' : 's'} analisado${activeTestRun.turns === 1 ? '' : 's'}.`}
              </Alert>
              {verdict.violations.length > 0 && (
                <div className="kds-ai-evaluation-section">
                  <Text className="kds-ai-context-label">Pontos a corrigir</Text>
                  <ul className="kds-ai-evaluation-list">
                    {verdict.violations.map((violation) => <li key={violation}>{violation}</li>)}
                  </ul>
                </div>
              )}
              {verdict.playbookImprovements.length > 0 && (
                <div className="kds-ai-evaluation-section">
                  <Text className="kds-ai-context-label"><Lightbulb className="kds-control-icon" /> Sugestões para o playbook</Text>
                  <ul className="kds-ai-evaluation-list">
                    {verdict.playbookImprovements.map((improvement) => <li key={improvement}>{improvement}</li>)}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <EmptyState
              className="kds-ai-test-empty"
              icon={<FlaskConical className="kds-control-icon kds-ai-empty-icon" />}
              title="Nenhum cenário executado"
              description="Escolha um cenário para avaliar as respostas e receber sugestões de melhoria."
            />
          )}

          <div className="kds-ai-context-actions">
            <Button variant="secondary" size="md" fullWidth onClick={() => onScenarioPickerOpenChange(true)} disabled={runningScenario}>
              <FlaskConical className="kds-control-icon" /> Escolher cenário
            </Button>
            {!activeConversation && (
              <div className="kds-ai-approach-form">
                <Text className="kds-ai-context-label">Ou deixe a IA iniciar a conversa</Text>
                <Input
                  value={leadNameForApproach}
                  onChange={(event) => onLeadNameChange(event.target.value)}
                  placeholder="Nome do lead (opcional)"
                  size="md"
                  aria-label="Nome do lead para iniciar a abordagem"
                  disabled={startingApproach}
                />
                <Button variant="tertiary" size="md" fullWidth loading={startingApproach} onClick={onStartWithApproach}>
                  {!startingApproach && <UserRoundPlus className="kds-control-icon" />}
                  Iniciar abordagem
                </Button>
              </div>
            )}
          </div>
        </CrmCard>
      </div>

      <Drawer open={historyOpen} onOpenChange={onHistoryOpenChange} side="left" size="md" aria-label="Histórico de simulações">
        <DrawerHeader onClose={() => onHistoryOpenChange(false)}>
          <div>
            <DialogTitle>Histórico de simulações</DialogTitle>
            <DialogDescription placement="visible">Abra uma conversa anterior ou remova uma simulação.</DialogDescription>
          </div>
        </DrawerHeader>
        <DrawerBody className="kds-ai-history-body">
          {conversationsLoading ? (
            <LoadingState label="Carregando simulações..." />
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={<Clock3 className="kds-control-icon kds-ai-empty-icon" />}
              title="Nenhuma simulação salva"
              description="As conversas de teste aparecerão aqui depois que você iniciar uma."
            />
          ) : (
            <ul className="kds-ai-history-list">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="kds-ai-history-item">
                  <Button
                    variant="ghost"
                    size="md"
                    className="kds-ai-history-select"
                    aria-current={conversation.id === activeConversationId ? 'true' : undefined}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <span className="kds-ai-history-title">{conversation.title}</span>
                    {conversation.is_automated && <Badge tone="warning" size="sm">Automatizada</Badge>}
                  </Button>
                  <IconButton
                    variant="danger"
                    size="md"
                    aria-label={`Apagar simulação ${conversation.title}`}
                    title="Apagar simulação"
                    onClick={() => onRequestDelete(conversation)}
                  >
                    <Trash2 className="kds-control-icon" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </DrawerBody>
      </Drawer>

      <Drawer open={showScenarioPicker} onOpenChange={onScenarioPickerOpenChange} side="right" size="md" aria-label="Cenários de teste">
        <DrawerHeader onClose={() => onScenarioPickerOpenChange(false)}>
          <div>
            <DialogTitle>Cenários de teste</DialogTitle>
            <DialogDescription placement="visible">Use uma conversa simulada para validar o atendimento sem contatar clientes.</DialogDescription>
          </div>
        </DrawerHeader>
        <DrawerBody className="kds-ai-scenario-body">
          <Input
            value={scenarioSearch}
            onChange={(event) => onScenarioSearchChange(event.target.value)}
            placeholder="Buscar cenário..."
            size="md"
            aria-label="Buscar cenários de teste"
            leftIcon={Search}
          />
          {scenarioGroups.length === 0 ? (
            <EmptyState title="Nenhum cenário encontrado" description="Tente buscar por outro nome ou situação." />
          ) : (
            <div className="kds-ai-scenario-groups">
              {scenarioGroups.map((group) => (
                <section key={group.cat} className="kds-ai-scenario-group" aria-label={group.cat}>
                  <Text className="kds-ai-context-label">{group.cat}</Text>
                  <div className="kds-ai-scenario-options">
                    {group.scenarios.map((scenario) => (
                      <Button
                        key={scenario.key}
                        variant="ghost"
                        size="md"
                        fullWidth
                        disabled={runningScenario}
                        className="kds-ai-scenario-option"
                        onClick={() => onChooseScenario(scenario)}
                      >
                        <FlaskConical className="kds-control-icon" />
                        <span>{scenario.label}</span>
                      </Button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </DrawerBody>
      </Drawer>

      <ConfirmDialog
        open={Boolean(conversationToDelete)}
        onOpenChange={onDeleteOpenChange}
        onConfirm={onConfirmDelete}
        title="Apagar esta simulação?"
        description={conversationToDelete ? `A conversa “${conversationToDelete.title}” e seu resultado de teste serão removidos.` : undefined}
        confirmLabel="Apagar simulação"
        cancelLabel="Manter simulação"
        destructive
      />
    </PageContainer>
  );
}
