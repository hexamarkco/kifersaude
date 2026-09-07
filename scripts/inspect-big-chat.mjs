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
  // Get a chat with many messages
  const { data: bigChat } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, phone_digits, display_name, created_at")
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!bigChat) { console.log("No chat found"); return; }

  console.log(`Chat: ${bigChat.external_chat_id} | created: ${bigChat.created_at}\n`);

  // Get ALL messages
  const { data: msgs } = await supabase
    .from("comm_whatsapp_messages")
    .select("*")
    .eq("chat_id", bigChat.id)
    .order("message_at", { ascending: true })
    .limit(30);

  console.log(`Total messages: ${msgs?.length || 0}\n`);

  for (const m of (msgs || [])) {
    console.log(`[${m.message_at}] ${m.direction} | type: ${m.message_type}`);
    console.log(`  text_content: "${(m.text_content || "").substring(0, 150)}"`);
    console.log(`  media_caption: "${(m.media_caption || "").substring(0, 100)}"`);
    console.log(`  phone_number: ${m.phone_number || "null"}`);
    console.log(`  external_message_id: ${m.external_message_id || "null"}`);
    console.log(`  delivery_status: ${m.delivery_status}`);
    console.log(`  chat_id: ${m.chat_id}`);
    console.log("");
  }

  // Also check: what's the first outbound message's external_message_id pattern?
  const firstOut = (msgs || []).find(m => m.direction === "outbound");
  if (firstOut) {
    console.log(`\nFirst outbound external_message_id: ${firstOut.external_message_id}`);
    console.log(`Pattern analysis: ${firstOut.external_message_id?.includes("_") ? "contains underscore (likely Whapi format)" : "no underscore"}`);
  }
})();
