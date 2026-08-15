import assert from 'node:assert/strict';
import { test } from 'vitest';

import { CampaignTargetLeaseLostError, createLockToken, updateClaimedTarget } from '../campaign-lock';

/**
 * Simula a tabela `comm_whatsapp_campaign_targets` com semântica de linha única:
 * um UPDATE só afeta a linha se id + status + lock_token baterem exatamente com o
 * estado atual — a mesma garantia que a cláusula WHERE composta produz no Postgres real.
 */
const makeTargetsTableStub = (initialRow: { id: string; status: string; lock_token: string | null }) => {
  const row = { ...initialRow };
  const updateCalls: Record<string, unknown>[] = [];

  const client = {
    from: (_table: string) => ({
      update: (patch: Record<string, unknown>) => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return builder;
          },
          select: (_columns: string) => builder,
          maybeSingle: async () => {
            updateCalls.push({ ...patch, __filters: filters });
            const matches =
              row.id === filters.id && row.status === filters.status && row.lock_token === filters.lock_token;

            if (!matches) {
              return { data: null, error: null };
            }

            Object.assign(row, patch);
            return { data: { id: row.id }, error: null };
          },
        };
        return builder;
      },
    }),
  } as any;

  return { client, row, updateCalls };
};

test('worker com o lock_token correto consegue transicionar o alvo', async () => {
  const lockToken = createLockToken();
  const { client, row } = makeTargetsTableStub({ id: 'target-1', status: 'sending', lock_token: lockToken });

  await updateClaimedTarget(client, { id: 'target-1', lock_token: lockToken }, { status: 'sent' });

  assert.equal(row.status, 'sent');
});

test('worker com lock_token desatualizado (perdeu a corrida) recebe CampaignTargetLeaseLostError, sem corromper o alvo', async () => {
  const winnerToken = createLockToken();
  const staleToken = createLockToken();
  assert.notEqual(winnerToken, staleToken);

  // O alvo já foi reivindicado/atualizado por outro worker com um token diferente
  // (ex.: o lock anterior expirou e outra invocação já assumiu o alvo).
  const { client, row } = makeTargetsTableStub({ id: 'target-1', status: 'sending', lock_token: winnerToken });

  await assert.rejects(
    () => updateClaimedTarget(client, { id: 'target-1', lock_token: staleToken }, { status: 'sent' }),
    CampaignTargetLeaseLostError,
  );

  // O alvo permanece intacto — o worker perdedor não conseguiu sobrescrever o estado.
  assert.equal(row.status, 'sending');
  assert.equal(row.lock_token, winnerToken);
});

test('duas invocações concorrentes disputando o mesmo alvo: só uma vence, nunca as duas', async () => {
  const winnerToken = createLockToken();
  const loserToken = createLockToken();

  const { client } = makeTargetsTableStub({ id: 'target-1', status: 'sending', lock_token: winnerToken });

  const results = await Promise.allSettled([
    updateClaimedTarget(client, { id: 'target-1', lock_token: winnerToken }, { status: 'sent' }),
    updateClaimedTarget(client, { id: 'target-1', lock_token: loserToken }, { status: 'sent' }),
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'exatamente um worker deveria conseguir transicionar o alvo');
  assert.equal(rejected.length, 1, 'exatamente um worker deveria perder a corrida');
  assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof CampaignTargetLeaseLostError);
});

test('sem lock_token, falha imediatamente sem consultar o banco (nunca dispara update às cegas)', async () => {
  const { client, updateCalls } = makeTargetsTableStub({ id: 'target-1', status: 'sending', lock_token: null });

  await assert.rejects(
    () => updateClaimedTarget(client, { id: 'target-1', lock_token: null }, { status: 'sent' }),
    CampaignTargetLeaseLostError,
  );

  assert.equal(updateCalls.length, 0);
});

test('createLockToken gera valores distintos a cada chamada', () => {
  const tokens = new Set(Array.from({ length: 20 }, () => createLockToken()));
  assert.equal(tokens.size, 20);
});
