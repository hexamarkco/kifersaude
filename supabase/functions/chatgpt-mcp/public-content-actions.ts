import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STEP_TYPES = new Set(['single_choice', 'multi_choice', 'short_text', 'contact']);
const FIELD_KEYS = new Set(['cidade', 'tipo_contratacao']);
const SAFE_HTML_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'blockquote', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'pre', 'code', 'span', 'a', 'img']);
const VOID_HTML_TAGS = new Set(['br', 'img']);
const MAX_BLOG_CONTENT = 200_000;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const hasUrlControlCharacters = (value: string) => [...value].some((character) => {
  const code = character.charCodeAt(0);
  return code <= 0x20 || code === 0x7f;
});
const removeUrlControlCharacters = (value: string) => [...value].filter((character) => {
  const code = character.charCodeAt(0);
  return code > 0x20 && code !== 0x7f;
}).join('');
const rawText = (value: unknown) => typeof value === 'string' ? value : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value: unknown) => UUID.test(text(value));
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const fail = (errorCode: string, message: string): McpWriteResult => ({ success: false, error_code: errorCode, message });

const FORM_FIELDS = {
  slug: { type: 'string', minLength: 2, maxLength: 80, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: ['string', 'null'], maxLength: 2000 },
  success_headline: { type: 'string', maxLength: 200 },
  success_message: { type: 'string', maxLength: 2000 },
  whatsapp_redirect: { type: 'boolean' },
  whatsapp_message_template: { type: ['string', 'null'], maxLength: 2000 },
  request_geolocation: { type: 'boolean' },
  is_published: { type: 'boolean' },
} as const;

const FORM_STEP_FIELDS = {
  step_type: { type: 'string', enum: ['single_choice', 'multi_choice', 'short_text', 'contact'] },
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: ['string', 'null'], maxLength: 2000 },
  placeholder: { type: ['string', 'null'], maxLength: 300 },
  is_required: { type: 'boolean' },
  field_key: { type: ['string', 'null'], enum: ['cidade', 'tipo_contratacao', null] },
  options: { type: 'array', maxItems: 50, items: { type: 'object', required: ['id', 'label'], additionalProperties: false, properties: { id: { type: 'string', minLength: 1, maxLength: 100 }, label: { type: 'string', minLength: 1, maxLength: 200 }, value: { type: 'string', maxLength: 200 } } } },
} as const;

const BLOG_FIELDS = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  slug: { type: 'string', minLength: 1, maxLength: 180, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
  excerpt: { type: 'string', minLength: 1, maxLength: 500 },
  content: { type: 'string', minLength: 1, maxLength: MAX_BLOG_CONTENT },
  cover_image_url: { type: 'string', maxLength: 2000 },
  category: { type: 'string', minLength: 1, maxLength: 100 },
  read_time: { type: 'string', minLength: 1, maxLength: 40 },
  published: { type: 'boolean' },
  meta_title: { type: 'string', maxLength: 200 },
  meta_description: { type: 'string', maxLength: 500 },
} as const;

const pageProperties = {
  page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 },
  page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
} as const;

const idProperty = (description: string) => ({ type: 'string', format: 'uuid', description });

export const MCP_PUBLIC_CONTENT_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_public_forms', description: 'Lista formulários de captação com paginação e metadados, sem respostas pessoais.', inputSchema: { type: 'object', additionalProperties: false, properties: pageProperties }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_public_form', description: 'Consulta configurações e etapas de um formulário, sem respostas de contatos.', inputSchema: { type: 'object', required: ['form_id'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.') } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_list_public_form_submissions', description: 'Lista respostas recentes de um formulário para tratamento comercial. Exibe nome, telefone, e-mail e respostas para administradores ativos; omite localização precisa e user agent.', inputSchema: { type: 'object', required: ['form_id'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.'), ...pageProperties } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_create_public_form', description: 'Cria formulário não publicado e prepara automaticamente a etapa fixa de contato no fim. Não cria leads até alguém preencher o formulário publicado.', inputSchema: { type: 'object', required: ['slug', 'title'], additionalProperties: false, properties: { slug: FORM_FIELDS.slug, title: FORM_FIELDS.title, description: FORM_FIELDS.description } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_update_public_form', description: 'Atualiza configurações usando expected_updated_at. Para publicar, o formulário precisa ter exatamente uma etapa de contato e ela deve ser a última.', inputSchema: { type: 'object', required: ['form_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.'), expected_updated_at: { type: 'string', format: 'date-time' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: FORM_FIELDS } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_public_form', description: 'Exclui formulário e etapas. Bloqueia enquanto existirem respostas; despublique antes da exclusão. A ação é irreversível.', inputSchema: { type: 'object', required: ['form_id', 'expected_updated_at'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.'), expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_create_public_form_step', description: 'Adiciona pergunta não final a um formulário não publicado. A etapa de contato é gerenciada separadamente e permanece fixa no fim.', inputSchema: { type: 'object', required: ['form_id', 'step_type', 'title'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.'), step_type: { type: 'string', enum: ['single_choice', 'multi_choice', 'short_text'] }, title: FORM_STEP_FIELDS.title, description: FORM_STEP_FIELDS.description, placeholder: FORM_STEP_FIELDS.placeholder, is_required: FORM_STEP_FIELDS.is_required, field_key: FORM_STEP_FIELDS.field_key, options: FORM_STEP_FIELDS.options } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_update_public_form_step', description: 'Edita pergunta existente. Na etapa fixa de contato, somente título e descrição podem mudar; outras etapas não podem virar contato.', inputSchema: { type: 'object', required: ['step_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { step_id: idProperty('UUID da etapa.'), expected_updated_at: { type: 'string', format: 'date-time' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: FORM_STEP_FIELDS } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_public_form_step', description: 'Remove pergunta de formulário não publicado. A etapa fixa de contato não pode ser excluída.', inputSchema: { type: 'object', required: ['step_id', 'expected_updated_at'], additionalProperties: false, properties: { step_id: idProperty('UUID da etapa.'), expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_reorder_public_form_steps', description: 'Reordena todas as etapas de formulário não publicado; cada ID deve aparecer uma vez e a etapa de contato fica por último.', inputSchema: { type: 'object', required: ['form_id', 'step_ids'], additionalProperties: false, properties: { form_id: idProperty('UUID do formulário.'), step_ids: { type: 'array', minItems: 1, maxItems: 50, items: idProperty('UUID da etapa.') } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_get_public_links_page', description: 'Consulta a página pública de links, configuração, URLs, estado e contagem de cliques.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  {
    name: 'kifer_update_public_links_page',
    description: 'Atualiza metadados e publicação da página de links com controle de versão.',
    inputSchema: {
      type: 'object', required: ['page_id', 'expected_updated_at', 'changes'], additionalProperties: false,
      properties: {
        page_id: idProperty('UUID da página.'), expected_updated_at: { type: 'string', format: 'date-time' },
        changes: {
          type: 'object', minProperties: 1, additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 }, subtitle: { type: ['string', 'null'], maxLength: 300 },
            bio: { type: ['string', 'null'], maxLength: 2000 }, avatar_url: { type: ['string', 'null'], maxLength: 2000 },
            is_verified: { type: 'boolean' }, is_published: { type: 'boolean' },
          },
        },
      },
    },
    annotations: { readOnlyHint: false },
  },
  { name: 'kifer_create_public_link', description: 'Cria link público ativo. Aceita somente URLs https, mailto e tel, sem esquemas executáveis.', inputSchema: { type: 'object', required: ['title', 'url', 'icon'], additionalProperties: false, properties: { title: { type: 'string', minLength: 1, maxLength: 160 }, url: { type: 'string', minLength: 1, maxLength: 2000 }, icon: { type: 'string', minLength: 1, maxLength: 80 }, is_active: { type: 'boolean' }, position: { type: 'integer', minimum: 0, maximum: 10000 } } }, annotations: { readOnlyHint: false } },
  {
    name: 'kifer_update_public_link',
    description: 'Atualiza um link com controle de versão; URLs limitadas a https, mailto e tel.',
    inputSchema: {
      type: 'object', required: ['link_id', 'expected_updated_at', 'changes'], additionalProperties: false,
      properties: {
        link_id: idProperty('UUID do link.'), expected_updated_at: { type: 'string', format: 'date-time' },
        changes: {
          type: 'object', minProperties: 1, additionalProperties: false,
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 160 }, url: { type: 'string', minLength: 1, maxLength: 2000 },
            icon: { type: 'string', minLength: 1, maxLength: 80 }, is_active: { type: 'boolean' },
            position: { type: 'integer', minimum: 0, maximum: 10000 },
          },
        },
      },
    },
    annotations: { readOnlyHint: false },
  },
  { name: 'kifer_delete_public_link', description: 'Exclui um link público com controle de versão. A ação é irreversível.', inputSchema: { type: 'object', required: ['link_id', 'expected_updated_at'], additionalProperties: false, properties: { link_id: idProperty('UUID do link.'), expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_reorder_public_links', description: 'Define a ordem completa dos links ativos/inativos sem alterar as demais configurações.', inputSchema: { type: 'object', required: ['link_ids'], additionalProperties: false, properties: { link_ids: { type: 'array', maxItems: 200, items: idProperty('UUID do link.') } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_list_blog_posts', description: 'Lista posts e metadados editoriais, sem carregar o HTML completo.', inputSchema: { type: 'object', additionalProperties: false, properties: { ...pageProperties, published: { type: 'boolean' } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_get_blog_post', description: 'Consulta artigo e metadados; HTML de saída é filtrado para tags editoriais seguras.', inputSchema: { type: 'object', required: ['post_id'], additionalProperties: false, properties: { post_id: idProperty('UUID do post.') } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_save_blog_post', description: 'Cria ou edita post. HTML passa por allowlist de tags/atributos e URLs; publicação ajusta published_at automaticamente. Edições exigem expected_updated_at.', inputSchema: { type: 'object', required: ['post'], additionalProperties: false, properties: { post_id: idProperty('UUID em edição; omita para criar.'), expected_updated_at: { type: 'string', format: 'date-time' }, post: { type: 'object', additionalProperties: false, properties: BLOG_FIELDS, required: ['title', 'slug', 'excerpt', 'content', 'category', 'read_time'] } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_set_blog_post_published', description: 'Publica ou despublica um post com controle de versão; publicação muda a visibilidade no site.', inputSchema: { type: 'object', required: ['post_id', 'published', 'expected_updated_at'], additionalProperties: false, properties: { post_id: idProperty('UUID do post.'), published: { type: 'boolean' }, expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_blog_post', description: 'Exclui um post do blog com controle de versão. A ação é irreversível.', inputSchema: { type: 'object', required: ['post_id', 'expected_updated_at'], additionalProperties: false, properties: { post_id: idProperty('UUID do post.'), expected_updated_at: { type: 'string', format: 'date-time' } } }, annotations: { readOnlyHint: false, destructiveHint: true } },
] as const;

export const MCP_PUBLIC_CONTENT_READ_TOOL_NAMES = MCP_PUBLIC_CONTENT_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name);
export const MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES = MCP_PUBLIC_CONTENT_TOOLS.filter((tool) => tool.annotations?.readOnlyHint === false).map((tool) => tool.name);

const escapeHtmlAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeUrlEntities = (value: string) => value
  .replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_match, hex: string | undefined, decimal: string | undefined) => {
    const codePoint = Number.parseInt(hex ?? decimal ?? '', hex ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '';
  })
  .replace(/&colon;?/gi, ':').replace(/&tab;?/gi, '\t').replace(/&newline;?/gi, '\n');

const safeUrl = (raw: string, image = false): string | null => {
  const value = decodeUrlEntities(raw).trim();
  const compact = removeUrlControlCharacters(value).toLowerCase();
  if (compact.startsWith('javascript:') || compact.startsWith('data:') || compact.startsWith('vbscript:')) return null;
  try {
    const parsed = new URL(value);
    if (image) return parsed.protocol === 'https:' && Boolean(parsed.hostname) ? parsed.toString() : null;
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const parseHtmlTag = (token: string) => {
  const match = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9-]*)([\s\S]*?)>$/i);
  if (!match || token.startsWith('<!') || token.startsWith('<?')) return null;
  const [, closingMark, name, rawAttributes] = match;
  const closing = closingMark === '/';
  if (closing) return /^\s*$/.test(rawAttributes) ? { name: name.toLowerCase(), closing, attributes: [] as [string, string][], selfClosing: false } : null;
  const attributes: [string, string][] = [];
  const attributeSource = rawAttributes.replace(/\/\s*$/, '');
  let cursor = 0;
  const attributePattern = /\s+([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/iy;
  while (cursor < attributeSource.length) {
    if (/^\s*$/.test(attributeSource.slice(cursor))) break;
    attributePattern.lastIndex = cursor;
    const attributeMatch = attributePattern.exec(attributeSource);
    if (!attributeMatch) return null;
    attributes.push([attributeMatch[1].toLowerCase(), attributeMatch[2] ?? attributeMatch[3] ?? '']);
    cursor = attributePattern.lastIndex;
  }
  return { name: name.toLowerCase(), closing, attributes, selfClosing: /\/\s*$/.test(rawAttributes) };
};

export const sanitizeBlogHtml = (input: string): string | null => {
  if (input.length > MAX_BLOG_CONTENT) return null;
  const output: string[] = [];
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf('<', cursor);
    if (open < 0) {
      output.push(input.slice(cursor));
      break;
    }
    output.push(input.slice(cursor, open));
    let quote = '';
    let end = open + 1;
    for (; end < input.length; end += 1) {
      const char = input[end];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end >= input.length || quote) return null;
    const tag = parseHtmlTag(input.slice(open, end + 1));
    if (!tag || !SAFE_HTML_TAGS.has(tag.name)) return null;
    cursor = end + 1;
    if (tag.closing) {
      if (!VOID_HTML_TAGS.has(tag.name)) output.push(`</${tag.name}>`);
      continue;
    }
    const attrs = new Map(tag.attributes);
    if (tag.name === 'img') {
      const src = safeUrl(attrs.get('src') ?? '', true);
      if (!src) continue;
      const alt = attrs.get('alt');
      const title = attrs.get('title');
      const width = attrs.get('width');
      const height = attrs.get('height');
      output.push(`<img src="${escapeHtmlAttribute(src)}"${alt === undefined ? '' : ` alt="${escapeHtmlAttribute(alt)}"`}${title === undefined ? '' : ` title="${escapeHtmlAttribute(title)}"`}${width && /^\d{1,4}$/.test(width) ? ` width="${width}"` : ''}${height && /^\d{1,4}$/.test(height) ? ` height="${height}"` : ''}>`);
      continue;
    }
    if (tag.name === 'a') {
      const href = attrs.has('href') ? safeUrl(attrs.get('href') ?? '') : null;
      const title = attrs.get('title');
      const target = attrs.get('target');
      output.push(`<a${href ? ` href="${escapeHtmlAttribute(href)}"` : ''}${title === undefined ? '' : ` title="${escapeHtmlAttribute(title)}"`}${target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : ''}>`);
      continue;
    }
    output.push(`<${tag.name}>`);
  }
  return output.join('');
};

const pageBounds = (args: Record<string, unknown>) => {
  const page = Number(args.page ?? 1);
  const pageSize = Number(args.page_size ?? 20);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) return null;
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
};

const safeDbError = (code: string | undefined) => {
  if (code === '23505') return fail('DUPLICATE', 'Já existe um registro com esses dados.');
  if (code === '23503') return fail('CONFLICT', 'O registro possui vínculos que impedem esta operação.');
  return fail('DATABASE_ERROR', 'Não foi possível concluir a operação.');
};

async function updateVersioned(
  supabase: SupabaseClient,
  table: 'public_forms' | 'public_form_steps' | 'public_link_page_settings' | 'public_link_items' | 'blog_posts',
  id: string,
  expectedUpdatedAt: string,
  changes: Record<string, unknown>,
) {
  const { data, error } = await supabase.from(table).update(changes).eq('id', id).eq('updated_at', expectedUpdatedAt).select('*').maybeSingle();
  if (error) return { result: safeDbError(error.code), data: null };
  if (!data) return { result: fail('CONFLICT', 'O registro mudou desde a última leitura ou não existe. Consulte-o novamente.'), data: null };
  return { result: null, data };
}

const validStepOptions = (value: unknown): value is { id: string; label: string; value?: string }[] => Array.isArray(value)
  && value.length <= 50
  && value.every((item) => isRecord(item) && typeof item.id === 'string' && item.id.trim().length > 0 && item.id.length <= 100
    && typeof item.label === 'string' && item.label.trim().length > 0 && item.label.length <= 200
    && (item.value === undefined || (typeof item.value === 'string' && item.value.length <= 200)));

const validFormChanges = (changes: Record<string, unknown>) => {
  const allowed = new Set(Object.keys(FORM_FIELDS));
  if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !allowed.has(key))) return false;
  if (changes.slug !== undefined && (typeof changes.slug !== 'string' || !SLUG.test(changes.slug) || changes.slug.length > 80)) return false;
  if (changes.title !== undefined && (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.length > 200)) return false;
  for (const key of ['description', 'success_message', 'success_headline', 'whatsapp_message_template'] as const) {
    const value = changes[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > (key === 'description' || key === 'success_message' || key === 'whatsapp_message_template' ? 2000 : 200))) return false;
  }
  return ['whatsapp_redirect', 'request_geolocation', 'is_published'].every((key) => changes[key] === undefined || typeof changes[key] === 'boolean');
};

const validStepChanges = (changes: Record<string, unknown>) => {
  const allowed = new Set(Object.keys(FORM_STEP_FIELDS));
  if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !allowed.has(key))) return false;
  if (changes.step_type !== undefined && !STEP_TYPES.has(text(changes.step_type))) return false;
  if (changes.title !== undefined && (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.length > 200)) return false;
  if (['description', 'placeholder'].some((key) => changes[key] !== undefined && changes[key] !== null && typeof changes[key] !== 'string')) return false;
  if (changes.is_required !== undefined && typeof changes.is_required !== 'boolean') return false;
  if (changes.field_key !== undefined && changes.field_key !== null && !FIELD_KEYS.has(text(changes.field_key))) return false;
  if (changes.options !== undefined && !validStepOptions(changes.options)) return false;
  if (changes.step_type === 'contact' && Object.keys(changes).some((key) => !['step_type', 'title', 'description'].includes(key))) return false;
  return true;
};

const safePublicLinkUrl = (value: unknown) => {
  const raw = text(value);
  try {
    const parsed = new URL(raw);
    return ['https:', 'mailto:', 'tel:'].includes(parsed.protocol) && !hasUrlControlCharacters(raw) ? parsed.toString() : null;
  } catch { return null; }
};

const safePublicImageUrl = (value: unknown) => {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) ? parsed.toString() : null;
  } catch { return null; }
};

const audit = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, actionType: string, request: Record<string, unknown>, result: McpWriteResult) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: actionType,
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: request,
    result_payload: { success: result.success, error_code: result.error_code ?? null },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar ação de conteúdo:', error.message);
};

async function readForms(supabase: SupabaseClient, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> {
  if (toolName === 'kifer_list_public_forms') {
    const bounds = pageBounds(args);
    if (!bounds) return fail('INVALID_INPUT', 'A paginação informada é inválida.');
    const { data, error, count } = await supabase.from('public_forms').select('id,slug,title,description,is_published,submission_count,created_at,updated_at,success_headline,success_message,whatsapp_redirect,request_geolocation', { count: 'exact' }).order('created_at', { ascending: false }).range(bounds.from, bounds.to);
    if (error) return safeDbError(error.code);
    return { success: true, forms: data ?? [], page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
  }
  if (toolName === 'kifer_get_public_form') {
    if (!isUuid(args.form_id)) return fail('INVALID_INPUT', 'form_id deve ser UUID.');
    const { data: form, error } = await supabase.from('public_forms').select('*').eq('id', text(args.form_id)).maybeSingle();
    if (error) return safeDbError(error.code);
    if (!form) return fail('NOT_FOUND', 'Formulário não encontrado.');
    const { data: steps, error: stepsError } = await supabase.from('public_form_steps').select('*').eq('form_id', form.id).order('position', { ascending: true });
    if (stepsError) return safeDbError(stepsError.code);
    return { success: true, form, steps: steps ?? [] };
  }
  if (toolName === 'kifer_list_public_form_submissions') {
    if (!isUuid(args.form_id)) return fail('INVALID_INPUT', 'form_id deve ser UUID.');
    const bounds = pageBounds(args);
    if (!bounds) return fail('INVALID_INPUT', 'A paginação informada é inválida.');
    const { data, error, count } = await supabase.from('public_form_submissions').select('id,form_id,lead_id,answers,contact_name,contact_phone,contact_email,geo_permission,created_at', { count: 'exact' }).eq('form_id', text(args.form_id)).order('created_at', { ascending: false }).range(bounds.from, bounds.to);
    if (error) return safeDbError(error.code);
    return { success: true, submissions: data ?? [], page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
  }
  return null;
}

async function readLinksAndBlog(supabase: SupabaseClient, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> {
  if (toolName === 'kifer_get_public_links_page') {
    const [settingsResult, itemsResult] = await Promise.all([
      supabase.from('public_link_page_settings').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('public_link_items').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
    ]);
    if (settingsResult.error || itemsResult.error) return safeDbError((settingsResult.error ?? itemsResult.error)?.code);
    return { success: true, settings: settingsResult.data, links: itemsResult.data ?? [] };
  }
  if (toolName === 'kifer_list_blog_posts') {
    const bounds = pageBounds(args);
    if (!bounds) return fail('INVALID_INPUT', 'A paginação informada é inválida.');
    let query = supabase.from('blog_posts').select('id,title,slug,excerpt,cover_image_url,category,read_time,author_id,published,published_at,created_at,updated_at,views_count,meta_title,meta_description', { count: 'exact' });
    if (typeof args.published === 'boolean') query = query.eq('published', args.published);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(bounds.from, bounds.to);
    if (error) return safeDbError(error.code);
    return { success: true, posts: data ?? [], page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
  }
  if (toolName === 'kifer_get_blog_post') {
    if (!isUuid(args.post_id)) return fail('INVALID_INPUT', 'post_id deve ser UUID.');
    const { data, error } = await supabase.from('blog_posts').select('*').eq('id', text(args.post_id)).maybeSingle();
    if (error) return safeDbError(error.code);
    if (!data) return fail('NOT_FOUND', 'Post não encontrado.');
    const sanitized = sanitizeBlogHtml(rawText(data.content));
    if (sanitized === null) return fail('CONTENT_UNSAFE', 'O post contém HTML fora da allowlist segura.');
    return { success: true, post: { ...data, content: sanitized } };
  }
  return null;
}

async function writeForms(supabase: SupabaseClient, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> {
  if (toolName === 'kifer_create_public_form') {
    const slug = text(args.slug);
    const title = text(args.title);
    if (!SLUG.test(slug) || slug.length < 2 || slug.length > 80 || !title || title.length > 200) return fail('INVALID_INPUT', 'Informe título e slug em formato válido.');
    const description = args.description === undefined || args.description === null ? null : typeof args.description === 'string' && args.description.length <= 2000 ? text(args.description) || null : undefined;
    if (description === undefined) return fail('INVALID_INPUT', 'description deve ter até 2000 caracteres.');
    const payload = { slug, title, description, is_published: false };
    const { data: form, error } = await supabase.from('public_forms').insert(payload).select('*').single();
    if (error || !form) return safeDbError(error?.code);
    const { data: contactStep, error: stepError } = await supabase.from('public_form_steps').insert({ form_id: form.id, position: 0, step_type: 'contact', title: 'Como podemos entrar em contato?', is_required: true, options: [] }).select('*').single();
    if (stepError || !contactStep) {
      await supabase.from('public_forms').delete().eq('id', form.id);
      return safeDbError(stepError?.code);
    }
    return { success: true, form, contact_step: contactStep };
  }
  if (toolName === 'kifer_update_public_form') {
    const changes = args.changes;
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.form_id) || !expected || !isRecord(changes) || !validFormChanges(changes)) return fail('INVALID_INPUT', 'Identificadores, versão ou alterações inválidos.');
    if (changes.whatsapp_redirect === false && changes.whatsapp_message_template === undefined) changes.whatsapp_message_template = null;
    if (changes.is_published === true) {
      const { data: steps, error } = await supabase.from('public_form_steps').select('step_type,position').eq('form_id', text(args.form_id)).order('position', { ascending: true });
      if (error) return safeDbError(error.code);
      if (!steps?.length || steps.filter((step) => step.step_type === 'contact').length !== 1 || steps.at(-1)?.step_type !== 'contact') return fail('FORM_INCOMPLETE', 'O formulário precisa ter uma única etapa de contato no fim antes de publicar.');
    }
    const { result, data } = await updateVersioned(supabase, 'public_forms', text(args.form_id), expected, changes);
    return result ?? { success: true, form: data };
  }
  if (toolName === 'kifer_delete_public_form') {
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.form_id) || !expected) return fail('INVALID_INPUT', 'Identificador ou versão inválidos.');
    const { data: current, error: readError } = await supabase.from('public_forms').select('id,is_published,submission_count,updated_at').eq('id', text(args.form_id)).maybeSingle();
    if (readError) return safeDbError(readError.code);
    if (!current) return fail('NOT_FOUND', 'Formulário não encontrado.');
    if (current.updated_at !== expected) return fail('CONFLICT', 'O formulário mudou desde a última leitura. Consulte-o novamente.');
    if (current.is_published || Number(current.submission_count) > 0) return fail('NOT_ALLOWED', 'Despublique o formulário. Respostas existentes impedem exclusão pelo MCP.');
    const { error } = await supabase.from('public_forms').delete().eq('id', current.id).eq('updated_at', expected);
    return error ? safeDbError(error.code) : { success: true, form_id: current.id, deleted: true };
  }
  if (toolName === 'kifer_create_public_form_step') {
    const formId = text(args.form_id);
    const stepType = text(args.step_type);
    const title = text(args.title);
    if (!isUuid(formId) || !['single_choice', 'multi_choice', 'short_text'].includes(stepType) || !title || title.length > 200) return fail('INVALID_INPUT', 'Os dados da pergunta são inválidos.');
    if (args.field_key !== undefined && args.field_key !== null && !FIELD_KEYS.has(text(args.field_key))) return fail('INVALID_INPUT', 'field_key não permitido.');
    if (args.options !== undefined && !validStepOptions(args.options)) return fail('INVALID_INPUT', 'options deve conter opções válidas.');
    if (['single_choice', 'multi_choice'].includes(stepType) && (!Array.isArray(args.options) || args.options.length < 1)) return fail('INVALID_INPUT', 'Perguntas de escolha exigem ao menos uma opção.');
    const { data: form, error: formError } = await supabase.from('public_forms').select('id,is_published').eq('id', formId).maybeSingle();
    if (formError) return safeDbError(formError.code);
    if (!form) return fail('NOT_FOUND', 'Formulário não encontrado.');
    if (form.is_published) return fail('NOT_ALLOWED', 'Despublique o formulário antes de editar as etapas.');
    const { data: steps, error: stepsError } = await supabase.from('public_form_steps').select('position').eq('form_id', formId).order('position', { ascending: false }).limit(1);
    if (stepsError) return safeDbError(stepsError.code);
    const payload = { form_id: formId, position: Number(steps?.[0]?.position ?? -1) + 1, step_type: stepType, title, description: text(args.description) || null, placeholder: text(args.placeholder) || null, is_required: typeof args.is_required === 'boolean' ? args.is_required : true, field_key: args.field_key ?? null, options: args.options ?? [] };
    const { data, error } = await supabase.from('public_form_steps').insert(payload).select('*').single();
    return error || !data ? safeDbError(error?.code) : { success: true, step: data };
  }
  if (toolName === 'kifer_update_public_form_step') {
    const expected = validDate(args.expected_updated_at);
    const changes = args.changes;
    if (!isUuid(args.step_id) || !expected || !isRecord(changes) || !validStepChanges(changes)) return fail('INVALID_INPUT', 'Identificadores, versão ou alterações inválidos.');
    const { data: step, error } = await supabase.from('public_form_steps').select('id,form_id,step_type,updated_at').eq('id', text(args.step_id)).maybeSingle();
    if (error) return safeDbError(error.code);
    if (!step) return fail('NOT_FOUND', 'Etapa não encontrada.');
    if (step.step_type === 'contact' && Object.keys(changes).some((key) => !['title', 'description'].includes(key))) return fail('NOT_ALLOWED', 'A etapa fixa de contato só permite alterar título e descrição.');
    if (step.step_type !== 'contact' && changes.step_type === 'contact') return fail('NOT_ALLOWED', 'Uma pergunta não pode ser convertida na etapa fixa de contato.');
    const { data: form, error: formError } = await supabase.from('public_forms').select('is_published').eq('id', step.form_id).maybeSingle();
    if (formError) return safeDbError(formError.code);
    if (form?.is_published) return fail('NOT_ALLOWED', 'Despublique o formulário antes de editar as etapas.');
    const { result, data } = await updateVersioned(supabase, 'public_form_steps', step.id, expected, changes);
    return result ?? { success: true, step: data };
  }
  if (toolName === 'kifer_delete_public_form_step') {
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.step_id) || !expected) return fail('INVALID_INPUT', 'Identificador ou versão inválidos.');
    const { data: step, error } = await supabase.from('public_form_steps').select('id,form_id,step_type,updated_at').eq('id', text(args.step_id)).maybeSingle();
    if (error) return safeDbError(error.code);
    if (!step) return fail('NOT_FOUND', 'Etapa não encontrada.');
    if (step.step_type === 'contact') return fail('NOT_ALLOWED', 'A etapa fixa de contato não pode ser removida.');
    if (step.updated_at !== expected) return fail('CONFLICT', 'A etapa mudou desde a última leitura. Consulte-a novamente.');
    const { data: form, error: formError } = await supabase.from('public_forms').select('is_published').eq('id', step.form_id).maybeSingle();
    if (formError) return safeDbError(formError.code);
    if (form?.is_published) return fail('NOT_ALLOWED', 'Despublique o formulário antes de editar as etapas.');
    const { error: deleteError } = await supabase.from('public_form_steps').delete().eq('id', step.id).eq('updated_at', expected);
    return deleteError ? safeDbError(deleteError.code) : { success: true, step_id: step.id, deleted: true };
  }
  if (toolName === 'kifer_reorder_public_form_steps') {
    const formId = text(args.form_id);
    const stepIds = args.step_ids;
    if (!isUuid(formId) || !Array.isArray(stepIds) || stepIds.length < 1 || stepIds.length > 50 || !stepIds.every(isUuid) || new Set(stepIds).size !== stepIds.length) return fail('INVALID_INPUT', 'Informe todos os IDs uma única vez.');
    const { data: form, error: formError } = await supabase.from('public_forms').select('is_published').eq('id', formId).maybeSingle();
    if (formError) return safeDbError(formError.code);
    if (!form) return fail('NOT_FOUND', 'Formulário não encontrado.');
    if (form.is_published) return fail('NOT_ALLOWED', 'Despublique o formulário antes de reordenar as etapas.');
    const { data: steps, error } = await supabase.from('public_form_steps').select('id,step_type').eq('form_id', formId);
    if (error) return safeDbError(error.code);
    if (!steps || steps.length !== stepIds.length || steps.some((step) => !stepIds.includes(step.id))) return fail('INVALID_INPUT', 'step_ids deve conter exatamente todas as etapas deste formulário.');
    const contactIndex = steps.find((step) => step.step_type === 'contact') ? stepIds.indexOf(steps.find((step) => step.step_type === 'contact')!.id) : -1;
    if (steps.filter((step) => step.step_type === 'contact').length !== 1 || contactIndex !== stepIds.length - 1) return fail('INVALID_INPUT', 'A etapa de contato deve ser única e ficar por último.');
    for (const [position, stepId] of stepIds.entries()) {
      const { error: updateError } = await supabase.from('public_form_steps').update({ position }).eq('id', stepId).eq('form_id', formId);
      if (updateError) return safeDbError(updateError.code);
    }
    return { success: true, form_id: formId, ordered_step_ids: stepIds };
  }
  return null;
}

async function writeLinksAndBlog(supabase: SupabaseClient, toolName: string, args: Record<string, unknown>): Promise<McpWriteResult | null> {
  if (toolName === 'kifer_update_public_links_page') {
    const expected = validDate(args.expected_updated_at);
    const changes = args.changes;
    if (!isUuid(args.page_id) || !expected || !isRecord(changes) || Object.keys(changes).length === 0) return fail('INVALID_INPUT', 'Identificadores, versão ou alterações inválidos.');
    const allowed = new Set(['title', 'subtitle', 'bio', 'avatar_url', 'is_verified', 'is_published']);
    if (Object.keys(changes).some((key) => !allowed.has(key)) || (changes.title !== undefined && (typeof changes.title !== 'string' || !text(changes.title) || changes.title.length > 200)) || ['subtitle', 'bio'].some((key) => changes[key] !== undefined && changes[key] !== null && typeof changes[key] !== 'string') || ['is_verified', 'is_published'].some((key) => changes[key] !== undefined && typeof changes[key] !== 'boolean')) return fail('INVALID_INPUT', 'As alterações da página contêm campos inválidos.');
    if (changes.avatar_url !== undefined) {
      const imageUrl = changes.avatar_url === null ? '' : safePublicImageUrl(changes.avatar_url);
      if (imageUrl === null) return fail('INVALID_INPUT', 'avatar_url precisa ser HTTPS.');
      changes.avatar_url = imageUrl || null;
    }
    const { result, data } = await updateVersioned(supabase, 'public_link_page_settings', text(args.page_id), expected, changes);
    return result ?? { success: true, settings: data };
  }
  if (toolName === 'kifer_create_public_link') {
    const title = text(args.title);
    const url = safePublicLinkUrl(args.url);
    const icon = text(args.icon);
    if (!title || title.length > 160 || !url || !icon || icon.length > 80 || (args.position !== undefined && (!Number.isInteger(args.position) || Number(args.position) < 0 || Number(args.position) > 10000)) || (args.is_active !== undefined && typeof args.is_active !== 'boolean')) return fail('INVALID_INPUT', 'Os dados do link são inválidos.');
    const { data, error } = await supabase.from('public_link_items').insert({ title, url, icon, is_active: args.is_active !== false, position: args.position ?? 0 }).select('*').single();
    return error || !data ? safeDbError(error?.code) : { success: true, link: data };
  }
  if (toolName === 'kifer_update_public_link') {
    const expected = validDate(args.expected_updated_at);
    const changes = args.changes;
    if (!isUuid(args.link_id) || !expected || !isRecord(changes) || Object.keys(changes).length === 0) return fail('INVALID_INPUT', 'Identificadores, versão ou alterações inválidos.');
    const allowed = new Set(['title', 'url', 'icon', 'is_active', 'position']);
    if (Object.keys(changes).some((key) => !allowed.has(key)) || (changes.title !== undefined && (typeof changes.title !== 'string' || !text(changes.title) || changes.title.length > 160)) || (changes.icon !== undefined && (typeof changes.icon !== 'string' || !text(changes.icon) || changes.icon.length > 80)) || (changes.position !== undefined && (!Number.isInteger(changes.position) || Number(changes.position) < 0 || Number(changes.position) > 10000)) || (changes.is_active !== undefined && typeof changes.is_active !== 'boolean')) return fail('INVALID_INPUT', 'As alterações do link são inválidas.');
    if (changes.url !== undefined) {
      const url = safePublicLinkUrl(changes.url);
      if (!url) return fail('INVALID_INPUT', 'URL precisa usar https, mailto ou tel.');
      changes.url = url;
    }
    const { result, data } = await updateVersioned(supabase, 'public_link_items', text(args.link_id), expected, changes);
    return result ?? { success: true, link: data };
  }
  if (toolName === 'kifer_delete_public_link') {
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.link_id) || !expected) return fail('INVALID_INPUT', 'Identificador ou versão inválidos.');
    const { data, error } = await supabase.from('public_link_items').delete().eq('id', text(args.link_id)).eq('updated_at', expected).select('id').maybeSingle();
    if (error) return safeDbError(error.code);
    return data ? { success: true, link_id: data.id, deleted: true } : fail('CONFLICT', 'O link mudou desde a última leitura ou não existe.');
  }
  if (toolName === 'kifer_reorder_public_links') {
    const ids = args.link_ids;
    if (!Array.isArray(ids) || ids.length > 200 || !ids.every(isUuid) || new Set(ids).size !== ids.length) return fail('INVALID_INPUT', 'link_ids deve conter UUIDs únicos.');
    const { data, error } = await supabase.from('public_link_items').select('id');
    if (error) return safeDbError(error.code);
    if (!data || data.length !== ids.length || data.some((item) => !ids.includes(item.id))) return fail('INVALID_INPUT', 'link_ids deve conter exatamente todos os links.');
    for (const [position, id] of ids.entries()) {
      const { error: updateError } = await supabase.from('public_link_items').update({ position }).eq('id', id);
      if (updateError) return safeDbError(updateError.code);
    }
    return { success: true, ordered_link_ids: ids };
  }
  if (toolName === 'kifer_save_blog_post') {
    const post = args.post;
    const postId = text(args.post_id);
    const expected = validDate(args.expected_updated_at);
    if (!isRecord(post) || (postId && !isUuid(postId)) || (postId && !expected)) return fail('INVALID_INPUT', 'Dados de post ou versão inválidos.');
    const title = text(post.title);
    const slug = text(post.slug);
    const excerpt = rawText(post.excerpt).trim();
    const content = rawText(post.content);
    const category = text(post.category);
    const readTime = text(post.read_time);
    if (!title || title.length > 200 || !SLUG.test(slug) || slug.length > 180 || !excerpt || excerpt.length > 500 || !content || content.length > MAX_BLOG_CONTENT || !category || category.length > 100 || !readTime || readTime.length > 40) return fail('INVALID_INPUT', 'Os campos obrigatórios do post são inválidos.');
    const sanitizedContent = sanitizeBlogHtml(content);
    if (sanitizedContent === null || !sanitizedContent.trim()) return fail('CONTENT_UNSAFE', 'O conteúdo HTML contém tags, atributos ou formato fora da allowlist editorial.');
    const coverImage = safePublicImageUrl(post.cover_image_url);
    if (coverImage === null) return fail('INVALID_INPUT', 'cover_image_url precisa ser HTTPS.');
    if (post.published !== undefined && typeof post.published !== 'boolean') return fail('INVALID_INPUT', 'published deve ser booleano.');
    if (post.meta_title !== undefined && typeof post.meta_title !== 'string') return fail('INVALID_INPUT', 'meta_title deve ser texto.');
    if (post.meta_description !== undefined && typeof post.meta_description !== 'string') return fail('INVALID_INPUT', 'meta_description deve ser texto.');
    const published = post.published === true;
    const payload = { title, slug, excerpt, content: sanitizedContent, cover_image_url: coverImage || null, category, read_time: readTime, published, published_at: published ? new Date().toISOString() : null, meta_title: text(post.meta_title) || title, meta_description: text(post.meta_description) || excerpt, ...(!postId ? { author_id: actor.actorId } : {}) };
    if (postId) {
      const { result, data } = await updateVersioned(supabase, 'blog_posts', postId, expected!, payload);
      return result ?? { success: true, post_id: postId, updated_at: data.updated_at, published: data.published, content_sanitized: sanitizedContent !== content };
    }
    const { data, error } = await supabase.from('blog_posts').insert(payload).select('id,slug,title,published,published_at,updated_at').single();
    return error || !data ? safeDbError(error?.code) : { success: true, post: data, content_sanitized: sanitizedContent !== content };
  }
  if (toolName === 'kifer_set_blog_post_published') {
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.post_id) || !expected || typeof args.published !== 'boolean') return fail('INVALID_INPUT', 'Identificador, versão ou estado inválidos.');
    const { result, data } = await updateVersioned(supabase, 'blog_posts', text(args.post_id), expected, { published: args.published, published_at: args.published ? new Date().toISOString() : null });
    return result ?? { success: true, post_id: data.id, published: data.published, published_at: data.published_at, updated_at: data.updated_at };
  }
  if (toolName === 'kifer_delete_blog_post') {
    const expected = validDate(args.expected_updated_at);
    if (!isUuid(args.post_id) || !expected) return fail('INVALID_INPUT', 'Identificador ou versão inválidos.');
    const { error } = await supabase.from('blog_posts').delete().eq('id', text(args.post_id)).eq('updated_at', expected);
    return error ? safeDbError(error.code) : { success: true, post_id: text(args.post_id), deleted: true };
  }
  return null;
}

export async function executeMcpPublicContentAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Record<string, unknown>;
  actor: McpWriteActor;
}): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  let result: McpWriteResult | null;
  try {
    result = await readForms(supabase, toolName, args) ?? await readLinksAndBlog(supabase, toolName, args);
    if (result === null) result = await writeForms(supabase, toolName, args) ?? await writeLinksAndBlog(supabase, toolName, args);
  } catch {
    console.error('[chatgpt-mcp] falha inesperada na operação de conteúdo público.');
    result = fail('INTERNAL_ERROR', 'Falha inesperada ao executar a operação de conteúdo.');
  }
  if (result === null) return null;
  if ((MCP_PUBLIC_CONTENT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
    const request: Record<string, unknown> = { argument_keys: Object.keys(args).sort() };
    for (const key of ['form_id', 'step_id', 'page_id', 'link_id', 'post_id']) if (isUuid(args[key])) request[key] = args[key];
    if (isRecord(args.changes)) request.changed_fields = Object.keys(args.changes).sort();
    if (isRecord(args.post)) request.content_length = rawText(args.post.content).length;
    if (Array.isArray(args.step_ids)) request.item_count = args.step_ids.length;
    if (Array.isArray(args.link_ids)) request.item_count = args.link_ids.length;
    const actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-');
    await audit(supabase, actor, toolName, actionType, request, result);
  }
  return result;
}
