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
  // Get all "Contato privado" chat IDs
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  const chatIds = (privadoChats || []).map(c => c.id);
  console.log(`Total chats "Contato privado": ${chatIds.length}\n`);

  // Check campaign_targets for these chats
  console.log("=== Verificando campaign_targets ===\n");
  let withTarget = 0;
  for (let i = 0; i < chatIds.length; i += 50) {
    const { data: targets } = await supabase
      .from("comm_whatsapp_campaign_targets")
      .select("chat_id, phone_number, lead_id, campaign_id")
      .in("chat_id", chatIds.slice(i, i + 50));

    for (const t of (targets || [])) {
      withTarget++;
      const chat = (privadoChats || []).find(c => c.id === t.chat_id);
      console.log(`  Chat: ${chat?.external_chat_id} | phone: ${t.phone_number} | lead: ${t.lead_id || "none"} | campaign: ${t.campaign_id}`);
    }
  }
  console.log(`\nChats com campaign_target: ${withTarget}`);

  // Check auto_contact_flow_jobs for these chats
  console.log("\n=== Verificando auto_contact_flow_jobs ===\n");
  let withFlowJob = 0;
  for (let i = 0; i < chatIds.length; i += 50) {
    const { data: jobs } = await supabase
      .from("auto_contact_flow_jobs")
      .select("chat_id, lead_id, phone_number, status")
      .in("chat_id", chatIds.slice(i, i + 50));

    for (const j of (jobs || [])) {
      withFlowJob++;
      const chat = (privadoChats || []).find(c => c.id === j.chat_id);
      console.log(`  Chat: ${chat?.external_chat_id} | phone: ${j.phone_number} | lead: ${j.lead_id || "none"} | status: ${j.status}`);
    }
  }
  console.log(`\nChats com flow_job: ${withFlowJob}`);

  // Check leads that might match by name in message content
  console.log("\n=== Verificando leads por nome nas mensagens ===\n");
  let foundByContent = 0;

  for (const chat of (privadoChats || []).slice(0, 20)) {
    // Get first inbound message
    const { data: inbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "inbound")
      .order("message_at", { ascending: true })
      .limit(1);

    if (!inbound?.length || !inbound[0].text_content) continue;

    // Get first outbound message (might contain the lead's first name)
    const { data: outbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "outbound")
      .order("message_at", { ascending: true })
      .limit(1);

    if (!outbound?.length || !outbound[0].text_content) continue;

    // Extract first name from outbound message "Oi {name}, tudo bem?"
    const nameMatch = outbound[0].text_content.match(/Oi\s+([^,]+),/i);
    if (nameMatch) {
      const firstName = nameMatch[1].trim();
      // Search for leads with this first name
      const { data: leads } = await supabase
        .from("leads")
        .select("id, nome_completo, telefone")
        .ilike("nome_completo", `%${firstName}%`)
        .limit(3);

      if (leads?.length) {
        foundByContent++;
        console.log(`Chat: ${chat.external_chat_id}`);
        console.log(`  First name from outbound: "${firstName}"`);
        for (const l of leads) {
          console.log(`  Lead: ${l.nome_completo} (${l.telefone})`);
        }
        console.log("");
      }
    }
  }
  console.log(`\nChats com lead identificado por conteudo: ${foundByContent}`);
})();
