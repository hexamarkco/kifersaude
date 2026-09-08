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
  // 1. Search for any chat with phone 21979237553 or 5521979237553 in messages
  console.log("=== Buscando mensagens com conteudo da Alessandra ===\n");
  
  // Search messages that contain "Alessandra" or health plan content
  const { data: msgs } = await supabase
    .from("comm_whatsapp_messages")
    .select("id, chat_id, text_content, direction, message_at, message_type")
    .or("text_content.ilike.%Alessandra%,text_content.ilike.%Assim%,text_content.ilike.%quarto privado%")
    .order("message_at", { ascending: false })
    .limit(20);
  
  console.log(`Mensagens encontradas: ${msgs?.length || 0}`);
  const chatIds = new Set();
  for (const m of (msgs || [])) {
    chatIds.add(m.chat_id);
    console.log(`  [${m.message_at}] chat=${m.chat_id} dir=${m.direction} type=${m.message_type}`);
    console.log(`    "${(m.text_content || "").substring(0, 120)}..."`);
  }

  // 2. For each chat found, get the chat details
  if (chatIds.size) {
    console.log("\n=== Detalhes dos chats encontrados ===\n");
    for (const chatId of chatIds) {
      const { data: chat } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, channel_id, external_chat_id, phone_digits, phone_number, display_name, push_name, lead_id, lead_link_source, deleted_at, merged_into_chat_id, identity_conflict, created_at, updated_at")
        .eq("id", chatId)
        .single();
      if (chat) {
        console.log(`Chat: ${chat.external_chat_id}`);
        console.log(`  phone: ${chat.phone_digits || chat.phone_number || "none"}`);
        console.log(`  display: ${chat.display_name}`);
        console.log(`  push: ${chat.push_name}`);
        console.log(`  lead: ${chat.lead_id || "none"} (${chat.lead_link_source || "none"})`);
        console.log(`  deleted: ${chat.deleted_at || "no"}`);
        console.log(`  merged: ${chat.merged_into_chat_id || "no"}`);
        console.log(`  created: ${chat.created_at}`);
        console.log(`  updated: ${chat.updated_at}`);
      } else {
        console.log(`Chat ${chatId}: NAO ENCONTRADO (pode ter sido deletado)`);
      }
    }
  }

  // 3. Also search for the specific message content the user shared
  console.log("\n=== Buscando mensagem especifica 'quarto privado' ===\n");
  const { data: specificMsgs } = await supabase
    .from("comm_whatsapp_messages")
    .select("id, chat_id, text_content, direction, message_at, external_message_id")
    .ilike("text_content", "%quarto privado%")
    .order("message_at", { ascending: false })
    .limit(5);
  
  for (const m of (specificMsgs || [])) {
    console.log(`  [${m.message_at}] chat=${m.chat_id} ext_id=${m.external_message_id}`);
    console.log(`    "${(m.text_content || "").substring(0, 150)}"`);
  }

  // 4. Search for the outbound message about Klini 200
  console.log("\n=== Buscando mensagem 'Klini 200' ===\n");
  const { data: kliniMsgs } = await supabase
    .from("comm_whatsapp_messages")
    .select("id, chat_id, text_content, direction, message_at")
    .ilike("text_content", "%Klini 200%")
    .order("message_at", { ascending: false })
    .limit(5);
  
  for (const m of (kliniMsgs || [])) {
    console.log(`  [${m.message_at}] chat=${m.chat_id} dir=${m.direction}`);
    console.log(`    "${(m.text_content || "").substring(0, 150)}"`);
  }

  // 5. Check if there's a LID chat that might be the Alessandra chat
  console.log("\n=== Verificando LIDs sem telefone que podem ser da Alessandra ===\n");
  const { data: lidChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, phone_digits, display_name, push_name, lead_id, deleted_at, merged_into_chat_id")
    .or("display_name.ilike.%Contato privado%,push_name.ilike.%Alessandra%")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null)
    .limit(20);
  
  for (const c of (lidChats || [])) {
    // Count messages in each
    const { count } = await supabase.from("comm_whatsapp_messages").select("id", { count: "exact", head: true }).eq("chat_id", c.id);
    console.log(`  ${c.external_chat_id} | display: ${c.display_name} | push: ${c.push_name} | msgs: ${count} | lead: ${c.lead_id || "none"}`);
  }
})();
