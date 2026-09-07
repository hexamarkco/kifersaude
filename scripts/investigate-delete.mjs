#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");

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

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const action = process.argv[2] || "merge-log";

(async () => {
  if (action === "merge-log") {
    console.log("=== COMM_WHATSAPP_CHAT_MERGE_LOG (ultimos 50 registros) ===\n");
    const { data, error } = await supabase
      .from("comm_whatsapp_chat_merge_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.log("Erro:", error.message); return; }
    if (!data?.length) { console.log("Nenhum registro encontrado"); return; }
    for (const log of data) {
      console.log(`[${log.created_at}] run=${log.run_id}`);
      console.log(`  winner: ${log.winner_chat_id} | loser: ${log.loser_chat_id}`);
      console.log(`  reason: ${log.reason}`);
      console.log(`  evidence: ${JSON.stringify(log.mapping_evidence)}`);
      console.log(`  winner_before: ${JSON.stringify(log.winner_before)}`);
      console.log(`  loser_before: ${JSON.stringify(log.loser_before)}`);
      console.log(`  moved_counts: ${JSON.stringify(log.moved_counts)}`);
      console.log("");
    }
  } else if (action === "deleted-chats") {
    console.log("=== CHATS COM deleted_at (soft-deletados) ===\n");
    // Check for chats that were soft-deleted recently
    const { data, error } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id, updated_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50);
    if (error) { console.log("Erro:", error.message); return; }
    console.log(`Chats com deleted_at (ultimos 50): ${data?.length || 0}`);
    for (const c of (data || [])) {
      console.log(`  [${c.deleted_at}] ${c.external_chat_id} | phone: ${c.phone_digits} | display: ${c.display_name} | merged_into: ${c.merged_into_chat_id || "none"} | lead: ${c.lead_id || "none"}`);
    }
  } else if (action === "alessandra") {
    console.log("=== INVESTIGACAO ALESSANDRA ===\n");
    
    // 1. Search all chats with phone variants of 21979237553
    const phoneVariants = ["5521979237553", "21979237553", "5521979237553"];
    console.log("1. Buscando chats com telefone da Alessandra...");
    for (const p of phoneVariants) {
      const { data } = await supabase.from("comm_whatsapp_chats").select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id, updated_at, created_at").eq("phone_digits", p);
      if (data?.length) {
        console.log(`   Telefone ${p}: ${data.length} chat(s)`);
        for (const c of data) {
          console.log(`     ${c.external_chat_id} | deleted: ${c.deleted_at || "no"} | merged: ${c.merged_into_chat_id || "no"} | lead: ${c.lead_id || "none"}`);
        }
      }
    }

    // 2. Search merge log for this phone
    console.log("\n2. Buscando no merge log...");
    const { data: mergeLogs } = await supabase
      .from("comm_whatsapp_chat_merge_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    for (const log of (mergeLogs || [])) {
      const lb = log.loser_before || {};
      const wb = log.winner_before || {};
      const loserPhone = lb.phone_digits || lb.phone_number || "";
      const winnerPhone = wb.phone_digits || wb.phone_number || "";
      if (loserPhone.includes("79237") || winnerPhone.includes("79237") || 
          loserPhone.includes("7553") || winnerPhone.includes("7553")) {
        console.log(`  FOUND: [${log.created_at}] winner=${log.winner_chat_id} loser=${log.loser_chat_id} reason=${log.reason}`);
        console.log(`    winner_before: ${JSON.stringify(wb)}`);
        console.log(`    loser_before: ${JSON.stringify(lb)}`);
      }
    }

    // 3. Search all chats with 'Alessandra' in name
    console.log("\n3. Buscando chats com 'Alessandra' no nome...");
    const { data: nameChats } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id, phone_digits, display_name, push_name, lead_id, deleted_at, merged_into_chat_id, updated_at")
      .or("display_name.ilike.%Alessandra%,push_name.ilike.%Alessandra%");
    for (const c of (nameChats || [])) {
      console.log(`  ${c.external_chat_id} | display: ${c.display_name} | push: ${c.push_name} | lead: ${c.lead_id || "none"} | deleted: ${c.deleted_at || "no"} | merged: ${c.merged_into_chat_id || "no"}`);
    }

    // 4. Search identifiers
    console.log("\n4. Buscando identifiers...");
    const { data: ids } = await supabase
      .from("comm_whatsapp_chat_identifiers")
      .select("channel_id, external_chat_id, chat_id, identifier_kind, is_verified, source")
      .or("external_chat_id.like.*79237*,external_chat_id.like.*7553*");
    for (const i of (ids || [])) {
      console.log(`  ${i.external_chat_id} -> chat: ${i.chat_id} | kind: ${i.identifier_kind} | verified: ${i.is_verified} | source: ${i.source}`);
    }

    // 5. Search messages with this phone
    console.log("\n5. Buscando mensagens...");
    const { data: chatsWithPhone } = await supabase.from("comm_whatsapp_chats").select("id").or("phone_digits.eq.5521979237553,phone_digits.eq.21979237553");
    if (chatsWithPhone?.length) {
      for (const chat of chatsWithPhone) {
        const { count } = await supabase.from("comm_whatsapp_messages").select("id", { count: "exact", head: true }).eq("chat_id", chat.id);
        console.log(`  Chat ${chat.id}: ${count} mensagens`);
      }
    } else {
      console.log("  Nenhum chat encontrado com esse telefone");
    }

    // 6. Check if the lead has any observations that mention the chat
    console.log("\n6. Verificando lead Alessandra...");
    const { data: leads } = await supabase.from("leads").select("id, nome_completo, telefone, observacoes").ilike("nome_completo", "%alessandra%").eq("telefone", "21979237553");
    for (const l of (leads || [])) {
      console.log(`  Lead: ${l.nome_completo} (${l.telefone})`);
      console.log(`  ID: ${l.id}`);
      console.log(`  Observacoes: ${(l.observacoes || "").substring(0, 200)}`);
    }
  } else if (action === "enrichment-jobs") {
    console.log("=== ENRICHMENT JOBS RECENTES ===\n");
    const { data, error } = await supabase
      .from("comm_whatsapp_enrichment_jobs")
      .select("id, channel_id, chat_id, kind, status, attempts, last_error, created_at, updated_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) { console.log("Erro:", error.message); return; }
    for (const j of (data || [])) {
      console.log(`[${j.created_at}] chat=${j.chat_id} kind=${j.kind} status=${j.status} attempts=${j.attempts} error=${j.last_error || "none"}`);
    }
  } else if (action === "conflicts") {
    console.log("=== IDENTITY CONFLICTS ===\n");
    const { data, error } = await supabase
      .from("comm_whatsapp_identity_conflicts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) { console.log("Erro:", error.message); return; }
    for (const c of (data || [])) {
      console.log(`[${c.created_at}] chat=${c.chat_id} type=${c.conflict_type} status=${c.status}`);
      console.log(`  details: ${JSON.stringify(c.details)}`);
    }
  }
})();
