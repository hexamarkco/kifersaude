import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'supabase/functions/leads-api/index.ts'), 'utf8');

describe('contrato das mensagens IA de fluxo', () => {
  it('resolve o pacote completo antes de qualquer envio e grava o cache no job', () => {
    const resolveIndex = source.indexOf('const messagePayloads = await resolveFlowMessagePayloads');
    const sendIndex = source.indexOf('await sendAutoContactMessage({', resolveIndex);

    expect(resolveIndex).toBeGreaterThan(-1);
    expect(sendIndex).toBeGreaterThan(resolveIndex);
    expect(source).toContain('ai_generated_messages');
    expect(source).toContain('storedByIndex.get(itemIndex)');
    expect(source).toContain('persistAutoContactAiMessages');
  });

  it('mantém a ordem declarada para Template, Custom e IA', () => {
    expect(source).toContain("for (const [itemIndex, item] of items.entries())");
    expect(source).toContain("if ('ai' in item)");
    expect(source).toContain("if ('templateId' in item)");
    expect(source).toContain('const customPayload = buildCustomMessagePayload(item.custom');
  });

  it('oferece prévia autenticada sem acoplar a criação de job ou envio', () => {
    const previewStart = source.indexOf("if (action === 'preview-flow-message'");
    const testStart = source.indexOf("if (action === 'test-flow'", previewStart);
    const previewBlock = source.slice(previewStart, testStart);

    expect(previewStart).toBeGreaterThan(-1);
    expect(previewBlock).toContain('authorizeDashboard(ADMIN_ROLE_SET)');
    expect(previewBlock).toContain('generateAutoContactAiMessage');
    expect(previewBlock).not.toContain('auto_contact_flow_jobs');
    expect(previewBlock).not.toContain('sendAutoContactMessage');
  });
});
