import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  formatPublicLeadAgeSummary,
  type ValidatedPublicLeadPayload,
  validatePublicLeadPayload,
} from '../_shared/public-lead-validation.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://www.kifersaude.com.br',
  'https://kifersaude.com.br',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const GENERIC_ERROR_BODY = { success: false };

type OriginRow = {
  id: string;
  nome: string;
};

type StatusRow = {
  id: string;
  nome: string;
};

type ContractTypeRow = {
  id: string;
  label: string;
  value: string;
};

type ResponsibleRow = {
  id: string;
  label: string;
  value: string;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const configuredOrigins = Deno.env
  .get('PUBLIC_LEAD_ALLOWED_ORIGINS')
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins?.length ? new Set(configuredOrigins) : DEFAULT_ALLOWED_ORIGINS;

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const jsonResponse = (origin: string | null, body: Record<string, unknown>, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(origin && allowedOrigins.has(origin) ? corsHeaders(origin) : {}),
      'Content-Type': 'application/json',
    },
  });

const isAllowedOrigin = (origin: string | null): origin is string => Boolean(origin && allowedOrigins.has(origin));

const getClientIp = (req: Request): string | null => {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-forwarded-for')?.split(',')[0],
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim().replace(/^\[|\]$/g, '') ?? '';
    const isIpv4 =
      value.split('.').length === 4 &&
      value.split('.').every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
    const isIpv6 = value.includes(':') && value.length <= 45 && /^[0-9a-f:]+$/i.test(value);

    if (isIpv4 || isIpv6) {
      return value;
    }
  }

  return null;
};

const hashIp = async (ip: string, serviceRoleKey: string): Promise<string> => {
  const bytes = new TextEncoder().encode(`${serviceRoleKey}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// `leads.origem`/`tipo_contratacao`/`responsavel` are legacy NOT NULL text
// columns (FK'd to these config tables by name/value) that predate the
// `*_id` columns and are never auto-synced by a trigger — unlike `status`,
// which is. So every insert must resolve and set the text value directly,
// not just the `*_id` column, or it can violate the NOT NULL/FK constraint.
const resolveOrigin = (origins: OriginRow[]): OriginRow | null => {
  const priorities = ['site', 'home', 'inicio', 'organico', 'organico site', 'landing'];
  const match = origins.find((origin) => priorities.some((term) => normalizeText(origin.nome).includes(term)));
  return match ?? origins[0] ?? null;
};

const resolveStatus = (statuses: StatusRow[]): StatusRow | null => {
  const match = statuses.find((status) => normalizeText(status.nome).includes('novo'));
  return match ?? statuses[0] ?? null;
};

const resolveContractType = (
  types: ContractTypeRow[],
  contractType: ValidatedPublicLeadPayload['contractType'],
): ContractTypeRow | null => {
  const aliases: Record<ValidatedPublicLeadPayload['contractType'], string[]> = {
    PF: ['pf', 'pessoa fisica', 'pessoa fisica individual', 'individual', 'familiar'],
    MEI: ['mei', 'pme', 'empresa', 'empresarial', 'cnpj', 'pj'],
    CNPJ: ['cnpj', 'pme', 'empresa', 'empresarial', 'pj', 'coletivo empresarial'],
  };
  const match = types.find((type) => {
    const candidate = normalizeText(`${type.label} ${type.value}`);
    return aliases[contractType].some((alias) => candidate.includes(alias));
  });

  return match ?? types[0] ?? null;
};

const resolveResponsible = (responsibles: ResponsibleRow[]): ResponsibleRow | null => responsibles[0] ?? null;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server credentials.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (!isAllowedOrigin(origin)) {
    return jsonResponse(null, GENERIC_ERROR_BODY, 403);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(origin, GENERIC_ERROR_BODY, 405);
  }

  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse(origin, GENERIC_ERROR_BODY, 415);
  }

  const contentLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 4096) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    const payload = validatePublicLeadPayload(JSON.parse(rawBody));
    if (!payload) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    // Pretend success so bots cannot distinguish the honeypot from a real submission.
    if (payload.honeypotFilled) {
      return jsonResponse(origin, { success: true }, 201);
    }

    const clientIp = getClientIp(req);
    if (!clientIp) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc('consume_public_lead_rate_limit', {
      p_ip_hash: await hashIp(clientIp, serviceRoleKey),
    });
    if (rateLimitError) {
      throw rateLimitError;
    }

    if (allowed !== true) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 429);
    }

    const [originsResult, statusesResult, contractTypesResult, responsiblesResult] = await Promise.all([
      supabaseAdmin.from('lead_origens').select('id, nome').eq('ativo', true),
      supabaseAdmin.from('lead_status_config').select('id, nome').eq('ativo', true).order('ordem', { ascending: true }),
      supabaseAdmin.from('lead_tipos_contratacao').select('id, label, value').eq('ativo', true).order('ordem', { ascending: true }),
      supabaseAdmin.from('lead_responsaveis').select('id, label, value').eq('ativo', true).order('ordem', { ascending: true }),
    ]);
    if (originsResult.error || statusesResult.error || contractTypesResult.error || responsiblesResult.error) {
      throw new Error('Unable to resolve lead defaults.');
    }

    const originRow = resolveOrigin((originsResult.data ?? []) as OriginRow[]);
    const status = resolveStatus((statusesResult.data ?? []) as StatusRow[]);
    const contractTypeRow = resolveContractType((contractTypesResult.data ?? []) as ContractTypeRow[], payload.contractType);
    const responsible = resolveResponsible((responsiblesResult.data ?? []) as ResponsibleRow[]);

    const now = new Date().toISOString();
    const { error: insertError } = await supabaseAdmin.from('leads').insert({
      nome_completo: payload.name,
      telefone: payload.phone,
      cidade: payload.city,
      origem: originRow?.nome ?? undefined,
      origem_id: originRow?.id ?? null,
      status: status?.nome ?? undefined,
      status_id: status?.id ?? null,
      tipo_contratacao: contractTypeRow?.value ?? undefined,
      tipo_contratacao_id: contractTypeRow?.id ?? null,
      responsavel: responsible?.value ?? undefined,
      observacoes: `Lead site | Tipo: ${payload.contractType} | Cidade: ${payload.city} | Beneficiarios: ${formatPublicLeadAgeSummary(payload.ageSummary)}`,
      data_criacao: now,
      ultimo_contato: now,
      arquivado: false,
    });
    if (insertError) {
      throw insertError;
    }

    return jsonResponse(origin, { success: true }, 201);
  } catch (error) {
    console.error('[public-lead-submit] request failed', error);
    return jsonResponse(origin, GENERIC_ERROR_BODY, 500);
  }
});
