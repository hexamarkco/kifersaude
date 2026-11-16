import { generateSandboxReply } from '../_shared/ai-sandbox-attendance.ts';
import { buildJudgePrompt } from './judge-prompt.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { resolveMcpServiceActor } from '../_shared/mcp-internal-actor.ts';
import { generateTextForFeature } from '../_shared/ai-router.ts';
import { corsHeaders, toTrimmedString } from '../_shared/comm-whatsapp.ts';
import {
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
  validateAutonomousReplyOutput,
  type HandoffCode,
  type AutonomousMessageRow,
} from '../_shared/ai-autonomous-helpers.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type RequestBody = {
  scenarioKey?: string;
  scenarioLabel?: string;
  leadPersonaPrompt?: string;
  startMode?: 'ai_opens' | 'lead_opens';
  firstLeadMessage?: string;
  leadName?: string;
  maxTurns?: number;
  conversationId?: string;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const DEFAULT_MAX_TURNS = 8;
const HARD_MAX_TURNS = 15;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Credenciais do Supabase nao configuradas.');
  return createClient(supabaseUrl, serviceRoleKey);
};

const buildLeadSystemPrompt = (personaPrompt: string): string => [
  'Voce esta simulando ser um LEAD (cliente em potencial) numa conversa de WhatsApp com uma corretora de planos de saude.',
  'Responda sempre em primeira pessoa, como esse lead responderia de verdade: mensagens curtas e naturais de WhatsApp, sem formalidade excessiva. Nunca saia do personagem, nunca mencione que e uma IA, um teste ou uma simulacao.',
  '',
  'PERSONA:',
  personaPrompt,
].join('\n');

const buildLeadUserPrompt = (history: AutonomousMessageRow[]): string => {
  const transcriptLines = history.map((row) => `${row.role === 'lead' ? 'VOCE (lead)' : 'ATENDENTE'}: ${row.content}`);
  return [
    '--- CONVERSA ATE AGORA ---',
    transcriptLines.length > 0 ? transcriptLines.join('\n') : '(nenhuma mensagem ainda — voce inicia o contato)',
    '',
    '--- TAREFA ---',
    transcriptLines.length > 0
      ? 'Responda a ultima mensagem do ATENDENTE, de acordo com sua persona.'
      : 'Mande a primeira mensagem para a corretora, de acordo com sua persona.',
  ].join('\n');
};

const parseVerdict = (raw: string): { passed: boolean | null; violations: string[]; notes: string; playbookImprovements: string[] } => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as { passed?: unknown; violations?: unknown; notes?: unknown; playbook_improvements?: unknown };
    return {
      passed: typeof parsed.passed === 'boolean' ? parsed.passed : null,
      violations: Array.isArray(parsed.violations) ? parsed.violations.filter((v) => typeof v === 'string') : [],
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      playbookImprovements: Array.isArray(parsed.playbook_improvements)
        ? parsed.playbook_improvements.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch {
    return { passed: null, violations: [], notes: `[Resposta do juiz nao veio em JSON valido] ${cleaned}`.slice(0, 2000), playbookImprovements: [] };
  }
};

const collectDeterministicViolations = (history: AutonomousMessageRow[]): string[] => {
  const violations: string[] = [];
  history.forEach((row, index) => {
    if (row.role !== 'ai') return;
    const validation = validateAutonomousReplyOutput(row.content, history.slice(0, index));
    if (!validation.valid && validation.message) {
      violations.push(`Regra objetiva: ${validation.message}`);
    }
  });
  return [...new Set(violations)];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), { status: 405, headers: jsonHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const serviceActor = await resolveMcpServiceActor(req, supabaseAdmin, serviceRoleKey);
    let createdBy: string | null = null;
    if (serviceActor.isServiceRole) {
      if (req.headers.has('X-Kifer-MCP-Actor-Id') && (!serviceActor.actorId || !serviceActor.authorized)) {
        return new Response(JSON.stringify({ error: 'A conexão interna MCP exige um administrador ativo.' }), { status: 403, headers: jsonHeaders });
      }
      createdBy = serviceActor.actorId;
    } else {
      const authResult = await authorizeDashboardUser({ req, supabaseUrl, supabaseAnonKey, supabaseAdmin });
      if (!authResult.authorized) {
        return new Response(JSON.stringify(authResult.body), { status: authResult.status, headers: jsonHeaders });
      }
      createdBy = authResult.user.profileId;
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const scenarioKey = toTrimmedString(body.scenarioKey) || 'scenario';
    const scenarioLabel = toTrimmedString(body.scenarioLabel) || scenarioKey;
    const leadPersonaPrompt = toTrimmedString(body.leadPersonaPrompt);
    const startMode = body.startMode === 'lead_opens' ? 'lead_opens' : 'ai_opens';
    const firstLeadMessage = toTrimmedString(body.firstLeadMessage);
    const leadName = toTrimmedString(body.leadName).slice(0, 120);
    const requestedConversationId = toTrimmedString(body.conversationId);
    const maxTurns = Math.min(HARD_MAX_TURNS, Math.max(1, Math.floor(body.maxTurns ?? DEFAULT_MAX_TURNS)));

    if (!leadPersonaPrompt) {
      return new Response(JSON.stringify({ error: 'leadPersonaPrompt obrigatorio.' }), { status: 400, headers: jsonHeaders });
    }

    const leadSystemPrompt = buildLeadSystemPrompt(leadPersonaPrompt);

    let conversationId = requestedConversationId;
    if (conversationId) {
      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from('ai_sandbox_conversations')
        .select('id, created_by, is_automated')
        .eq('id', conversationId)
        .maybeSingle();
      if (conversationError) throw new Error(`Erro ao carregar conversa: ${conversationError.message}`);
      if (!conversation || !conversation.is_automated || (createdBy && conversation.created_by !== createdBy)) {
        throw new Error('Conversa de cenário inválida.');
      }
    } else {
      const { data: conversation, error: createError } = await supabaseAdmin
        .from('ai_sandbox_conversations')
        .insert({
          title: `[Teste automatizado] ${scenarioLabel}`,
          created_by: createdBy,
          is_automated: true,
        })
        .select('id')
        .single();
      if (createError) throw new Error(`Erro ao criar conversa: ${createError.message}`);
      conversationId = conversation.id as string;
    }

    const history: AutonomousMessageRow[] = [];
    let handoffTriggered = false;
    let finalHandoffCode: HandoffCode | null = null;
    let lastProvider: string | null = null;
    let lastModel: string | null = null;

    const persist = async (rows: Array<{ role: 'lead' | 'ai'; content: string; handoff_reason: string | null; handoff_code: string | null; provider: string | null; model: string | null }>) => {
      const persistedAt = Date.now();
      const { error } = await supabaseAdmin.from('ai_sandbox_messages').insert(
        rows.map((row, index) => ({
          conversation_id: conversationId,
          ...row,
          created_at: new Date(persistedAt + index).toISOString(),
        })),
      );
      if (error) throw new Error(`Erro ao salvar mensagem: ${error.message}`);
      for (const row of rows) history.push({ role: row.role, content: row.content });
    };

    // Both manual chat and automated scenarios use the shared production V2 and sandbox-only persistence.
    const respond = async (startWithApproach = false) => {
      const reply = await generateSandboxReply({ client: supabaseAdmin, conversationId, leadName, startWithApproach,
        advisorName: Deno.env.get('AUTONOMOUS_ATTENDANCE_V2_ADVISOR_NAME') });
      if (reply.alreadyHandedOff) throw new Error('Esta simulação já foi encerrada. Inicie uma nova.');
      if (reply.skipped) throw new Error('O cenário recebeu outra mensagem durante a geração. Inicie uma nova simulação.');
      for (const content of reply.messages) history.push({ role: 'ai', content });
      lastProvider = reply.provider;
      lastModel = reply.model;
      if (reply.handoffCode) {
        handoffTriggered = true;
        finalHandoffCode = reply.handoffCode;
      }
    };

    if (startMode === 'ai_opens') {
      await respond(true);
    } else if (firstLeadMessage) {
      await persist([{ role: 'lead', content: firstLeadMessage, handoff_reason: null, handoff_code: null, provider: null, model: null }]);
    }

    // ---- Loop de turnos ----

    let turn = 0;
    while (turn < maxTurns && !handoffTriggered) {
      // Turno do lead simulado (pula se acabamos de inserir a 1a mensagem dele manualmente neste turno 0)
      if (!(turn === 0 && startMode === 'lead_opens' && firstLeadMessage)) {
        const leadResult = await generateTextForFeature({
          supabaseAdmin,
          featureKey: 'sandbox.scenario',
          task: 'autonomous_attendance',
          systemPrompt: leadSystemPrompt,
          userPrompt: buildLeadUserPrompt(history),
          temperature: 0.85,
          maxTokens: 180,
          edgeFunction: 'ai-sandbox-run-scenario',
        });
        const leadText = leadResult.text.trim();
        if (!leadText) break;
        await persist([{ role: 'lead', content: leadText, handoff_reason: null, handoff_code: null, provider: null, model: null }]);
      }

      await respond();

      turn += 1;
    }

    await supabaseAdmin
      .from('ai_sandbox_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // ---- Avaliacao (juiz) ----

    const judgePlaybook = [
      'Avalie a qualificação inicial V2, sem exigir análise de produtos ou elegibilidade.',
      'Obrigatórios são quantidade de pessoas, idades, cidade e presença ou ausência de CNPJ/MEI; bairro nas capitais. Plano atual, objetivo e número do CNPJ são opcionais e não devem ser cobrados repetidamente.',
      'Qualificação concluída é distinta de proposta e venda; pedido humano e intervenção do sistema têm motivos diferentes.',
      AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
    ]
      .filter(Boolean)
      .join('\n\n');
    const { systemPrompt: judgeSystemPrompt, userPrompt: judgeUserPrompt } = buildJudgePrompt(judgePlaybook, history, handoffTriggered, finalHandoffCode);
    const judgeResult = await generateTextForFeature({
      supabaseAdmin,
      featureKey: 'sandbox.scenario',
      task: 'attendance_critique',
      systemPrompt: judgeSystemPrompt,
      userPrompt: judgeUserPrompt,
      temperature: 0.2,
      maxTokens: 600,
      edgeFunction: 'ai-sandbox-run-scenario',
    });
    const modelVerdict = parseVerdict(judgeResult.text);
    const deterministicViolations = collectDeterministicViolations(history);
    const verdict = {
      ...modelVerdict,
      passed: deterministicViolations.length > 0 ? false : modelVerdict.passed,
      violations: [...new Set([...modelVerdict.violations, ...deterministicViolations])],
      notes: deterministicViolations.length > 0
        ? [modelVerdict.notes, 'A avaliação objetiva encontrou violações que o juiz por IA não pode ignorar.'].filter(Boolean).join(' ')
        : modelVerdict.notes,
    };

    const { error: insertRunError } = await supabaseAdmin.from('ai_sandbox_test_runs').insert({
      conversation_id: conversationId,
      scenario_key: scenarioKey,
      scenario_label: scenarioLabel,
      turns: turn,
      handoff_triggered: handoffTriggered,
      handoff_code: finalHandoffCode,
      passed: verdict.passed,
      verdict: { violations: verdict.violations, notes: verdict.notes, playbook_improvements: verdict.playbookImprovements },
      provider: lastProvider,
      model: lastModel,
    });
    if (insertRunError) throw new Error(`Erro ao salvar resultado do teste: ${insertRunError.message}`);

    return new Response(JSON.stringify({
      success: true,
      conversationId,
      scenarioKey,
      scenarioLabel,
      turns: turn,
      handoffTriggered,
      handoffCode: finalHandoffCode,
      passed: verdict.passed,
      violations: verdict.violations,
      notes: verdict.notes,
      playbookImprovements: verdict.playbookImprovements,
    }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('[ai-sandbox-run-scenario] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao rodar cenario.' }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
