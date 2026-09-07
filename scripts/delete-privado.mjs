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

const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  console.log(`Dry run: ${DRY_RUN}\n`);

  // Get all "Contato privado" chats that are NOT merged and NOT deleted
  const { data: chats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, external_chat_id, display_name, deleted_at, merged_into_chat_id")
    .eq("display_name", "Contato privado")
    .is("merged_into_chat_id", null)
    .is("deleted_at", null);

  console.log(`Chats to delete: ${chats?.length || 0}\n`);

  let deleted = 0;
  let failed = 0;

  for (const chat of (chats || [])) {
    console.log(`Delete: ${chat.external_chat_id}`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would delete`);
      deleted++;
      continue;
    }

    // Use service role to bypass permission check
    const { error } = await supabase
      .from("comm_whatsapp_chats")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", chat.id)
      .is("deleted_at", null);

    if (error) {
      console.log(`  ERROR: ${error.message}`);
      failed++;
    } else {
      console.log(`  OK`);
      deleted++;
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);

  // Check remaining
  const { count } = await supabase
    .from("comm_whatsapp_chats")
    .select("id", { count: "exact", head: true })
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`Remaining "Contato privado" chats: ${count}`);
})();
