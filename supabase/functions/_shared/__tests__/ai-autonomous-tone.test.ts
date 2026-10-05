import { describe, expect, test } from 'vitest';
import {
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
  AUTONOMOUS_QUALIFICATION_HANDOFF_INSTRUCTION,
  buildAutonomousAttendanceUserPrompt,
  buildAutonomousValidationRetryInstruction,
  CHILD_ONLY_ELIGIBILITY_VALIDATION_MESSAGE,
  QUALIFICATION_CLOSURE_VALIDATION_MESSAGE,
  QUALIFICATION_PROCESS_NARRATION_VALIDATION_MESSAGE,
  QUALIFICATION_REPETITION_VALIDATION_MESSAGE,
  splitGeneratedReply,
  validateAutonomousReplyOutput,
} from '../ai-autonomous-helpers';
import { buildJudgePrompt } from '../../ai-sandbox-run-scenario/judge-prompt';
import { autonomousToneScenarios } from './fixtures/autonomous-conversation-tone';

describe('contextual autonomous conversation contract', () => {
  test.each(autonomousToneScenarios)('$key accepts a relevant candidate and preserves handoff', (scenario) => {
    expect(validateAutonomousReplyOutput(scenario.candidate, scenario.history)).toEqual({ valid: true });
    const reply = splitGeneratedReply(scenario.candidate, false);
    expect(reply.handoffCode).toBe(scenario.handoff);
    expect(reply.messages.join(' ')).not.toContain('[[HANDOFF');
    const prompt = buildAutonomousAttendanceUserPrompt(scenario.history);
    for (const row of scenario.history) expect(prompt).toContain(row.content);
  });

  test('production system and user prompts distinguish thanks from acceptance', () => {
    const scenario = autonomousToneScenarios[3];
    const prompt = buildAutonomousAttendanceUserPrompt(scenario.history);
    for (const instructions of [prompt, AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS]) {
      expect(instructions).toContain('sem repetir a pergunta pendente');
      expect(instructions).toContain('recusa explicita ou QUALIFICACAO_COMPLETA');
      expect(instructions).toContain('um ok que aceite uma alternativa');
      expect(instructions).not.toContain('avancar o campo pendente');
    }
  });

  test('thanks does not bypass the initial child eligibility guidance', () => {
    const scenario = autonomousToneScenarios[3];
    expect(validateAutonomousReplyOutput(scenario.candidate, [scenario.history[0]]).message)
      .toBe(CHILD_ONLY_ELIGIBILITY_VALIDATION_MESSAGE);
    expect(validateAutonomousReplyOutput(scenario.candidate, scenario.history)).toEqual({ valid: true });
  });

  test.each([
    'Algum adulto também entrará no plano?',
    'Você precisa incluir um adulto?',
  ])('a question alone does not count as explaining child eligibility: %s', (question) => {
    const scenario = autonomousToneScenarios[3];
    const history = [scenario.history[0], { role: 'ai' as const, content: question }, scenario.history[2]];
    expect(validateAutonomousReplyOutput(scenario.candidate, history).message)
      .toBe(CHILD_ONLY_ELIGIBILITY_VALIDATION_MESSAGE);
  });

  test('production prompts permit objective questions and contextual preferences without a fixed closure', () => {
    const prompt = buildAutonomousAttendanceUserPrompt(autonomousToneScenarios[4].history, {
      isFirstLeadReplyAfterApproach: true,
    });
    expect(prompt).toContain('Um dado objetivo pode receber uma pergunta direta');
    expect(prompt).toContain('Uma preferencia pode ser retomada');
    expect(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS).toContain('mesmo com outras palavras');
    expect(AUTONOMOUS_QUALIFICATION_HANDOFF_INSTRUCTION).toContain('preparo e envio da cotacao');
    expect(AUTONOMOUS_QUALIFICATION_HANDOFF_INSTRUCTION).not.toContain('Ja consegui as informacoes');
  });

  test.each([
    QUALIFICATION_REPETITION_VALIDATION_MESSAGE,
    QUALIFICATION_PROCESS_NARRATION_VALIDATION_MESSAGE,
    QUALIFICATION_CLOSURE_VALIDATION_MESSAGE,
    'A copy visivel nao pode usar dois-pontos ou travessao.',
  ])('correction preserves intent and care for %s', (message) => {
    const instruction = buildAutonomousValidationRetryInstruction({ valid: false, stopReason: 'invalid_output', message });
    expect(instruction).toContain(message);
    expect(instruction).toContain('mantendo o cuidado, a intencao e o contexto util');
    expect(instruction).toContain('nao deve apagar o acolhimento');
    expect(instruction).not.toContain('use este fechamento');
    expect(instruction).not.toContain('Ja consegui as informacoes');
  });

  test('scenario judge receives real history and evaluates semantics without keyword requirements', () => {
    const scenario = autonomousToneScenarios[1];
    const history = [...scenario.history, { role: 'ai' as const, content: scenario.candidate }];
    const judge = buildJudgePrompt(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, history, true, scenario.handoff);
    expect(judge.systemPrompt).toContain(AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS);
    for (const row of history) expect(judge.userPrompt).toContain(row.content);
    expect(judge.userPrompt).toContain('codigo QUALIFICACAO_COMPLETA');
    expect(judge.userPrompt).toContain('promessas genericas repetidas');
    expect(judge.userPrompt).toContain('sem repetir a pergunta pendente');
    expect(judge.userPrompt).toContain('nao exija empatia artificial');
    expect(judge.userPrompt).toContain('Nao exija palavras como perfil ou necessidades');
    expect(judge.userPrompt).toContain('"playbook_improvements"');
  });
});
