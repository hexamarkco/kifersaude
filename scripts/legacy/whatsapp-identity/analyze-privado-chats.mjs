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

const APPROACH_MSG = "tudo bem? Sou a Luiza Kifer";

(async () => {
  // 1. Get all active "Contato privado" chats
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, channel_id, external_chat_id, phone_digits, phone_number, display_name, lead_id, created_at, updated_at")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Chats "Contato privado" ativos: ${privadoChats?.length || 0}\n`);

  let fromApproach = 0;
  let fromCampaign = 0;
  let unknown = 0;
  let linkable = 0;

  const results = [];

  for (const chat of (privadoChats || [])) {
    // Get the first few messages to determine the source
    const { data: msgs } = await supabase
      .from("comm_whatsapp_messages")
      .select("id, text_content, direction, message_at, message_type, external_message_id, phone_number")
      .eq("chat_id", chat.id)
      .order("message_at", { ascending: true })
      .limit(10);

    const firstOutbound = (msgs || []).find(m => m.direction === "outbound");
    const firstInbound = (msgs || []).find(m => m.direction === "inbound");
    const totalMsgs = msgs?.length || 0;

    let source = "unknown";
    let leadName = null;
    let phoneFromMsg = null;

    if (firstOutbound?.text_content?.includes(APPROACH_MSG)) {
      source = "approach_flow";
      fromApproach++;
    } else if (totalMsgs > 0) {
      source = "campaign";
      fromCampaign++;
    } else {
      unknown++;
    }

    // Try to extract phone from outbound messages (they might have phone_number field)
    for (const m of (msgs || [])) {
      if (m.phone_number && m.phone_number.trim()) {
        phoneFromMsg = m.phone_number.trim();
        break;
      }
    }

    // Try to find a matching lead by phone from message metadata
    let matchedLead = null;
    if (phoneFromMsg) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome_completo, telefone")
        .eq("telefone", phoneFromMsg)
        .limit(1)
        .single();
      if (lead) matchedLead = lead;
    }

    // Also try to find lead by the first inbound message content
    if (!matchedLead && firstInbound?.text_content) {
      // Search for leads with similar phone patterns in the message
      const phoneMatch = firstInbound.text_content.match(/(\d{10,11})/);
      if (phoneMatch) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, nome_completo, telefone")
          .eq("telefone", phoneMatch[1])
          .limit(1)
          .single();
        if (lead) matchedLead = lead;
      }
    }

    // Check if there's a phone-based chat that might be the original
    let originalPhoneChat = null;
    if (phoneFromMsg) {
      const variants = new Set([phoneFromMsg]);
      if (phoneFromMsg.startsWith("55") && phoneFromMsg.length >= 12) {
        variants.add(phoneFromMsg.slice(2));
      } else if (phoneFromMsg.length === 10 || phoneFromMsg.length === 11) {
        variants.add(`55${phoneFromMsg}`);
      }
      
      for (const v of variants) {
        const { data: pc } = await supabase
          .from("comm_whatsapp_chats")
          .select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id")
          .eq("phone_digits", v)
          .is("deleted_at", null)
          .is("merged_into_chat_id", null)
          .limit(1)
          .single();
        if (pc) { originalPhoneChat = pc; break; }
      }
    }

    if (matchedLead || originalPhoneChat) linkable++;

    results.push({
      chatId: chat.id,
      externalChatId: chat.external_chat_id,
      totalMsgs,
      source,
      firstOutboundPreview: firstOutbound?.text_content?.substring(0, 80) || null,
      firstInboundPreview: firstInbound?.text_content?.substring(0, 80) || null,
      phoneFromMsg,
      matchedLead: matchedLead ? `${matchedLead.nome_completo} (${matchedLead.telefone})` : null,
      originalPhoneChat: originalPhoneChat ? originalPhoneChat.external_chat_id : null,
      createdAt: chat.created_at,
    });
  }

  // Summary
  console.log("=== RESUMO ===\n");
  console.log(`Total: ${privadoChats?.length || 0}`);
  console.log(`Originados via fluxo de abordagem: ${fromApproach}`);
  console.log(`Originados via campanha/disparo: ${fromCampaign}`);
  console.log(`Origem desconhecida: ${unknown}`);
  console.log(`Com lead ou chat phone identificável: ${linkable}`);

  // Show linkable ones
  const linkableResults = results.filter(r => r.matchedLead || r.originalPhoneChat);
  if (linkableResults.length) {
    console.log(`\n=== CHATS LINKÁVEIS (${linkableResults.length}) ===\n`);
    for (const r of linkableResults) {
      console.log(`Chat: ${r.externalChatId} | msgs: ${r.totalMsgs} | source: ${r.source}`);
      if (r.matchedLead) console.log(`  Lead: ${r.matchedLead}`);
      if (r.originalPhoneChat) console.log(`  Phone chat original: ${r.originalPhoneChat}`);
      if (r.phoneFromMsg) console.log(`  Phone from msg: ${r.phoneFromMsg}`);
      console.log(`  Criado: ${r.createdAt}`);
      console.log("");
    }
  }

  // Show approach flow ones without leads
  const approachNoLead = results.filter(r => r.source === "approach_flow" && !r.matchedLead && !r.originalPhoneChat);
  if (approachNoLead.length) {
    console.log(`\n=== ABORDAGEM SEM LEAD IDENTIFICADO (${approachNoLead.length}) ===\n`);
    for (const r of approachNoLead.slice(0, 20)) {
      console.log(`Chat: ${r.externalChatId} | msgs: ${r.totalMsgs} | phone: ${r.phoneFromMsg || "none"}`);
      if (r.firstInboundPreview) console.log(`  Inbound: "${r.firstInboundPreview}"`);
      console.log("");
    }
  }
})();
