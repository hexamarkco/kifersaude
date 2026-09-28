import { describe, expect, it } from 'vitest';
import { resolveOAuthResource } from '../oauth-resource';

describe('OAuth resource binding', () => {
  const expectedResource = 'https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp';

  it('uses the canonical resource when older clients omit the parameter', () => {
    expect(resolveOAuthResource(null, expectedResource)).toBe(expectedResource);
    expect(resolveOAuthResource('', expectedResource)).toBe(expectedResource);
  });

  it('accepts only the exact resource URI advertised by the server', () => {
    expect(resolveOAuthResource(expectedResource, expectedResource)).toBe(expectedResource);
    expect(resolveOAuthResource(`${expectedResource}/`, expectedResource)).toBeNull();
    expect(resolveOAuthResource('https://other.example/mcp', expectedResource)).toBeNull();
  });
});
