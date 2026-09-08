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

const query = process.argv[2] || "privados";

(async () => {
  if (query === "alessandra") {
    const { data: leads } = await supabase.from("leads").select("id, nome_completo, telefone, email").ilike("nome_completo", "%alessandra%");
    console.log("Leads Alessandra:", JSON.stringify(leads, null, 2));
  } else if (query === "privados") {
    const { data: chats } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id, phone_digits, display_name, lead_id, lead_link_source, deleted_at, merged_into_chat_id")
      .eq("display_name", "Contato privado")
      .is("deleted_at", null)
      .is("merged_into_chat_id", null);
    console.log("Chats 'Contato privado' (ativos, nao mesclados):", chats?.length || 0);
    for (const c of (chats || [])) {
      console.log(" -", c.external_chat_id, "| phone:", c.phone_digits, "| lead:", c.lead_id || "none", "| source:", c.lead_link_source || "none");
    }
  } else if (query === "leads-sem-chat") {
    const { data: leads } = await supabase.from("leads").select("id, nome_completo, telefone").ilike("nome_completo", "%alessandra%");
    if (!leads?.length) { console.log("Nenhum lead Alessandra encontrado"); return; }
    for (const lead of leads) {
      const { data: chats } = await supabase.from("comm_whatsapp_chats").select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id").eq("lead_id", lead.id);
      console.log(`\nLead: ${lead.nome_completo} (${lead.telefone})`);
      console.log("  Chats vinculados:", chats?.length || 0);
      for (const c of (chats || [])) {
        console.log("  -", c.external_chat_id, "| display:", c.display_name, "| merged:", c.merged_into_chat_id || "no", "| deleted:", c.deleted_at || "no");
      }
    }
  }
})();
