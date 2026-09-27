import {
  ArrowRightCircle,
  Briefcase,
  Feather,
  History,
  Scissors,
  Smile,
  Sparkles,
  Target,
} from 'lucide-react';
import type { ComponentType } from 'react';

import type {
  CommWhatsAppFollowUpNextAction,
  CommWhatsAppRewriteTone,
} from '../data';

export function formatNextActionDate(value?: string | null): string {
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
}

const NEXT_ACTION_BADGE_LABEL: Record<CommWhatsAppFollowUpNextAction['type'], string> = {
  schedule: 'Agendar',
  wait: 'Aguardar',
  mark_lost_recommended: 'Perdido?',
};

export function getNextActionBadgeLabel(type: CommWhatsAppFollowUpNextAction['type']): string {
  return NEXT_ACTION_BADGE_LABEL[type];
}

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
