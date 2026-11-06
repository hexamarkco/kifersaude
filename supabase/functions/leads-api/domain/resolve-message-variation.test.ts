import { describe, expect, it, vi } from 'vitest';
import { resolveMessageVariation, type MessageVariationSelection } from './resolve-message-variation';

const primary = [{ custom: { type: 'text' as const, text: 'Olá {{primeiro_nome}}!' } }];
const alternatives = [{ id: 'alternative', messages: [
  { custom: { type: 'text' as const, text: 'Bom dia!' } },
  { ai: { instruction: 'Pergunte pelo plano desejado' } },
] }];

describe('escolha de variações de abordagem', () => {
  it('preserva etapas antigas e o pacote na ordem original', async () => {
    const persist = vi.fn();
    expect(await resolveMessageVariation({ primaryMessages: primary, variations: undefined, seed: 'job', persist })).toEqual(primary);
    expect(persist).not.toHaveBeenCalled();
  });

  it('distribui execuções entre versões completas sem juntar as alternativas', async () => {
    const choices = new Set<string>();
    for (let index = 0; index < 100; index++) {
      const persist = vi.fn().mockResolvedValue(undefined);
      const messages = await resolveMessageVariation({ primaryMessages: primary, variations: alternatives, seed: `job-${index}`, persist });
      const selection = persist.mock.calls[0][0] as MessageVariationSelection;
      choices.add(selection.id);
      expect(messages).toEqual(selection.id === 'primary' ? primary : alternatives[0].messages);
      expect(persist).toHaveBeenCalledTimes(1);
    }
    expect([...choices].sort()).toEqual(['alternative', 'primary']);
  });

  it('preserva o snapshot no retry mesmo com versões editadas ou removidas', async () => {
    const saved: MessageVariationSelection[] = [];
    const first = await resolveMessageVariation({ primaryMessages: primary, variations: alternatives, seed: 'job-1',
      persist: async (selection) => { saved.push(structuredClone(selection)); } });
    expect(await resolveMessageVariation({ primaryMessages: [], variations: [], storedSelection: saved[0], seed: 'different-job' })).toEqual(first);
    expect(await resolveMessageVariation({ primaryMessages: primary, variations: alternatives, seed: 'job-1' })).toEqual(first);
  });

  it('bloqueia a resolução quando falha a persistência antes do envio', async () => {
    await expect(resolveMessageVariation({ primaryMessages: primary, variations: alternatives, seed: 'job-1',
      persist: async () => { throw new Error('falha simulada'); } })).rejects.toThrow('falha simulada');
  });

  it('preserva a principal para jobs antigos que já geraram mensagens IA', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    expect(await resolveMessageVariation({ primaryMessages: primary, variations: alternatives,
      seed: 'job-1', preservePrimary: true, persist })).toEqual(primary);
    expect(persist).toHaveBeenCalledWith({ id: 'primary', messages: primary });
  });

  it('não transforma versão incompleta nem snapshot inválido em envio da principal', async () => {
    await expect(resolveMessageVariation({ primaryMessages: [], variations: [{ id: 'empty', messages: [] }], seed: 'job' })).rejects.toThrow('incompletas');
    await expect(resolveMessageVariation({ primaryMessages: primary, variations: alternatives, storedSelection: { id: 'bad', messages: [] }, seed: 'job' })).rejects.toThrow('salva está incompleta');
  });
});
