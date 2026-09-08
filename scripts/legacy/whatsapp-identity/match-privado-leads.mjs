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
  // Get all "Contato privado" chats
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Total chats "Contato privado": ${privadoChats?.length || 0}\n`);

  // For each chat, try to find matching lead by first name + phone
  const results = { unique: [], multiple: [], none: [], error: [] };

  for (const chat of (privadoChats || [])) {
    // Get first outbound message
    const { data: outbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "outbound")
      .order("message_at", { ascending: true })
      .limit(1);

    if (!outbound?.length || !outbound[0].text_content) {
      results.none.push({ chat: chat.external_chat_id, reason: "no outbound text" });
      continue;
    }

    // Extract first name from "Oi {name}, tudo bem?" or "Oi {name}"
    const nameMatch = outbound[0].text_content.match(/Oi\s+([^,!\s]+)/i);
    if (!nameMatch) {
      results.none.push({ chat: chat.external_chat_id, reason: `no name in: "${outbound[0].text_content.substring(0, 60)}"` });
      continue;
    }

    const firstName = nameMatch[1].trim();

    // Search for leads with this first name (split on space to get first word)
    const firstNameWord = firstName.split(/\s+/)[0];
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nome_completo, telefone")
      .or(`nome_completo.ilike.${firstNameWord}%,nome_completo.ilike.% ${firstNameWord}%`)
      .limit(5);

    if (!leads?.length) {
      results.none.push({ chat: chat.external_chat_id, firstName, reason: "no leads found" });
      continue;
    }

    if (leads.length === 1) {
      results.unique.push({
        chat: chat.external_chat_id,
        chatId: chat.id,
        firstName,
        lead: leads[0],
      });
    } else {
      results.multiple.push({
        chat: chat.external_chat_id,
        chatId: chat.id,
        firstName,
        leads,
      });
    }
  }

  console.log("=== RESULTADOS ===\n");
  console.log(`Match unico: ${results.unique.length}`);
  console.log(`Multiplos matches: ${results.multiple.length}`);
  console.log(`Sem match: ${results.none.length}`);
  console.log(`Erro: ${results.error.length}`);

  if (results.unique.length) {
    console.log(`\n--- MATCHES UNICOS (auto-link) ---\n`);
    for (const r of results.unique) {
      console.log(`Chat: ${r.chat}`);
      console.log(`  Nome: "${r.firstName}"`);
      console.log(`  Lead: ${r.lead.nome_completo} (${r.lead.telefone}) [${r.lead.id}]`);
    }
  }

  if (results.multiple.length) {
    console.log(`\n--- MULTIPLOS MATCHES (manual) ---\n`);
    for (const r of results.multiple) {
      console.log(`Chat: ${r.chat} | Nome: "${r.firstName}"`);
      for (const l of r.leads) {
        console.log(`  -> ${l.nome_completo} (${l.telefone}) [${l.id}]`);
      }
    }
  }

  if (results.none.length) {
    console.log(`\n--- SEM MATCH ---\n`);
    for (const r of results.none) {
      console.log(`  ${r.chat}: ${r.reason}`);
    }
  }

  // Write results to file for further processing
  fs.writeFileSync(
    path.join(ROOT, "scripts", "privado-match-results.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("\nResultados salvos em scripts/privado-match-results.json");
})();
