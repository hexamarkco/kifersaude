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
  // Search for all leads that have NO chat linked
  const { data: leadsWithChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("lead_id")
    .not("lead_id", "is", null)
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  const linkedLeadIds = new Set((leadsWithChats || []).map(c => c.lead_id).filter(Boolean));
  console.log(`Leads com chat vinculado: ${linkedLeadIds.size}`);

  // Get all leads
  const { data: allLeads } = await supabase.from("leads").select("id, nome_completo, telefone, arquivado");
  const unlinked = (allLeads || []).filter(l => !linkedLeadIds.has(l.id) && !l.arquivado);
  console.log(`Leads SEM chat vinculado (nao arquivados): ${unlinked.length}`);
  
  for (const l of unlinked.slice(0, 20)) {
    console.log(`  ${l.nome_completo} | ${l.telefone}`);
  }

  // Check total chats with 'Contato privado' that are active (not merged, not deleted)
  const { count: totalPrivado } = await supabase
    .from("comm_whatsapp_chats")
    .select("id", { count: "exact", head: true })
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);
  console.log(`\nTotal chats "Contato privado" ativos: ${totalPrivado}`);

  // Check how many have messages
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  if (privadoChats?.length) {
    const chatIds = privadoChats.map(c => c.id);
    let totalMessages = 0;
    for (let i = 0; i < chatIds.length; i += 50) {
      const { count } = await supabase
        .from("comm_whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .in("chat_id", chatIds.slice(i, i + 50));
      totalMessages += count || 0;
    }
    console.log(`Total mensagens nesses chats: ${totalMessages}`);
  }
})();
