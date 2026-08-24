import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  extractFormSlug,
  validatePublicFormSubmission,
  type PublicFormStepDefinition,
  type ValidatedPublicFormSubmission,
} from '../_shared/public-form-validation.ts';

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
const MAX_BODY_BYTES = 8192;

type OriginRow = { id: string; nome: string };
type StatusRow = { id: string; nome: string };
type ContractTypeRow = { id: string; label: string; value: string };
type FormRow = { id: string; title: string; slug: string };
type StepOption = { id: string; label: string; value?: string };
type StepRow = {
  id: string;
  step_type: PublicFormStepDefinition['step_type'];
  title: string;
  is_required: boolean;
  field_key: 'cidade' | 'tipo_contratacao' | null;
  options: StepOption[];
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

const findOriginId = (origins: OriginRow[]): string | null => {
  const priorities = ['formulario', 'form', 'site', 'landing', 'organico'];
  const match = origins.find((origin) => priorities.some((term) => normalizeText(origin.nome).includes(term)));
  return match?.id ?? origins[0]?.id ?? null;
};

const findStatusId = (statuses: StatusRow[]): string | null => {
  const match = statuses.find((status) => normalizeText(status.nome).includes('novo'));
  return match?.id ?? statuses[0]?.id ?? null;
};

const CONTRACT_TYPE_ALIASES: Record<'PF' | 'MEI' | 'CNPJ', string[]> = {
  PF: ['pf', 'pessoa fisica', 'pessoa fisica individual', 'individual', 'familiar'],
  MEI: ['mei', 'pme', 'empresa', 'empresarial', 'cnpj', 'pj'],
  CNPJ: ['cnpj', 'pme', 'empresa', 'empresarial', 'pj', 'coletivo empresarial'],
};

const findContractTypeId = (types: ContractTypeRow[], contractType: 'PF' | 'MEI' | 'CNPJ'): string | null => {
  const aliases = CONTRACT_TYPE_ALIASES[contractType];
  const match = types.find((type) => {
    const candidate = normalizeText(`${type.label} ${type.value}`);
    return aliases.some((alias) => candidate.includes(alias));
  });
  return match?.id ?? null;
};

const buildFieldMappings = (
  steps: StepRow[],
  answers: ValidatedPublicFormSubmission['answers'],
): { cidade: string | null; contractType: 'PF' | 'MEI' | 'CNPJ' | null } => {
  let cidade: string | null = null;
  let contractType: 'PF' | 'MEI' | 'CNPJ' | null = null;

  for (const step of steps) {
    if (!step.field_key) continue;
    const answer = answers[step.id];
    if (answer === undefined) continue;

    if (step.field_key === 'cidade') {
      if (step.step_type === 'short_text' && typeof answer === 'string') {
        cidade = answer;
      } else if (step.step_type === 'single_choice' && typeof answer === 'string') {
        cidade = step.options.find((option) => option.id === answer)?.label ?? cidade;
      }
    }

    if (step.field_key === 'tipo_contratacao' && step.step_type === 'single_choice' && typeof answer === 'string') {
      const optionValue = step.options.find((option) => option.id === answer)?.value;
      if (optionValue === 'PF' || optionValue === 'MEI' || optionValue === 'CNPJ') {
        contractType = optionValue;
      }
    }
  }

  return { cidade, contractType };
};

const buildAnswersSummary = (steps: StepRow[], answers: ValidatedPublicFormSubmission['answers']): string => {
  const lines: string[] = [];

  for (const step of steps) {
    const answer = answers[step.id];
    if (answer === undefined) continue;

    if (step.step_type === 'short_text' && typeof answer === 'string') {
      lines.push(`${step.title}: ${answer}`);
    } else if (step.step_type === 'single_choice' && typeof answer === 'string') {
      const label = step.options.find((option) => option.id === answer)?.label ?? answer;
      lines.push(`${step.title}: ${label}`);
    } else if (step.step_type === 'multi_choice' && Array.isArray(answer)) {
      const labels = answer.map((id) => step.options.find((option) => option.id === id)?.label ?? id);
      lines.push(`${step.title}: ${labels.join(', ')}`);
    }
  }

  return lines.join(' | ');
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server credentials.');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
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
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    const formSlug = extractFormSlug(parsedBody);
    if (!formSlug) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 400);
    }

    const { data: form, error: formError } = await supabaseAdmin
      .from('public_forms')
      .select('id, title, slug')
      .eq('slug', formSlug)
      .eq('is_published', true)
      .maybeSingle();
    if (formError) throw formError;
    if (!form) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 404);
    }

    const { data: stepRows, error: stepsError } = await supabaseAdmin
      .from('public_form_steps')
      .select('id, step_type, title, is_required, field_key, options')
      .eq('form_id', (form as FormRow).id)
      .order('position', { ascending: true });
    if (stepsError) throw stepsError;

    const steps = (stepRows ?? []) as StepRow[];
    const answerableSteps = steps.filter((step) => step.step_type !== 'contact');

    const payload = validatePublicFormSubmission(
      parsedBody,
      answerableSteps.map((step) => ({
        id: step.id,
        step_type: step.step_type,
        is_required: step.is_required,
        options: step.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    );
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

    const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc('consume_public_form_rate_limit', {
      p_ip_hash: await hashIp(clientIp, serviceRoleKey),
    });
    if (rateLimitError) throw rateLimitError;
    if (allowed !== true) {
      return jsonResponse(origin, GENERIC_ERROR_BODY, 429);
    }

    const [originsResult, statusesResult, contractTypesResult] = await Promise.all([
      supabaseAdmin.from('lead_origens').select('id, nome').eq('ativo', true),
      supabaseAdmin.from('lead_status_config').select('id, nome').eq('ativo', true).order('ordem', { ascending: true }),
      supabaseAdmin.from('lead_tipos_contratacao').select('id, label, value').eq('ativo', true).order('ordem', { ascending: true }),
    ]);
    if (originsResult.error || statusesResult.error || contractTypesResult.error) {
      throw new Error('Unable to resolve lead defaults.');
    }

    const { cidade, contractType } = buildFieldMappings(answerableSteps, payload.answers);
    const answersSummary = buildAnswersSummary(answerableSteps, payload.answers);

    const geoSummary =
      payload.geo.permission === 'granted' && payload.geo.latitude !== null && payload.geo.longitude !== null
        ? `Localizacao: https://maps.google.com/?q=${payload.geo.latitude},${payload.geo.longitude}${
            payload.geo.accuracyMeters !== null ? ` (precisao ~${Math.round(payload.geo.accuracyMeters)}m)` : ''
          }`
        : null;

    const observacoesParts = [
      `Lead formulario "${(form as FormRow).title}" (/forms/${(form as FormRow).slug})`,
      answersSummary || null,
      geoSummary,
    ].filter((part): part is string => Boolean(part));

    const now = new Date().toISOString();
    const { data: insertedLead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        nome_completo: payload.contact.name,
        telefone: payload.contact.phone,
        email: payload.contact.email ?? undefined,
        cidade: cidade ?? undefined,
        origem_id: findOriginId((originsResult.data ?? []) as OriginRow[]),
        status_id: findStatusId((statusesResult.data ?? []) as StatusRow[]),
        tipo_contratacao_id: contractType
          ? findContractTypeId((contractTypesResult.data ?? []) as ContractTypeRow[], contractType)
          : null,
        observacoes: observacoesParts.join(' | '),
        data_criacao: now,
        ultimo_contato: now,
        arquivado: false,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { error: submissionError } = await supabaseAdmin.from('public_form_submissions').insert({
      form_id: (form as FormRow).id,
      lead_id: (insertedLead as { id: string }).id,
      answers: payload.answers,
      contact_name: payload.contact.name,
      contact_phone: payload.contact.phone,
      contact_email: payload.contact.email,
      latitude: payload.geo.latitude,
      longitude: payload.geo.longitude,
      geo_accuracy_m: payload.geo.accuracyMeters,
      geo_permission: payload.geo.permission,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    });
    if (submissionError) throw submissionError;

    return jsonResponse(origin, { success: true }, 201);
  } catch (error) {
    console.error('[public-form-submit] request failed', error);
    return jsonResponse(origin, GENERIC_ERROR_BODY, 500);
  }
});
