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
  const { data: chats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Remaining "Contato privado" chats: ${chats?.length || 0}\n`);

  for (const chat of (chats || [])) {
    const { data: outbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "outbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const text = outbound?.[0]?.text_content || "";
    if (!text) continue;

    // Better regex: handle "Oi, Name," and "Oi Name," and "Oi Name " etc.
    const nameMatch = text.match(/Oi[,\s]+([A-Za-zÀ-ÿ]+)[,\s!]/i)
      || text.match(/Boa\s+(?:tarde|noite|manhã)[,\s]+([A-Za-zÀ-ÿ]+)[,\s!]/i)
      || text.match(/^([A-Za-zÀ-ÿ]+),\s/);

    if (!nameMatch) continue;

    const firstName = nameMatch[1].trim();

    // Search for leads
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nome_completo, telefone, created_at")
      .or(`nome_completo.ilike.${firstName}%,nome_completo.ilike.% ${firstName}%`)
      .limit(5);

    if (!leads?.length) {
      console.log(`${chat.external_chat_id}: "${firstName}" - NO LEADS FOUND`);
      continue;
    }

    // Check if any lead already has a phone chat
    const leadsWithChats = [];
    for (const lead of leads) {
      const { data: existingChats } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .not("external_chat_id", "like", "%@lid");

      if (existingChats?.length) {
        leadsWithChats.push({ lead, phoneChat: existingChats[0] });
      }
    }

    if (leadsWithChats.length === 1) {
      const { lead, phoneChat } = leadsWithChats[0];
      console.log(`${chat.external_chat_id}: "${firstName}" -> ${lead.nome_completo} (${lead.telefone}) [${phoneChat.external_chat_id}]`);
    } else if (leadsWithChats.length > 1) {
      console.log(`${chat.external_chat_id}: "${firstName}" - MULTIPLE LEADS WITH CHATS:`);
      for (const { lead, phoneChat } of leadsWithChats) {
        console.log(`  -> ${lead.nome_completo} (${lead.telefone}) [${phoneChat.external_chat_id}]`);
      }
    } else {
      console.log(`${chat.external_chat_id}: "${firstName}" - ${leads.length} leads found but NONE have phone chats`);
    }
  }
})();
