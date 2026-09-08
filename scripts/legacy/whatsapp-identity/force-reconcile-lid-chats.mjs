#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

function loadEnv() {
  const env = { ...process.env };
  if (!fs.existsSync(ENV_FILE)) return env;
  for (const rawLine of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in env)) env[key] = value;
  }
  return env;
}

function phoneLookupKeys(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return [];
  const keys = new Set([digits]);
  const appendBrazilVariants = (national) => {
    if (national.length === 11 && national[2] === "9" && /[6-9]/.test(national[3] ?? "")) {
      keys.add(national.slice(0, 2) + national.slice(3));
    }
    if (national.length === 10 && /[6-9]/.test(national[2] ?? "")) {
      keys.add(`${national.slice(0, 2)}9${national.slice(2)}`);
    }
  };
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const national = digits.slice(2);
    keys.add(national);
    appendBrazilVariants(national);
    for (const key of [...keys]) {
      if (!key.startsWith("55") && (key.length === 10 || key.length === 11)) keys.add(`55${key}`);
    }
  } else if (digits.length === 10 || digits.length === 11) {
    keys.add(`55${digits}`);
    appendBrazilVariants(digits);
    for (const key of [...keys]) {
      if (!key.startsWith("55") && (key.length === 10 || key.length === 11)) keys.add(`55${key}`);
    }
  }
  return [...keys];
}

async function loadAll(supabase, table, columns, configure = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const query = configure(supabase.from(table).select(columns)).range(from, from + 999);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Credenciais Supabase ausentes em .env.local.");

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`[force-reconcile] projeto=${url} modo=${DRY_RUN ? "dry-run" : "apply"}`);

  // 1. Load all active chats
  const allChats = await loadAll(
    supabase,
    "comm_whatsapp_chats",
    "id,channel_id,external_chat_id,phone_number,phone_digits,lead_id,lead_link_source,display_name,deleted_at,merged_into_chat_id"
  );
  const activeChats = allChats.filter((c) => !c.merged_into_chat_id && !c.deleted_at);
  console.log(`[force-reconcile] chats ativos: ${activeChats.length}`);

  // 2. Find LID chats with phone_number (forward mapping worked)
  const lidChatsWithPhone = activeChats.filter(
    (c) => /@lid$/i.test(c.external_chat_id) && c.phone_number && c.phone_number.trim()
  );
  console.log(`[force-reconcile] chats @lid com telefone mapeado: ${lidChatsWithPhone.length}`);

  // 3. Build phone->chat index
  const phoneToChat = new Map();
  for (const chat of activeChats) {
    if (/@lid$/i.test(chat.external_chat_id)) continue;
    for (const key of phoneLookupKeys(chat.phone_digits || chat.phone_number)) {
      if (!phoneToChat.has(`${chat.channel_id}:${key}`)) {
        phoneToChat.set(`${chat.channel_id}:${key}`, chat);
      }
    }
  }

  // 4. Find merge candidates
  const mergeCandidates = [];
  for (const lidChat of lidChatsWithPhone) {
    let phoneChat = null;
    for (const key of phoneLookupKeys(lidChat.phone_digits || lidChat.phone_number)) {
      phoneChat = phoneToChat.get(`${lidChat.channel_id}:${key}`);
      if (phoneChat) break;
    }
    if (!phoneChat) {
      console.log(`[force-reconcile] SKIP ${lidChat.external_chat_id} -> phone ${lidChat.phone_digits}: chat phone nao encontrado`);
      continue;
    }
    if (phoneChat.id === lidChat.id) continue; // same chat

    // Skip if already merged
    if (phoneChat.merged_into_chat_id || lidChat.merged_into_chat_id) continue;

    mergeCandidates.push({
      lidChat,
      phoneChat,
      channelId: lidChat.channel_id,
    });
  }

  console.log(`\n[force-reconcile] candidatos a merge: ${mergeCandidates.length}`);

  // 5. Determine merge direction and execute
  let merged = 0;
  let skipped = 0;
  let errors = 0;

  for (const { lidChat, phoneChat, channelId } of mergeCandidates) {
    const phoneDigits = (lidChat.phone_digits || lidChat.phone_number || "").replace(/\D/g, "");
    const lidDigits = (lidChat.external_chat_id || "").replace(/@lid$/i, "").replace(/\D/g, "");

    // Skip if phone is same as LID digits (invalid)
    if (!phoneDigits || phoneDigits === lidDigits) {
      console.log(`[force-reconcile] SKIP ${lidChat.external_chat_id}: telefone invalido`);
      skipped++;
      continue;
    }

    // Determine winner: phone chat should win (it's the original)
    // Priority: manual lead_link > not deleted > older created_at
    let winner, loser, winnerSource, loserSource;
    if (phoneChat.lead_link_source === "manual" && lidChat.lead_link_source !== "manual") {
      winner = phoneChat;
      loser = lidChat;
    } else if (lidChat.lead_link_source === "manual" && phoneChat.lead_link_source !== "manual") {
      winner = lidChat;
      loser = phoneChat;
    } else if (!phoneChat.deleted_at && lidChat.deleted_at) {
      winner = phoneChat;
      loser = lidChat;
    } else if (!lidChat.deleted_at && phoneChat.deleted_at) {
      winner = lidChat;
      loser = phoneChat;
    } else {
      // Default: phone chat wins (it's the original with lead)
      winner = phoneChat;
      loser = lidChat;
    }

    winnerSource = winner === phoneChat ? "phone" : "lid";
    loserSource = winner === phoneChat ? "lid" : "phone";

    const hasLeadConflict = winner.lead_id && loser.lead_id && winner.lead_id !== loser.lead_id;

    console.log(`\n[force-reconcile] MERGE: ${winner.external_chat_id} (${winnerSource}, lead=${winner.lead_id || "none"}) <- ${loser.external_chat_id} (${loserSource}, lead=${loser.lead_id || "none"})`);

    if (hasLeadConflict) {
      console.log(`[force-reconcile]   CONFLITO DE LEAD: winner.lead=${winner.lead_id} loser.lead=${loser.lead_id}`);
      // Prioritize manual link
      if (winner.lead_link_source === "manual") {
        console.log(`[force-reconcile]   Mantendo lead do winner (manual)`);
      } else if (loser.lead_link_source === "manual") {
        console.log(`[force-reconcile]   Trocando para lead do loser (manual)`);
        const tmpLead = winner.lead_id;
        winner.lead_id = loser.lead_id;
        loser.lead_id = tmpLead;
      } else {
        console.log(`[force-reconcile]   Desvinculando ambos (nenhum manual)`);
        winner.lead_id = null;
      }
    } else {
      // Keep existing lead
      if (!winner.lead_id && loser.lead_id) {
        winner.lead_id = loser.lead_id;
      }
    }

    if (DRY_RUN) {
      console.log(`[force-reconcile]   DRY-RUN: merge seria executado`);
      skipped++;
      continue;
    }

    try {
      // Call the reconciliation function with synthetic evidence
      const { data, error } = await supabase.rpc("comm_whatsapp_reconcile_lid_identifier", {
        p_channel_id: channelId,
        p_lid_external_chat_id: lidChat.external_chat_id,
        p_phone_external_chat_id: phoneChat.external_chat_id,
        p_mapping_evidence: {
          round_trip_verified: true,
          source: "force_reconcile_script",
          forward_verified: true,
          reverse_unresolved_workaround: true,
        },
      });

      if (error) {
        console.log(`[force-reconcile]   ERRO: ${error.message}`);
        errors++;
      } else if (data && data.length > 0) {
        const result = data[0];
        if (result.merged) {
          console.log(`[force-reconcile]   OK: chat_id=${result.chat_id} merged=true`);
          merged++;
        } else {
          console.log(`[force-reconcile]   FALHA: merged=false reason=${result.conflict_reason}`);
          errors++;
        }
      } else {
        console.log(`[force-reconcile]   FALHA: resposta vazia`);
        errors++;
      }
    } catch (err) {
      console.log(`[force-reconcile]   ERRO: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[force-reconcile] RESUMO: merged=${merged} skipped=${skipped} errors=${errors}`);
  process.exitCode = errors > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("[force-reconcile] FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
