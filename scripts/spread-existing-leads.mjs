#!/usr/bin/env node
/**
 * spread-existing-leads.mjs
 *
 * Operational tool: replaces the inactivity-flow job queue with a spaced
 * 45-day list covering all current leads in "Contato Inicial" and
 * "Em Atendimento". New leads (created after this run) are NOT scheduled here
 * and follow the normal flow.
 *
 * Steps:
 *   1. Deletes every job of the inactivity flows (current queue + history).
 *   2. For each active lead in the trigger statuses, inserts the flow's
 *      step 0 job with a deterministic slot (lead hash) spread over
 *      weekdays (Mon-Sat) x 07:00-19:00 (America/Sao_Paulo) for 45 days.
 *   3. Prints the resulting distribution.
 *
 * Usage: npm run spread:leads   (or node scripts/spread-existing-leads.mjs)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

const DAYS = 45;
const WINDOW_START_BRT = { hour: 7, minute: 0 };
const WINDOW_END_BRT = { hour: 19, minute: 0 };
const ALLOWED_WEEKDAYS = new Set([1, 2, 3, 4, 5, 6]); // Mon-Sat
const TZ = "America/Sao_Paulo";

const FLOW_IDS = {
  ci: "flow-inatividade-contato-inicial",
  emAtendimento: "flow-inatividade-em-atendimento",
};

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync(ENV_FILE)) {
    for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in env)) env[key] = value;
    }
  }
  return env;
}

function hashLead(leadId) {
  let h = 0;
  for (let i = 0; i < leadId.length; i += 1) {
    h = (h * 31 + leadId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function zonedParts(date, tz = TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value) ?? 0;
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function zonedToUtc({ year, month, day, hour, minute, second = 0 }) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = (() => {
    const sample = new Date(naiveUtc);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(sample);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value) ?? 0;
    let mins = get("hour") * 60 + get("minute");
    if (mins >= 24 * 60) mins -= 24 * 60;
    const asUtc = Date.UTC(
      sample.getUTCFullYear(),
      sample.getUTCMonth(),
      sample.getUTCDate(),
      Math.floor(mins / 60),
      mins % 60,
    );
    return asUtc - sample.getTime();
  })();
  return new Date(naiveUtc - offset);
}

function buildSlots(fromDate) {
  const slots = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  for (let dayOffset = 0; dayOffset < DAYS * 2 && slots.length < DAYS * 720; dayOffset += 1) {
    const day = new Date(cursor.getTime() + dayOffset * 86400000);
    const parts = zonedParts(day);
    const weekday = new Date(zonedToUtc({ ...parts, hour: 12, minute: 0 })).getUTCDay();
    const isoWeekday = weekday === 0 ? 7 : weekday;
    if (!ALLOWED_WEEKDAYS.has(isoWeekday)) continue;
    for (let minute = 0; minute < 720; minute += 1) {
      const hour = Math.floor(minute / 60);
      const min = minute % 60;
      slots.push(zonedToUtc({ year: parts.year, month: parts.month, day: parts.day, hour: hour + WINDOW_START_BRT.hour, minute: WINDOW_START_BRT.minute + min }));
    }
  }
  return slots;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[spread] Faltam VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY (.env.local)");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  // 1. Load settings + flows
  const { data: row } = await supabase
    .from("integration_settings")
    .select("settings")
    .eq("slug", "whatsapp_auto_contact")
    .maybeSingle();
  if (!row) {
    console.error("[spread] settings nao encontradas");
    process.exit(1);
  }
  const settings = row.settings;
  const flows = settings.flows || [];
  const ciFlow = flows.find((f) => f.id === FLOW_IDS.ci);
  const emAtFlow = flows.find((f) => f.id === FLOW_IDS.emAtendimento);
  if (!ciFlow || !emAtFlow) {
    console.error("[spread] fluxos de inatividade nao encontrados");
    process.exit(1);
  }
  const flowById = { [FLOW_IDS.ci]: ciFlow, [FLOW_IDS.emAtendimento]: emAtFlow };

  // 2. Status configs
  const { data: statuses } = await supabase.from("lead_status_config").select("id, nome");
  const ciStatus = (statuses || []).find((s) => s.nome === "Contato Inicial");
  const emAtStatus = (statuses || []).find((s) => s.nome === "Em atendimento");
  if (!ciStatus || !emAtStatus) {
    console.error("[spread] status alvo nao encontrados");
    process.exit(1);
  }

  // 3. Wipe the inactivity queues (current + history)
  const flowIdList = [FLOW_IDS.ci, FLOW_IDS.emAtendimento];
  for (const fid of flowIdList) {
    const { count, error } = await supabase
      .from("auto_contact_flow_jobs")
      .delete({ count: "exact" })
      .eq("flow_id", fid);
    if (error) {
      console.error(`[spread] erro ao limpar ${fid}:`, error.message);
      process.exit(1);
    }
    console.log(`[spread] fila zerada: ${fid} (${count} jobs removidos)`);
  }

  // 4. Build the spaced list
  const leadsByStatus = {};
  for (const [key, statusConfig, flow] of [
    ["ci", ciStatus, ciFlow],
    ["emAtendimento", emAtStatus, emAtFlow],
  ]) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .eq("status_id", statusConfig.id)
      .or("skip_automation.is.null,skip_automation.eq.false")
      .limit(2000);
    const ids = (leads || []).map((l) => l.id);

    // Exclui leads cuja ultima mensagem do chat e inbound (cliente aguardando
    // resposta humana). Leads que ja responderam nao entram na lista; o cron
    // de inatividade cancela/ignora de qualquer forma (regra sticky).
    const responded = new Set();
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data: chats } = await supabase
        .from("comm_whatsapp_chats")
        .select("lead_id")
        .in("lead_id", chunk)
        .eq("last_message_direction", "inbound");
      for (const c of chats || []) responded.add(c.lead_id);
    }

    leadsByStatus[key] = {
      leads: ids.filter((id) => !responded.has(id)),
      flow,
      step: (flow.steps || [])[0],
    };
    console.log(
      `[spread] ${key}: ${leadsByStatus[key].leads.length} leads (${responded.size} excluidos por resposta do cliente)`
    );
  }

  const slots = buildSlots(new Date());
  console.log(`[spread] slots disponiveis (${DAYS} dias uteis, 07-19h BRT): ${slots.length}`);

  const totalLeads = Object.values(leadsByStatus).reduce((sum, g) => sum + g.leads.length, 0);
  if (totalLeads === 0 || slots.length === 0) {
    console.error("[spread] nada para agendar");
    process.exit(1);
  }

  const jobs = [];
  for (const group of Object.values(leadsByStatus)) {
    const step = group.step;
    if (!step || step.actionType !== "send_message") {
      console.error("[spread] etapa 0 de um fluxo nao e send_message");
      process.exit(1);
    }
    const nowIso = new Date().toISOString();
    for (const leadId of group.leads) {
      const slotIndex = hashLead(leadId) % slots.length;
      const actionPayload = { inactivity_started_at: nowIso };
      if (Array.isArray(step.messages) && step.messages.length > 0) {
        actionPayload.messages = step.messages;
      }
      jobs.push({
        lead_id: leadId,
        flow_id: group.flow.id,
        step_id: step.id,
        step_order: 0,
        action_type: step.actionType,
        message_source: step.messageSource ?? null,
        template_id: step.templateId ?? null,
        custom_message: step.customMessage ?? null,
        status_to_set: step.statusToSet ?? null,
        action_payload: actionPayload,
        scheduled_at: slots[slotIndex].toISOString(),
        status: "pending",
      });
    }
  }

  for (let i = 0; i < jobs.length; i += 100) {
    const chunk = jobs.slice(i, i + 100);
    const { error } = await supabase.from("auto_contact_flow_jobs").insert(chunk);
    if (error) {
      console.error("[spread] erro ao inserir jobs:", error.message);
      process.exit(1);
    }
  }
  console.log(`[spread] lista criada: ${jobs.length} jobs (etapa 0) espacados em ${DAYS} dias`);

  // 5. Validate distribution
  const { data: pend } = await supabase
    .from("auto_contact_flow_jobs")
    .select("scheduled_at, flow_id")
    .eq("status", "pending")
    .limit(3000);
  const byMinute = {};
  const byDay = {};
  for (const j of pend || []) {
    const m = j.scheduled_at.substring(0, 16);
    const d = j.scheduled_at.substring(0, 10);
    byMinute[m] = (byMinute[m] || 0) + 1;
    byDay[d] = (byDay[d] || 0) + 1;
  }
  const maxMin = Math.max(0, ...Object.values(byMinute));
  const daysWith = Object.entries(byDay).sort();
  console.log("[spread] distribuicao: max jobs/minuto =", maxMin, "| dias com jobs =", daysWith.length);
  daysWith.slice(0, 5).forEach(([d, v]) => console.log(`   ${d}: ${v} jobs`));
  console.log(`[spread] ultimos dias: ${daysWith.slice(-2).map(([d, v]) => `${d}: ${v}`).join(" | ")}`);
}

main().catch((e) => {
  console.error("[spread] FATAL:", e.message);
  process.exit(1);
});
