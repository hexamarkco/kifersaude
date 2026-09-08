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

(async () => {
  const results = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "privado-match-results.json"), "utf8"));

  // Check all disambiguated leads for existing chats
  console.log("=== VERIFICANDO LEADS DISAMBIGUADOS ===\n");

  const disambiguated = [];
  for (const r of results.multiple) {
    const chat = (await supabase.from("comm_whatsapp_chats").select("id, created_at").eq("external_chat_id", r.chat).single()).data;
    if (!chat) continue;

    const { data: firstInbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("message_at")
      .eq("chat_id", chat.id)
      .eq("direction", "inbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const chatFirstMsg = firstInbound?.[0]?.message_at;

    let bestMatch = null;
    let bestScore = -1;
    let bestReason = "";

    for (const lead of r.leads) {
      let score = 0;
      let reasons = [];

      // Check if lead has any existing chat (non-deleted)
      const { data: existingChats } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id, display_name")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .neq("id", chat.id);

      if (existingChats?.length) {
        score -= 10;
        reasons.push(`has ${existingChats.length} existing chat(s)`);
      }

      // Check name match
      if (lead.nome_completo?.toLowerCase().startsWith(r.firstName.toLowerCase())) {
        score += 3;
        reasons.push("name starts with first name");
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = lead;
        bestReason = reasons.join(", ");
      }
    }

    if (bestMatch && bestScore > 0) {
      disambiguated.push({
        chat: r.chat,
        chatId: chat.id,
        firstName: r.firstName,
        lead: bestMatch,
        score: bestScore,
        reason: bestReason,
      });
    }
  }

  console.log(`Disambiguated leads (score > 0): ${disambiguated.length}\n`);
  for (const d of disambiguated) {
    console.log(`Chat: ${d.chat}`);
    console.log(`  Lead: ${d.lead.nome_completo} (${d.lead.telefone})`);
    console.log(`  Score: ${d.score} | Reason: ${d.reason}`);
    console.log("");
  }

  // Also check unique matches for conflicts
  console.log("=== VERIFICANDO MATCHES ÚNICOS ===\n");
  for (const r of results.unique) {
    const chat = (await supabase.from("comm_whatsapp_chats").select("id").eq("external_chat_id", r.chat).single()).data;
    if (!chat) continue;

    // Check if lead already has a chat
    const { data: existingChats } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id")
      .eq("lead_id", r.lead.id)
      .is("deleted_at", null)
      .neq("id", chat.id);

    if (existingChats?.length) {
      console.log(`CONFLICT: ${r.chat} -> ${r.lead.nome_completo} (already has ${existingChats.length} chat(s))`);
      for (const c of existingChats) {
        console.log(`  Existing: ${c.external_chat_id}`);
      }
    }
  }
})();
