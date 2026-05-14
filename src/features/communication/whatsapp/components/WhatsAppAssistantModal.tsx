import { AlertCircle, CheckCircle2, Loader2, SendHorizontal, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppAssistantResponse, CommWhatsAppAssistantScope } from '../../../../lib/commWhatsAppService';

type WhatsAppAssistantModalProps = {
  isOpen: boolean;
  loading: boolean;
  prompt: string;
  scope: CommWhatsAppAssistantScope;
  response: CommWhatsAppAssistantResponse | null;
  selectedChatName?: string | null;
  hasSelectedChat: boolean;
  onClose: () => void;
  onPromptChange: (value: string) => void;
  onScopeChange: (value: CommWhatsAppAssistantScope) => void;
  onAsk: () => void;
  onApplySuggestedMessage: (message: string) => void;
};

const promptExamples = [
  'O que eu deveria responder agora?',
  'Resuma essa conversa e diga o próximo passo.',
  'Onde devo olhar primeiro no inbox hoje?',
  'Liste os tipos de contato que preciso priorizar hoje.',
];

const scopeOptions: Array<{ value: CommWhatsAppAssistantScope; label: string; description: string }> = [
  { value: 'free', label: 'Livre', description: 'Sistema, operação, múltiplos contatos ou dúvidas gerais.' },
  { value: 'chat', label: 'Chat atual', description: 'Força análise da conversa aberta.' },
  { value: 'inbox', label: 'Inbox', description: 'Foco em fila, status e WhatsApp.' },
  { value: 'system', label: 'Sistema/CRM', description: 'Foco em leads, contratos, agenda e processos.' },
];

const getScopeFooterText = (scope: CommWhatsAppAssistantScope, hasSelectedChat: boolean, selectedChatName?: string | null) => {
  if (scope === 'chat') {
    return hasSelectedChat ? `Modo: chat atual${selectedChatName ? ` (${selectedChatName})` : ''}.` : 'Modo: chat atual, mas nenhuma conversa está selecionada.';
  }

  if (scope === 'inbox') return 'Modo: inbox geral do WhatsApp.';
  if (scope === 'system') return 'Modo: sistema/CRM.';
  return hasSelectedChat ? 'Modo: livre. O chat atual só será usado se a pergunta pedir claramente.' : 'Modo: livre.';
};

const confidenceLabel = (confidence: CommWhatsAppAssistantResponse['confidence']) => {
  if (confidence === 'high') return 'Alta confiança';
  if (confidence === 'low') return 'Baixa confiança';
  return 'Confiança média';
};

const actionTypeLabel = (type: string) => {
  if (type === 'draft_message') return 'Mensagem';
  if (type === 'schedule_follow_up') return 'Agenda';
  if (type === 'review_lead') return 'Lead';
  if (type === 'open_dashboard') return 'Painel';
  return 'Manual';
};

export default function WhatsAppAssistantModal({
  isOpen,
  loading,
  prompt,
  scope,
  response,
  selectedChatName,
  hasSelectedChat,
  onClose,
  onPromptChange,
  onScopeChange,
  onAsk,
  onApplySuggestedMessage,
}: WhatsAppAssistantModalProps) {
  const trimmedPrompt = prompt.trim();
  const canAsk = trimmedPrompt.length > 0 && !loading;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="R.A.V.I."
      description="Assistente operacional do WhatsApp Inbox. Ele analisa o contexto e sugere ações, mas nada é enviado ou alterado sem confirmação."
      size="xl"
      panelClassName="config-transparent-buttons"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
            {getScopeFooterText(scope, hasSelectedChat, selectedChatName)}
          </div>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-4 rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--panel-accent-strong,#c86f1d)] text-white shadow-lg shadow-orange-900/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Pergunte de forma livre</p>
              <p className="mt-1 text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">
                O R.A.V.I. é livre por padrão. Use o modo Chat atual quando quiser analisar explicitamente a conversa aberta.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {scopeOptions.map((option) => {
              const active = option.value === scope;
              const disabled = loading || (option.value === 'chat' && !hasSelectedChat);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onScopeChange(option.value)}
                  disabled={disabled}
                  className={cx(
                    'rounded-2xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
                    active
                      ? 'border-[var(--panel-accent-border,#d5a25c)] bg-[var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)]'
                      : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d5a25c)]',
                  )}
                >
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em]">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 opacity-80">{option.description}</span>
                </button>
              );
            })}
          </div>

          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ex.: gere uma resposta consultiva para retomar esse cliente sem pressionar"
            rows={7}
            className="min-h-[168px] w-full resize-none rounded-2xl border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3 text-sm leading-6 text-[var(--panel-text,#1a120d)] outline-none transition focus:border-[var(--panel-accent-strong,#c86f1d)] focus:ring-2 focus:ring-[var(--panel-accent-soft,#f4e2cc)]"
            disabled={loading}
          />

          <div className="flex flex-wrap gap-2">
            {promptExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onPromptChange(example)}
                disabled={loading}
                className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-1.5 text-xs font-medium text-[var(--panel-text-soft,#5b4635)] transition hover:border-[var(--panel-accent-strong,#c86f1d)] hover:text-[var(--panel-accent-ink,#8b4d12)] disabled:opacity-60"
              >
                {example}
              </button>
            ))}
          </div>

          <Button onClick={onAsk} loading={loading} disabled={!canAsk} fullWidth>
            <SendHorizontal className="h-4 w-4" />
            Consultar R.A.V.I.
          </Button>
        </section>

        <section className="min-h-[360px] rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
          {loading ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center text-sm text-[var(--panel-text-muted,#876f5c)]">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--panel-accent-strong,#c86f1d)]" />
              Analisando contexto operacional...
            </div>
          ) : response ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--panel-accent-soft,#f4e2cc)] px-3 py-1 text-xs font-semibold text-[var(--panel-accent-ink,#8b4d12)]">
                  {confidenceLabel(response.confidence)}
                </span>
                {response.provider ? (
                  <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] px-3 py-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
                    {response.provider}{response.model ? ` · ${response.model}` : ''}
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl bg-[var(--panel-surface-soft,#f8f2e9)] px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--panel-text,#1a120d)]">{response.answer}</p>
              </div>

              {response.clarification ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm leading-6">{response.clarification}</p>
                </div>
              ) : null}

              {response.suggestedMessage ? (
                <div className="space-y-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Mensagem sugerida</p>
                    <Button
                      size="sm"
                      onClick={() => onApplySuggestedMessage(response.suggestedMessage || '')}
                      disabled={!hasSelectedChat}
                    >
                      Aplicar no composer
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">{response.suggestedMessage}</p>
                </div>
              ) : null}

              {response.actionPlan.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">Plano confirmável</p>
                  {response.actionPlan.map((action) => (
                    <div key={action.id} className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">{action.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">{action.description}</p>
                        </div>
                        <span className="rounded-full bg-[var(--panel-surface-soft,#f8f2e9)] px-2.5 py-1 text-[11px] font-semibold text-[var(--panel-text-muted,#876f5c)]">
                          {actionTypeLabel(action.type)}
                        </span>
                      </div>
                      <div className={cx('mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', action.requiresConfirmation ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {action.requiresConfirmation ? 'Requer confirmação humana' : 'Informativo'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <Sparkles className="h-9 w-9 text-[var(--panel-accent-strong,#c86f1d)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Pronto para analisar</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[var(--panel-text-muted,#876f5c)]">
                  Faça uma pergunta aberta. No modo livre, o R.A.V.I. não assume que o chat aberto é o assunto.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
