import { describe, expect, it, vi } from 'vitest';
import { executeMcpWriteAction } from '../write-actions';
import {
  MCP_PUBLIC_CONTENT_READ_TOOL_NAMES,
  MCP_PUBLIC_CONTENT_TOOLS,
  MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES,
  sanitizeBlogHtml,
} from '../public-content-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';

describe('MCP public content capabilities', () => {
  it('publishes closed tools for forms, links and blog operations', () => {
    expect(MCP_PUBLIC_CONTENT_READ_TOOL_NAMES).toContain('kifer_list_public_form_submissions');
    expect(MCP_PUBLIC_CONTENT_READ_TOOL_NAMES).toContain('kifer_get_public_links_page');
    expect(MCP_PUBLIC_CONTENT_READ_TOOL_NAMES).toContain('kifer_get_blog_post');
    expect(MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES).toContain('kifer_update_public_form');
    expect(MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES).toContain('kifer_reorder_public_links');
    expect(MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES).toContain('kifer_save_blog_post');
    expect(MCP_PUBLIC_CONTENT_TOOLS.every((tool) => tool.inputSchema?.additionalProperties === false)).toBe(true);
  });

  it('keeps safe editorial tags and strips unsafe attributes and executable URLs', () => {
    expect(sanitizeBlogHtml('<h2>Guia</h2><p><a href="https://example.com" target="_blank" onclick="alert(1)">Abrir</a></p>'))
      .toBe('<h2>Guia</h2><p><a href="https://example.com/" target="_blank" rel="noopener noreferrer">Abrir</a></p>');
    expect(sanitizeBlogHtml('<a href="jav&#x61;script:alert(1)">conteúdo</a>'))
      .toBe('<a>conteúdo</a>');
    expect(sanitizeBlogHtml('<script>alert(1)</script>')).toBeNull();
    expect(sanitizeBlogHtml('<iframe src="https://example.com"></iframe>')).toBeNull();
  });

  it('routes editorial writes through the safe audit summary without storing post content', async () => {
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert: insertAudit });
    const supabase = { from } as never;
    const privateContent = '<p>CPF 11122233344 - pessoa identificável</p>';

    const result = await executeMcpWriteAction({
      supabase,
      toolName: 'kifer_save_blog_post',
      arguments: { post: { content: privateContent } },
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(from).toHaveBeenCalledWith('mcp_action_audit_log');
    const audited = JSON.stringify(insertAudit.mock.calls[0]?.[0]);
    expect(audited).not.toContain(privateContent);
    expect(audited).not.toContain('11122233344');
    expect(audited).toContain('content_length');
  });
});
