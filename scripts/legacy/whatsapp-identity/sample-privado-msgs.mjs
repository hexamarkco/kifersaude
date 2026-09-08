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
  // Get a sample of "Contato privado" chats with their messages
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, phone_digits, display_name, created_at")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null)
    .order("created_at", { ascending: false })
    .limit(15);

  console.log(`Sample de ${privadoChats?.length || 0} chats "Contato privado":\n`);

  for (const chat of (privadoChats || [])) {
    const { data: msgs } = await supabase
      .from("comm_whatsapp_messages")
      .select("id, text_content, direction, message_at, message_type, phone_number, external_message_id")
      .eq("chat_id", chat.id)
      .order("message_at", { ascending: true })
      .limit(5);

    const msgCountResult = await supabase
      .from("comm_whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chat.id);

    console.log(`Chat: ${chat.external_chat_id} | created: ${chat.created_at} | total msgs: ${msgCountResult.count || 0}`);
    for (const m of (msgs || [])) {
      const preview = (m.text_content || `[${m.message_type}]`).substring(0, 100);
      console.log(`  [${m.message_at}] ${m.direction}: "${preview}"`);
      if (m.phone_number) console.log(`    phone_number field: ${m.phone_number}`);
    }
    console.log("");
  }

  // Also check: how many of these chats have messages with phone_number field set?
  console.log("\n=== Verificando campo phone_number nas mensagens ===\n");
  const { data: allPrivado } = await supabase
    .from("comm_whatsapp_chats")
    .select("id")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  let withPhoneNumber = 0;
  let withoutPhoneNumber = 0;
  const chatIds = (allPrivado || []).map(c => c.id);

  for (let i = 0; i < chatIds.length; i += 50) {
    const { data: msgsWithPhone } = await supabase
      .from("comm_whatsapp_messages")
      .select("chat_id")
      .in("chat_id", chatIds.slice(i, i + 50))
      .not("phone_number", "is", null)
      .neq("phone_number", "")
      .limit(1);

    const chatsWithPhone = new Set((msgsWithPhone || []).map(m => m.chat_id));
    withPhoneNumber += chatsWithPhone.size;
  }

  withoutPhoneNumber = chatIds.length - withPhoneNumber;
  console.log(`Chats com phone_number nas mensagens: ${withPhoneNumber}`);
  console.log(`Chats sem phone_number nas mensagens: ${withoutPhoneNumber}`);
})();
