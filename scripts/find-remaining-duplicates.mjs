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

function phoneLookupKeys(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return [];
  const keys = new Set([digits]);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    keys.add(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    keys.add(`55${digits}`);
  }
  return [...keys];
}

(async () => {
  // Get all active "Contato privado" chats
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, channel_id, external_chat_id, phone_digits, phone_number, display_name, lead_id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Chats "Contato privado" ativos: ${privadoChats?.length || 0}`);

  // Get all active phone-based chats
  const { data: phoneChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, channel_id, external_chat_id, phone_digits, phone_number, display_name, lead_id")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null)
    .not("phone_digits", "is", null)
    .neq("phone_digits", "");

  // Build phone index
  const phoneToChat = new Map();
  for (const chat of (phoneChats || [])) {
    for (const key of phoneLookupKeys(chat.phone_digits || chat.phone_number)) {
      phoneToChat.set(`${chat.channel_id}:${key}`, chat);
    }
  }

  let mergeableCount = 0;
  let mergeable = [];

  for (const lidChat of (privadoChats || [])) {
    // These LID chats don't have phone_digits, so we can't match them
    // But we can check if any phone chat has a matching LID identifier
    const { data: identifiers } = await supabase
      .from("comm_whatsapp_chat_identifiers")
      .select("external_chat_id, chat_id")
      .eq("chat_id", lidChat.id)
      .eq("identifier_kind", "lid");

    // Check if any phone chat has this LID as an identifier
    for (const id of (identifiers || [])) {
      const { data: phoneId } = await supabase
        .from("comm_whatsapp_chat_identifiers")
        .select("chat_id, external_chat_id")
        .eq("external_chat_id", id.external_chat_id)
        .neq("chat_id", lidChat.id)
        .limit(1);

      if (phoneId?.length) {
        const { data: phoneChat } = await supabase
          .from("comm_whatsapp_chats")
          .select("id, external_chat_id, phone_digits, display_name, lead_id")
          .eq("id", phoneId[0].chat_id)
          .single();

        if (phoneChat && !phoneChat.deleted_at && !phoneChat.merged_into_chat_id) {
          mergeableCount++;
          mergeable.push({ lidChat, phoneChat, identifier: id.external_chat_id });
        }
      }
    }
  }

  console.log(`\nChats "Contato privado" com chat phone correspondente: ${mergeableCount}`);

  for (const { lidChat, phoneChat, identifier } of mergeable) {
    console.log(`\n  LID: ${lidChat.external_chat_id} (msgs: ?)`);
    console.log(`  Phone: ${phoneChat.external_chat_id} | display: ${phoneChat.display_name} | lead: ${phoneChat.lead_id || "none"}`);
    console.log(`  Identifier: ${identifier}`);
  }

  // Also check via messages - find "Contato privado" chats that have the same outbound messages as phone chats
  console.log("\n\n=== Verificando duplicatas via mensagens ===\n");
  
  let duplicateByMessage = 0;
  for (const lidChat of (privadoChats || [])) {
    // Get outbound messages with external IDs
    const { data: lidMsgs } = await supabase
      .from("comm_whatsapp_messages")
      .select("external_message_id")
      .eq("chat_id", lidChat.id)
      .eq("direction", "outbound")
      .not("external_message_id", "is", null)
      .limit(5);

    if (!lidMsgs?.length) continue;

    // Check if these same messages exist in another chat
    for (const msg of lidMsgs) {
      const { data: dupes } = await supabase
        .from("comm_whatsapp_messages")
        .select("chat_id")
        .eq("external_message_id", msg.external_message_id)
        .neq("chat_id", lidChat.id)
        .limit(1);

      if (dupes?.length) {
        const { data: otherChat } = await supabase
          .from("comm_whatsapp_chats")
          .select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id")
          .eq("id", dupes[0].chat_id)
          .single();

        if (otherChat && !otherChat.deleted_at && !otherChat.merged_into_chat_id) {
          duplicateByMessage++;
          console.log(`  DUPLICATA: LID ${lidChat.external_chat_id} ↔ Phone ${otherChat.external_chat_id} (${otherChat.display_name})`);
          break;
        }
      }
    }
    if (duplicateByMessage > 20) break;
  }

  console.log(`\nTotal de duplicatas encontradas via mensagens: ${duplicateByMessage}`);
})();
