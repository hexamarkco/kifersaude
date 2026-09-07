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
  // Check: how many "Contato privado" chats have messages pointing to OTHER chats?
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Total chats "Contato privado": ${privadoChats?.length || 0}\n`);

  let orphanCount = 0;
  let linkedCount = 0;
  const orphans = [];

  for (const chat of (privadoChats || [])) {
    // Get distinct chat_ids from messages in this chat
    const { data: msgChatIds } = await supabase
      .from("comm_whatsapp_messages")
      .select("chat_id")
      .eq("chat_id", chat.id)
      .limit(1);

    if (!msgChatIds?.length) {
      // No messages at all
      continue;
    }

    // Check if messages point to a different chat
    const { data: otherChatMsgs } = await supabase
      .from("comm_whatsapp_messages")
      .select("chat_id")
      .eq("chat_id", chat.id)
      .neq("chat_id", chat.id)
      .limit(1);

    if (otherChatMsgs?.length) {
      // Messages point to a different chat!
      orphanCount++;
      
      // Get the target chat
      const targetChatId = otherChatMsgs[0].chat_id;
      const { data: targetChat } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id")
        .eq("id", targetChatId)
        .single();

      orphans.push({
        lidChat: chat.external_chat_id,
        targetChatId,
        targetChat: targetChat ? `${targetChat.external_chat_id} (${targetChat.display_name})` : "DELETED/MISSING",
        targetDeleted: targetChat?.deleted_at || null,
        targetMerged: targetChat?.merged_into_chat_id || null,
        targetLead: targetChat?.lead_id || null,
      });
    } else {
      linkedCount++;
    }
  }

  console.log(`Chats com mensagens apontando para OUTRO chat: ${orphanCount}`);
  console.log(`Chats com mensagens consistentes: ${linkedCount}`);

  if (orphans.length) {
    console.log(`\n=== ORFÃOS (mensagens em chat diferente) ===\n`);
    for (const o of orphans) {
      console.log(`LID chat: ${o.lidChat}`);
      console.log(`  Target: ${o.targetChat}`);
      console.log(`  Target deleted: ${o.targetDeleted || "no"}`);
      console.log(`  Target merged: ${o.targetMerged || "no"}`);
      console.log(`  Target lead: ${o.targetLead || "none"}`);
      console.log("");
    }
  }
})();
