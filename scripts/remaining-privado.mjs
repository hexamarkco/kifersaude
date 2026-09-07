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
    .select("id, external_chat_id, phone_digits, display_name, created_at")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null)
    .order("created_at", { ascending: false });

  console.log(`Chats "Contato privado" restantes: ${chats?.length || 0}\n`);

  for (const chat of (chats || [])) {
    const { count } = await supabase
      .from("comm_whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chat.id);

    const { data: firstOut } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "outbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const { data: firstIn } = await supabase
      .from("comm_whatsapp_messages")
      .select("text_content")
      .eq("chat_id", chat.id)
      .eq("direction", "inbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const outPreview = firstOut?.[0]?.text_content?.substring(0, 80) || "(none)";
    const inPreview = firstIn?.[0]?.text_content?.substring(0, 80) || "(none)";

    console.log(`Chat: ${chat.external_chat_id}`);
    console.log(`  Created: ${chat.created_at}`);
    console.log(`  Messages: ${count || 0}`);
    console.log(`  First outbound: "${outPreview}"`);
    console.log(`  First inbound: "${inPreview}"`);
    console.log("");
  }
})();
