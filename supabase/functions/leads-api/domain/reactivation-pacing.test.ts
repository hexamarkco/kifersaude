import { describe, it, expect } from 'vitest';
import { calculateReactivationIntervalSeconds } from './reactivation-pacing.ts';

describe('pacing compartilhado de reativações', () => {
  it('calcula 36 minutos para 15 envios entre 8h e 17h', () => {
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 9 * 3600, remainingDailySends: 15, pendingSendJobs: 15 },
    ])).toBe(36 * 60);
  });
  it('combina dois fluxos sem permitir que disparem simultaneamente', () => {
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 9 * 3600, remainingDailySends: 15, pendingSendJobs: 15 },
      { remainingWindowSeconds: 9 * 3600, remainingDailySends: 10, pendingSendJobs: 10 },
    ])).toBe(1296);
  });
  it('se ajusta à janela e quantidade de envios ainda pendentes', () => {
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 4 * 3600, remainingDailySends: 15, pendingSendJobs: 4 },
    ])).toBe(3600);
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 4 * 3600, remainingDailySends: 0, pendingSendJobs: 4 },
      { remainingWindowSeconds: 4 * 3600, remainingDailySends: 6, pendingSendJobs: 6 },
    ])).toBe(2400);
  });
  it('evita envios sem ritmo em configurações inválidas e aceita intervalos longos', () => {
    expect(calculateReactivationIntervalSeconds([])).toBeNull();
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 9 * 3600, remainingDailySends: 0, pendingSendJobs: 100 },
    ])).toBeNull();
    expect(calculateReactivationIntervalSeconds([
      { remainingWindowSeconds: 10 * 3600, remainingDailySends: 1, pendingSendJobs: 1 },
    ])).toBe(36000);
  });
});
