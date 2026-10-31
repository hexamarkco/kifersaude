import { useRef, useState, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { AiSandboxChatPage, type AiSandboxScenario } from '../../../src/features/ai-sandbox/components/AiSandboxChatPage';
import type { AiSandboxConversation, AiSandboxMessage, AiSandboxTestRun } from '../../../src/lib/aiSandboxChatService';
import '../../../src/design-system/styles.css';

const conversation: AiSandboxConversation = {
  id: 'preview-1',
  title: 'Tenho 42 anos e gostaria de conhecer os planos disponíveis.',
  created_by: null,
  is_automated: false,
  created_at: '2026-10-30T12:00:00.000Z',
  updated_at: '2026-10-30T12:03:00.000Z',
};

const initialMessages: AiSandboxMessage[] = [
  { id: 'm1', conversation_id: conversation.id, role: 'lead', content: 'Tenho 42 anos e gostaria de conhecer os planos disponíveis.', handoff_reason: null, handoff_code: null, provider: null, model: null, created_at: '2026-10-30T12:00:00.000Z' },
  { id: 'm2', conversation_id: conversation.id, role: 'ai', content: 'Claro! Posso ajudar. Você procura um plano para você ou também para outras pessoas da família?', handoff_reason: null, handoff_code: null, provider: null, model: null, created_at: '2026-10-30T12:00:08.000Z' },
  { id: 'm3', conversation_id: conversation.id, role: 'lead', content: 'Para mim e minha esposa. Moramos em Niterói.', handoff_reason: null, handoff_code: null, provider: null, model: null, created_at: '2026-10-30T12:01:00.000Z' },
  { id: 'm4', conversation_id: conversation.id, role: 'ai', content: 'Entendi. Vou considerar duas pessoas em Niterói. Vocês já possuem algum plano de saúde atualmente?', handoff_reason: null, handoff_code: null, provider: null, model: null, created_at: '2026-10-30T12:01:08.000Z' },
];

function App() {
  const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'theme-dark' : '';
  const threadRef = useRef<HTMLDivElement>(null);
  const [conversations, setConversations] = useState([conversation]);
  const [messages, setMessages] = useState(initialMessages);
  const [activeConversation, setActiveConversation] = useState<AiSandboxConversation | null>(conversation);
  const [activeTestRun, setActiveTestRun] = useState<AiSandboxTestRun | null>(null);
  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AiSandboxConversation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsUntilReply, setSecondsUntilReply] = useState<number | null>(null);

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    setMessages((current) => [...current, {
      id: `lead-${Date.now()}`, conversation_id: activeConversation?.id ?? conversation.id, role: 'lead', content,
      handoff_reason: null, handoff_code: null, provider: null, model: null, created_at: new Date().toISOString(),
    }]);
    setDraft('');
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  const startNew = () => {
    const next = { ...conversation, id: `preview-${Date.now()}`, title: 'Nova simulação', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setConversations((items) => [next, ...items]);
    setActiveConversation(next);
    setMessages([]);
    setActiveTestRun(null);
    setError(null);
  };
  const chooseScenario = (scenario: AiSandboxScenario) => {
    const next = {
      id: `run-${Date.now()}`, conversation_id: activeConversation?.id ?? conversation.id, scenario_key: scenario.key,
      scenario_label: scenario.label, turns: 3, handoff_triggered: false, handoff_code: null, passed: scenario.key !== 'a2',
      verdict: { violations: scenario.key === 'a2' ? ['A resposta não identificou a necessidade de avaliação por uma pessoa da equipe.'] : [], notes: 'A simulação foi analisada com base no cenário escolhido.', playbook_improvements: scenario.key === 'a2' ? ['Explique o próximo passo de forma clara.'] : [] },
      provider: null, model: null, created_at: new Date().toISOString(),
    } satisfies AiSandboxTestRun;
    setActiveTestRun(next);
    setScenarioOpen(false);
    if (!activeConversation) setActiveConversation(conversation);
    setMessages(initialMessages);
  };
  const filteredGroups = [{ cat: 'Qualificação', scenarios: [
    { key: 'q1', label: 'Dados todos de uma vez', p: 'Sou a Maria, 52 anos, moro em Niterói.' },
    { key: 'q2', label: 'Plano não identificado', p: 'Tenho plano pela empresa, mas não sei qual.' },
  ] }, { cat: 'Situações sensíveis', scenarios: [
    { key: 'a2', label: 'Doença preexistente', p: 'Tenho hipertensão e diabetes.' },
  ] }].map((group) => ({ ...group, scenarios: group.scenarios.filter((item) => item.label.toLowerCase().includes(scenarioSearch.toLowerCase())) })).filter((group) => group.scenarios.length > 0);

  return (
    <div className={`painel-theme kifer-ds ${theme}`} style={{ minHeight: '100dvh', background: 'var(--bg-canvas)' }}>
      <AiSandboxChatPage
        conversations={conversations} conversationsLoading={false} activeConversation={activeConversation}
        activeConversationId={activeConversation?.id ?? null} messages={messages} messagesLoading={false}
        activeTestRun={activeTestRun} verdict={{
          violations: Array.isArray(activeTestRun?.verdict.violations) ? activeTestRun.verdict.violations as string[] : [],
          notes: typeof activeTestRun?.verdict.notes === 'string' ? activeTestRun.verdict.notes : '',
          playbookImprovements: Array.isArray(activeTestRun?.verdict.playbook_improvements) ? activeTestRun.verdict.playbook_improvements as string[] : [],
        }}
        draft={draft} onDraftChange={setDraft} onSend={send} onKeyDown={handleKeyDown} threadRef={threadRef}
        sendingDraft={false} secondsUntilReply={secondsUntilReply} onReplyNow={() => setSecondsUntilReply(null)}
        generatingReply={false} runningScenario={false} startingApproach={false} leadNameForApproach=""
        onLeadNameChange={() => undefined} onStartWithApproach={() => setSecondsUntilReply(8)} isHandedOff={false}
        error={error} onNewConversation={startNew} onExportChat={() => undefined}
        onSelectConversation={(id) => { const selected = conversations.find((item) => item.id === id) ?? null; setActiveConversation(selected); setMessages(id === conversation.id ? initialMessages : []); setHistoryOpen(false); }}
        onRequestDelete={setDeleteTarget} historyOpen={historyOpen} onHistoryOpenChange={setHistoryOpen}
        showScenarioPicker={scenarioOpen} onScenarioPickerOpenChange={setScenarioOpen} scenarioSearch={scenarioSearch}
        onScenarioSearchChange={setScenarioSearch} scenarioGroups={filteredGroups} onChooseScenario={chooseScenario}
        conversationToDelete={deleteTarget} onDeleteOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirmDelete={async () => {
          if (!deleteTarget) return;
          setConversations((items) => items.filter((item) => item.id !== deleteTarget.id));
          if (activeConversation?.id === deleteTarget.id) { setActiveConversation(null); setMessages([]); }
          setDeleteTarget(null);
        }}
      />
      {error && <button type="button" onClick={() => setError(null)} aria-label="Limpar erro" className="sr-only">Limpar erro</button>}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
