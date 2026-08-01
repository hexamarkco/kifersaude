#!/usr/bin/env node
/**
 * verify-automations.mjs
 *
 * Definitive health check + smoke test for the auto-contact automation pipeline.
 *
 * Usage:
 *   node scripts/verify-automations.mjs
 *
 * What it does:
 *   1. Loads Supabase credentials from .env.local (or env vars).
 *   2. Calls automation_flows_health() - if the RPC is missing, migrations
 *      were not applied (drift) -> exit 1.
 *   3. Invokes check_auto_contact_inactivity_triggers() once (service role),
 *      which schedules the next batch of eligible leads immediately.
 *   4. Re-reads health and prints a summary; exits non-zero on any failure:
 *      missing crons, last run errored, or unexpected error.
 *
 * Exit codes:
 *   0 - pipeline healthy
 *   1 - drift / failure detected (message printed)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

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

function fail(message, details = "") {
  console.error(`\n[VERIFY] FALHA: ${message}`);
  if (details) console.error(`[VERIFY] Detalhe: ${details}`);
  process.exitCode = 1;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    fail("VITE_SUPABASE_URL/VITE_SUPABASE_SERVICE_ROLE_KEY nao encontrados (.env.local)");
    return;
  }

  const supabase = createClient(url, serviceKey);
  console.log("[VERIFY] Conectado:", url);

  // 1. Health RPC must exist (drift check)
  console.log("\n[VERIFY] 1/3 Consultando automation_flows_health() ...");
  const { data: healthBefore, error: healthError } = await supabase.rpc("automation_flows_health");
  if (healthError) {
    fail(
      "automation_flows_health() indisponivel - migrations de automacao nao aplicadas (drift).",
      healthError.message,
    );
    return;
  }

  const crons = healthBefore?.crons ?? {};
  const missingCrons = Object.entries(crons)
    .filter(([, state]) => state === "MISSING")
    .map(([name]) => name);
  if (missingCrons.length > 0) {
    fail(`Cron(s) ausentes no banco: ${missingCrons.join(", ")}`, JSON.stringify(crons));
    return;
  }
  console.log("[VERIFY] Crons ativos:", JSON.stringify(crons));

  // 2. Smoke test: run the inactivity detector once
  console.log("\n[VERIFY] 2/3 Invocando check_auto_contact_inactivity_triggers() ...");
  const { error: runError } = await supabase.rpc("check_auto_contact_inactivity_triggers");
  if (runError) {
    fail("check_auto_contact_inactivity_triggers() falhou na invocacao.", runError.message);
    return;
  }

  // 3. Re-read health
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log("\n[VERIFY] 3/3 Re-lendo health ...");
  const { data: healthAfter, error: healthAfterError } = await supabase.rpc("automation_flows_health");
  if (healthAfterError) {
    fail("automation_flows_health() falhou na segunda leitura.", healthAfterError.message);
    return;
  }

  const lastRun = healthAfter?.lastInactivityRun ?? {};
  if (!lastRun.runAt) {
    fail("Nenhum registro de execucao do cron de inatividade (automation_run_log vazio).");
    return;
  }
  if (lastRun.status === "error") {
    fail("Ultima execucao do cron de inatividade registrou erro.", lastRun.error);
    return;
  }

  console.log("\n========================= RESUMO DE SAUDE =========================");
  console.log(JSON.stringify(healthAfter, null, 2));
  console.log("===================================================================");

  const jobs = healthAfter?.jobs ?? {};
  const eligible = healthAfter?.eligibleLeads ?? 0;
  console.log(`\n[VERIFY] Ultima execucao: ${lastRun.runAt} (${lastRun.status})`);
  console.log(`[VERIFY] Elegiveis aguardando cron: ${eligible}`);
  console.log(`[VERIFY] Jobs pendentes: ${jobs.pending} | em processamento: ${jobs.processing}`);

  if (jobs.failed7d > 0) {
    console.warn(`[VERIFY] ATENCAO: ${jobs.failed7d} job(s) falharam nos ultimos 7 dias.`);
  }
  if (eligible > 0 && jobs.pending === 0) {
    console.warn(
      "[VERIFY] ATENCAO: ha leads elegiveis e nenhum job pendente - o cron deve agendar no proximo tick (5min).",
    );
  }

  console.log("\n[VERIFY] OK - pipeline de automacoes saudavel.");
}

main().catch((error) => {
  fail("Erro inesperado.", error.message);
});
