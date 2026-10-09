import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { getAutonomousFailureAction, getAutonomousRetryDelayMs } from '../ai-autonomous-reply-failure.ts';

const generationError = 'Nao foi possivel gerar resposta por IA. Tentativas: openai: Pergunta sobre CNPJ com escopo incorreto.';
const action = (attemptNumber: number, message = generationError, deliveryAttemptStarted = false) => getAutonomousFailureAction({ attemptNumber, message, deliveryAttemptStarted });

describe('autonomous failure recovery', () => {
  test('allows bounded retries and then hands generation failures to a human', () => {
    expect([1, 2, 3, 4, 5].map((attempt) => action(attempt))).toEqual(['retry', 'retry', 'retry', 'handoff', 'handoff']);
    expect([1, 2, 3, 4].map(getAutonomousRetryDelayMs)).toEqual([15_000, 60_000, 180_000, 180_000]);
  });

  test('does not retry delivery ambiguity or bypass terminal contact restrictions', () => {
    expect(action(1, generationError, true)).toBe('failed');
    expect(action(4, generationError, true)).toBe('failed');
    for (const message of ['Permissao de contato negada', 'Atendimento autonomo foi desativado', 'Chat sem lead vinculado']) {
      expect(action(1, message)).toBe('failed');
      expect(action(4, message)).toBe('failed');
    }
    expect(action(4, 'Erro ao carregar chat')).toBe('failed');
  });

  test('worker uses the existing human handoff without sending a fallback message', () => {
    const worker = readFileSync(resolve(process.cwd(), 'supabase/functions/ai-autonomous-reply-worker/index.ts'), 'utf8');
    const failureBranch = worker.slice(worker.indexOf("if (failureAction === 'handoff'"));
    expect(worker).toContain('getAutonomousFailureAction({ message, attemptNumber, deliveryAttemptStarted })');
    expect(failureBranch).toContain("handoffCode: 'PRECISA_HUMANO'");
    expect(failureBranch).toContain("reason: 'generation_attempts_exhausted'");
    expect(failureBranch).not.toContain('sendAutonomousWhatsAppText');
    expect(failureBranch).not.toContain("handoffCode: 'QUALIFICACAO_COMPLETA'");
  });
});
