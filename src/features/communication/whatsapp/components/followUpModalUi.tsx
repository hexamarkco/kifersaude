import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRightCircle,
  Briefcase,
  Calendar,
  CalendarPlus,
  Clock3,
  Feather,
  HeartHandshake,
  History,
  Loader2,
  MessageSquare,
  Scissors,
  Smile,
  Sparkles,
  Target,
} from 'lucide-react';

import { cx } from '../../../../lib/cx';
import type {
  CommWhatsAppFollowUpEmotionalContext,
  CommWhatsAppFollowUpNextAction,
  CommWhatsAppFollowUpVariation,
  CommWhatsAppRewriteTone,
} from '../../../../lib/commWhatsAppService';

// ---- Shared visual building blocks for the follow-up (single + batch) modals.
// Centralized here so both flows look and behave identically instead of
// drifting apart with copy-pasted, slightly-different markup. ----

// ---- AI insight panel: surfaces the model's own reading of the conversation
// (situationSummary/rationale) and, distinctly, when it detected something
// personal/emotional — this is the visual anchor for "a IA interpretou antes
// de escrever", not just a generic "contexto aplicado" note. ----

export function AiContextPanel({
  rationale,
  emotionalContext,
  className,
}: {
  rationale?: string | null;
  emotionalContext?: CommWhatsAppFollowUpEmotionalContext | null;
  className?: string;
}) {
  if (!rationale && !emotionalContext?.detected) {
    return null;
  }

  return (
    <div className={cx('space-y-2', className)}>
      {emotionalContext?.detected ? (
        <div className="rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--info-text)]">
          <div className="flex items-center gap-2 font-semibold">
            <HeartHandshake className="h-3.5 w-3.5 shrink-0" />
            <span>Contexto pessoal identificado</span>
          </div>
          <p className="mt-1 opacity-90">
            {emotionalContext.guidance || 'A IA percebeu algo pessoal nesta conversa e ajustou a abordagem por bom senso.'}
          </p>
        </div>
      ) : null}
      {rationale ? (
        <div className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--accent-gold-hover)]">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Leitura da IA sobre esta conversa</span>
          </div>
          <p className="mt-1 opacity-85">{rationale}</p>
        </div>
      ) : null}
    </div>
  );
}

// ---- WhatsApp-style bubble preview. Reuses the same .whatsapp-inbox-thread /
// .message-bubble classes the real inbox thread uses, so the preview looks
// exactly like the message will look once sent. ----

export function ChatBubblePreview({
  segments,
  emptyLabel = 'Gere ou escreva uma sugestão para visualizar.',
}: {
  segments: string[];
  emptyLabel?: string;
}) {
  if (segments.length === 0) {
    return (
      <div className="whatsapp-inbox-thread rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4 py-10 text-center">
        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="whatsapp-inbox-thread space-y-2 rounded-xl bg-[var(--bg-inset)] p-3">
      {segments.map((segment, index) => (
        <div key={`${index}:${segment.slice(0, 32)}`} className="message-bubble-row flex w-full justify-end">
          <div className="message-bubble message-bubble-outbound max-w-[92%] rounded-[var(--kds-radius-lg)] px-4 py-3 shadow-sm">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">{segment}</p>
            {segments.length > 1 ? (
              <div className="mt-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                {index + 1}/{segments.length}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Variations carousel ----

export function VariationCarousel({
  variations,
  onSelect,
  disabled,
}: {
  variations: CommWhatsAppFollowUpVariation[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  if (variations.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Variações geradas">
      {variations.map((variation, index) => (
        <button
          key={`${variation.label}:${index}`}
          type="button"
          onClick={() => onSelect(variation.text)}
          disabled={disabled}
          className="min-w-[12rem] max-w-[16rem] shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="block truncate font-semibold text-[var(--text-primary)]">{variation.label}</span>
          <span className="mt-1 line-clamp-2 block leading-5 text-[var(--text-muted)]">{variation.text}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Next action ----

export const formatNextActionDate = (value?: string | null) => {
  if (!value) return 'Sem data sugerida';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data sugerida inválida';
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NEXT_ACTION_BADGE_LABEL: Record<CommWhatsAppFollowUpNextAction['type'], string> = {
  schedule: 'Agendar',
  wait: 'Aguardar',
  mark_lost_recommended: 'Perdido?',
};

export function NextActionCard({
  nextAction,
  title = 'Próxima ação sugerida',
  action,
}: {
  nextAction: CommWhatsAppFollowUpNextAction;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <CalendarPlus className="h-4 w-4 text-[var(--brand-primary)]" />
            {title}
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{nextAction.reason}</p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold-hover)]">
          {NEXT_ACTION_BADGE_LABEL[nextAction.type]}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {formatNextActionDate(nextAction.suggestedDateTime)}
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" /> Tentativa {nextAction.attemptNumber}/{nextAction.maxAttempts}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
          <div className="font-semibold text-[var(--text-primary)]">Prioridade {nextAction.priority}</div>
          <div className="mt-0.5">Dia: {nextAction.dayLoad ?? 0}/{nextAction.dailyCapacity} pendentes</div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{nextAction.giveUpRecommendation}</p>

      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

// ---- Refinement chips (simple tone rewrite + context-aware refinement) ----

export type RefinementChipAction = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export type SimpleRefinementAction = RefinementChipAction & { id: CommWhatsAppRewriteTone };

export const SIMPLE_REFINEMENT_ACTIONS: SimpleRefinementAction[] = [
  { id: 'shorter', label: 'Encurtar', description: 'Reescrever a sugestão de forma mais curta e objetiva.', icon: Scissors },
  { id: 'friendly', label: 'Mais amigável', description: 'Deixar a mensagem mais leve, humana e acolhedora.', icon: Smile },
  { id: 'professional', label: 'Mais profissional', description: 'Ajustar o texto para um tom mais consultivo e profissional.', icon: Briefcase },
];

export type ContextRefinementAction = RefinementChipAction & { instruction: string };

// Refinamentos que podem mudar a ESTRATEGIA comercial da mensagem (nao so o
// estilo) sempre releem o contexto completo do chat (mode: 'refine'), para
// nao contrariar a leitura real da conversa nem repetir uma abordagem ja
// tentada sem resposta.
export const CONTEXT_REFINEMENT_ACTIONS: ContextRefinementAction[] = [
  {
    id: 'add-context',
    label: 'Usar contexto do chat',
    description: 'Refinar considerando o histórico e o momento atual da conversa.',
    icon: History,
    instruction: 'Refine a mensagem usando o contexto completo do chat. Preserve apenas fatos confirmados no histórico e deixe o próximo passo mais coerente com a conversa.',
  },
  {
    id: 'reduce-pressure',
    label: 'Menos pressão',
    description: 'Diminuir insistência e cobrança no follow-up.',
    icon: Feather,
    instruction: 'Refine a mensagem para reduzir pressão e cobrança. Mantenha cordialidade, naturalidade e uma pergunta simples para facilitar resposta.',
  },
  {
    id: 'clear-next-step',
    label: 'Próximo passo claro',
    description: 'Reforçar uma ação objetiva para avançar a conversa.',
    icon: ArrowRightCircle,
    instruction: 'Refine a mensagem para terminar com um próximo passo claro, simples e fácil de responder, sem inventar combinados ou dados.',
  },
  {
    id: 'more-assertive',
    label: 'Mais firme',
    description: 'Deixar a mensagem comercialmente mais firme, sem perder a coerência com o histórico.',
    icon: Target,
    instruction: 'Refine a mensagem para ficar comercialmente mais firme e direta, sem perder a coerência com o histórico e sem soar agressiva ou pressionar artificialmente.',
  },
  {
    id: 'find-blocker',
    label: 'Investigar bloqueio',
    description: 'Focar em descobrir o que realmente está travando a decisão do cliente.',
    icon: Sparkles,
    instruction: 'Refine a mensagem para investigar com sutileza qual é o real bloqueio do cliente neste momento (preço, insegurança, terceiro decisor, comparação, falta de urgência, etc.), em vez de apenas perguntar se ele já decidiu ou analisou.',
  },
];

export function RefinementChip({
  icon: Icon,
  label,
  description,
  onClick,
  loading,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={description}
      className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--brand-primary-border)] hover:text-[var(--accent-gold-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

// ---- Small layout helpers ----

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cx('rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm', className)}>
      {title || description || action ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent'; className?: string }) {
  return (
    <span
      className={cx(
        'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        'border-[var(--border-subtle)] bg-[var(--bg-elevated)]',
        tone === 'accent' ? 'text-[var(--accent-gold-hover)]' : 'text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
