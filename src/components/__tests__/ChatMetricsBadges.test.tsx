import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatMetricsBadges, type ChatMetrics } from '../ChatMetricsBadges.js';

const renderBadges = (
  stats: ChatMetrics,
  options: { warning?: number; critical?: number; isGroup?: boolean } = {}
) => {
  const { warning = 30, critical = 60, isGroup = false } = options;
  return renderToStaticMarkup(
    <ChatMetricsBadges
      stats={stats}
      isGroupChat={isGroup}
      warningThresholdMinutes={warning}
      criticalThresholdMinutes={critical}
    />
  );
};

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findBadgeMarkup = (markup: string, text: string) => {
  const pattern = new RegExp(`<span[^>]*>${escapeForRegex(text)}<\\/span>`);
  return markup.match(pattern)?.[0] ?? null;
};

const withFixedNow = (isoDate: string, callback: () => void) => {
  const originalNow = Date.now;
  Date.now = () => new Date(isoDate).getTime();
  try {
    callback();
  } finally {
    Date.now = originalNow;
  }
};

test('renders relative last contact and average response metrics', () => {
  const stats: ChatMetrics = {
    hasMessages: true,
    hasInboundMessages: true,
    hasOutboundMessages: true,
    responsePairs: 2,
    lastReceivedIso: '2024-03-10T14:00:00.000Z',
    lastSentIso: '2024-03-10T14:05:00.000Z',
    averageResponseMs: 5 * 60 * 1000,
  };

  withFixedNow('2024-03-10T15:00:00.000Z', () => {
    const markup = renderBadges(stats);
    assert.ok(findBadgeMarkup(markup, 'Último contato há 1 hora'));
    assert.ok(findBadgeMarkup(markup, 'Tempo médio de resposta 5 min'));
  });
});

test('applies warning styles when average response exceeds SLA warning threshold', () => {
  const stats: ChatMetrics = {
    hasMessages: true,
    hasInboundMessages: true,
    hasOutboundMessages: true,
    responsePairs: 1,
    lastReceivedIso: '2024-03-10T12:00:00.000Z',
    lastSentIso: '2024-03-10T13:30:00.000Z',
    averageResponseMs: 90 * 60 * 1000,
  };

  withFixedNow('2024-03-10T15:00:00.000Z', () => {
    const markup = renderBadges(stats, { warning: 30, critical: 120 });
    const badgeMarkup = findBadgeMarkup(markup, 'Tempo médio de resposta 1h 30min');
    assert.ok(badgeMarkup);
    assert.ok(badgeMarkup?.includes('bg-yellow-100'));
    assert.ok(badgeMarkup?.includes('text-yellow-800'));
  });
});

test('marks metrics as unavailable when conversation has no history', () => {
  const stats: ChatMetrics = {
    hasMessages: false,
    hasInboundMessages: false,
    hasOutboundMessages: false,
    responsePairs: 0,
    lastReceivedIso: null,
    lastSentIso: null,
    averageResponseMs: null,
  };

  const markup = renderBadges(stats);
  assert.ok(findBadgeMarkup(markup, 'Último contato: Sem histórico'));
  assert.ok(findBadgeMarkup(markup, 'Tempo médio de resposta: Sem histórico'));
});

test('indicates that metrics are unavailable for group chats', () => {
  const stats: ChatMetrics = {
    hasMessages: true,
    hasInboundMessages: true,
    hasOutboundMessages: true,
    responsePairs: 1,
    lastReceivedIso: '2024-03-10T14:00:00.000Z',
    lastSentIso: '2024-03-10T14:15:00.000Z',
    averageResponseMs: 15 * 60 * 1000,
  };

  const markup = renderBadges(stats, { isGroup: true });
  assert.ok(findBadgeMarkup(markup, 'Último contato: Indisponível em grupos'));
  assert.ok(findBadgeMarkup(markup, 'Tempo médio de resposta: Indisponível em grupos'));
});
