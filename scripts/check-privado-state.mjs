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
  // Check remaining "Contato privado" chats
  const { data: privadoChats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, deleted_at, merged_into_chat_id, lead_id, display_name")
    .eq("display_name", "Contato privado")
    .is("merged_into_chat_id", null);

  console.log(`Remaining "Contato privado" chats: ${privadoChats?.length || 0}\n`);

  for (const chat of (privadoChats || [])) {
    console.log(`Chat: ${chat.external_chat_id}`);
    console.log(`  deleted_at: ${chat.deleted_at || "null"}`);
    console.log(`  merged_into_chat_id: ${chat.merged_into_chat_id || "null"}`);
    console.log(`  lead_id: ${chat.lead_id || "null"}`);
  }

  // Also check if there are any "Contato privado" chats that ARE merged
  const { count: mergedCount } = await supabase
    .from("comm_whatsapp_chats")
    .select("id", { count: "exact", head: true })
    .eq("display_name", "Contato privado")
    .not("merged_into_chat_id", "is", null);

  console.log(`\n"Contato privado" chats already merged: ${mergedCount}`);

  // Check if there are chats with merged_into_chat_id pointing to non-existent chats
  const { data: orphans } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, merged_into_chat_id")
    .eq("display_name", "Contato privado")
    .not("merged_into_chat_id", "is", null);

  if (orphans?.length) {
    console.log(`\nChecking merged chats...`);
    for (const chat of orphans) {
      const { data: target } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id, deleted_at")
        .eq("id", chat.merged_into_chat_id)
        .single();

      if (!target) {
        console.log(`  ORPHAN: ${chat.external_chat_id} -> MERGED_TARGET_MISSING (${chat.merged_into_chat_id})`);
      } else if (target.deleted_at) {
        console.log(`  ORPHAN: ${chat.external_chat_id} -> ${target.external_chat_id} (TARGET DELETED)`);
      }
    }
  }
})();
