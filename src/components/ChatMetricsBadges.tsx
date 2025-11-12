import { useMemo } from 'react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { formatEstimatedTime } from '../lib/reminderUtils';

type MinimalChatMessage = {
  timestamp: string;
  message_type: 'sent' | 'received';
};

const MINUTE_IN_MS = 60 * 1000;
const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const parseTimestampValue = (value?: string | null): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
};

const formatRelativeTimeFromNow = (timestamp: number): string | null => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  const diffInSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);

  if (absoluteSeconds < 60) {
    return relativeTimeFormatter.format(diffInSeconds, 'second');
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return relativeTimeFormatter.format(diffInMinutes, 'minute');
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return relativeTimeFormatter.format(diffInHours, 'hour');
  }

  const diffInDays = Math.round(diffInHours / 24);
  if (Math.abs(diffInDays) < 7) {
    return relativeTimeFormatter.format(diffInDays, 'day');
  }

  const diffInWeeks = Math.round(diffInDays / 7);
  if (Math.abs(diffInWeeks) < 5) {
    return relativeTimeFormatter.format(diffInWeeks, 'week');
  }

  const diffInMonths = Math.round(diffInDays / 30);
  if (Math.abs(diffInMonths) < 12) {
    return relativeTimeFormatter.format(diffInMonths, 'month');
  }

  const diffInYears = Math.round(diffInDays / 365);
  return relativeTimeFormatter.format(diffInYears, 'year');
};

const formatAverageResponse = (durationMs: number): string | null => {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }

  if (durationMs < MINUTE_IN_MS) {
    return '< 1 min';
  }

  const minutes = Math.max(1, Math.round(durationMs / MINUTE_IN_MS));
  const formatted = formatEstimatedTime(minutes);
  return formatted || `${minutes} min`;
};

export type ChatMetrics = {
  hasMessages: boolean;
  hasInboundMessages: boolean;
  hasOutboundMessages: boolean;
  responsePairs: number;
  lastReceivedIso: string | null;
  lastSentIso: string | null;
  averageResponseMs: number | null;
};

export const computeChatMetrics = (messages: MinimalChatMessage[]): ChatMetrics => {
  if (messages.length === 0) {
    return {
      hasMessages: false,
      hasInboundMessages: false,
      hasOutboundMessages: false,
      responsePairs: 0,
      lastReceivedIso: null,
      lastSentIso: null,
      averageResponseMs: null,
    };
  }

  const sortedMessages = [...messages].sort(
    (a, b) => parseTimestampValue(a.timestamp) - parseTimestampValue(b.timestamp)
  );

  let lastReceivedIso: string | null = null;
  let lastSentIso: string | null = null;
  let hasInboundMessages = false;
  let hasOutboundMessages = false;
  let totalResponseMs = 0;
  let responsePairs = 0;
  const pendingReceivedTimestamps: number[] = [];

  sortedMessages.forEach((message) => {
    const timestamp = parseTimestampValue(message.timestamp);
    if (timestamp <= 0) {
      return;
    }

    if (message.message_type === 'received') {
      hasInboundMessages = true;
      lastReceivedIso = message.timestamp;
      pendingReceivedTimestamps.push(timestamp);
    } else if (message.message_type === 'sent') {
      hasOutboundMessages = true;
      lastSentIso = message.timestamp;

      if (pendingReceivedTimestamps.length > 0) {
        const receivedTimestamp = pendingReceivedTimestamps.shift();
        if (typeof receivedTimestamp === 'number' && timestamp >= receivedTimestamp) {
          totalResponseMs += timestamp - receivedTimestamp;
          responsePairs += 1;
        }
      }
    }
  });

  return {
    hasMessages: sortedMessages.length > 0,
    hasInboundMessages,
    hasOutboundMessages,
    responsePairs,
    lastReceivedIso,
    lastSentIso,
    averageResponseMs: responsePairs > 0 ? totalResponseMs / responsePairs : null,
  };
};

type ChatBadgeVariant = 'default' | 'muted' | 'warning' | 'critical';

type ChatBadge = {
  key: string;
  text: string;
  title?: string;
  variant: ChatBadgeVariant;
};

type ChatMetricsBadgesProps = {
  stats: ChatMetrics;
  isGroupChat: boolean;
  warningThresholdMinutes: number;
  criticalThresholdMinutes: number;
};

const BADGE_BASE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border';

const BADGE_VARIANT_CLASSES: Record<ChatBadgeVariant, string> = {
  default: 'bg-white/20 text-white border-white/30',
  muted: 'bg-white/10 text-white/70 border-white/20',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-500 border-red-200',
};

export function ChatMetricsBadges({
  stats,
  isGroupChat,
  warningThresholdMinutes,
  criticalThresholdMinutes,
}: ChatMetricsBadgesProps) {
  const badges = useMemo<ChatBadge[]>(() => {
    const computedBadges: ChatBadge[] = [];
    const {
      hasMessages,
      hasInboundMessages,
      hasOutboundMessages,
      lastReceivedIso,
      averageResponseMs,
      responsePairs,
    } = stats;

    if (isGroupChat) {
      computedBadges.push({
        key: 'last-contact',
        text: 'Último contato: Indisponível em grupos',
        variant: 'muted',
      });
      computedBadges.push({
        key: 'avg-response',
        text: 'Tempo médio de resposta: Indisponível em grupos',
        variant: 'muted',
      });
      return computedBadges;
    }

    if (!hasMessages) {
      computedBadges.push({
        key: 'last-contact',
        text: 'Último contato: Sem histórico',
        variant: 'muted',
      });
    } else if (!hasInboundMessages || !lastReceivedIso) {
      computedBadges.push({
        key: 'last-contact',
        text: 'Último contato: Nenhuma mensagem recebida',
        variant: 'muted',
      });
    } else {
      const lastReceivedTimestamp = parseTimestampValue(lastReceivedIso);
      const relativeLabel = formatRelativeTimeFromNow(lastReceivedTimestamp);

      if (relativeLabel) {
        computedBadges.push({
          key: 'last-contact',
          text: `Último contato ${relativeLabel}`,
          title: formatDateTimeFullBR(lastReceivedIso),
          variant: 'default',
        });
      } else {
        computedBadges.push({
          key: 'last-contact',
          text: 'Último contato: Indisponível',
          variant: 'muted',
        });
      }
    }

    if (!hasMessages) {
      computedBadges.push({
        key: 'avg-response',
        text: 'Tempo médio de resposta: Sem histórico',
        variant: 'muted',
      });
      return computedBadges;
    }

    if (!hasInboundMessages || !hasOutboundMessages || averageResponseMs === null) {
      computedBadges.push({
        key: 'avg-response',
        text: 'Tempo médio de resposta: Sem dados',
        variant: 'muted',
      });
      return computedBadges;
    }

    const formattedAverage = formatAverageResponse(averageResponseMs);
    if (!formattedAverage) {
      computedBadges.push({
        key: 'avg-response',
        text: 'Tempo médio de resposta: Sem dados',
        variant: 'muted',
      });
      return computedBadges;
    }

    const averageMinutes = averageResponseMs / MINUTE_IN_MS;
    let variant: ChatBadgeVariant = 'default';

    if (averageMinutes >= criticalThresholdMinutes) {
      variant = 'critical';
    } else if (averageMinutes >= warningThresholdMinutes) {
      variant = 'warning';
    }

    computedBadges.push({
      key: 'avg-response',
      text: `Tempo médio de resposta ${formattedAverage}`,
      variant,
      title:
        responsePairs > 1
          ? `Calculado a partir de ${responsePairs} interações`
          : responsePairs === 1
          ? 'Calculado a partir de 1 interação'
          : undefined,
    });

    return computedBadges;
  }, [
    stats,
    isGroupChat,
    warningThresholdMinutes,
    criticalThresholdMinutes,
  ]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`${BADGE_BASE_CLASS} ${BADGE_VARIANT_CLASSES[badge.variant]}`}
          title={badge.title}
        >
          {badge.text}
        </span>
      ))}
    </div>
  );
}

