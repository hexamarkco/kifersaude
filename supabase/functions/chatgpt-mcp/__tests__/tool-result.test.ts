import { describe, expect, it } from 'vitest';
import { toMcpToolResult } from '../tool-result';

describe('MCP tool response serialization', () => {
  it('redacts nested credentials and preserves literal message content', () => {
    const result = toMcpToolResult({ message: 'Olá 😊\n---\nTudo bem?', items: [{ access_token: 'private', password: 'secret' }] });
    expect(JSON.parse(result.content[0].text)).toEqual({ message: 'Olá 😊\n---\nTudo bem?', items: [{ access_token: '[REDACTED]', password: '[REDACTED]' }] });
  });

  it('uses compact JSON before giving up on a large response', () => {
    const value = { records: Array.from({ length: 2000 }, (_, id) => ({ id })) };
    expect(JSON.stringify(value, null, 2).length).toBeGreaterThan(40000);
    const result = toMcpToolResult(value);
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(value);
    expect(result.content[0].text.length).toBeLessThanOrEqual(40000);
  });

  it('returns a valid envelope for oversized results without suggesting a new mutation', () => {
    const result = toMcpToolResult({ success: true, message: 'x'.repeat(50000) });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ response_truncated: true, error_code: 'RESPONSE_TOO_LARGE', action_success: true });
    expect(JSON.parse(result.content[0].text).message).toContain('Não repita ações de escrita');
  });
});
