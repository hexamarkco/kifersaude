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

const phone = process.argv[2];

(async () => {
  if (!phone) {
    console.log("Usage: node check-chat-state.mjs <phone_digits>");
    return;
  }

  // Search for chats with this phone
  const { data: chats } = await supabase
    .from("comm_whatsapp_chats")
    .select("id, channel_id, external_chat_id, phone_digits, phone_number, display_name, push_name, lead_id, lead_link_source, deleted_at, merged_into_chat_id, identity_conflict")
    .or(`phone_digits.eq.${phone},phone_number.eq.${phone}`);

  console.log(`Chats with phone ${phone}:`, chats?.length || 0);
  for (const c of (chats || [])) {
    console.log(`\n  ID: ${c.id}`);
    console.log(`  external_chat_id: ${c.external_chat_id}`);
    console.log(`  phone_digits: ${c.phone_digits}`);
    console.log(`  phone_number: ${c.phone_number}`);
    console.log(`  display_name: ${c.display_name}`);
    console.log(`  push_name: ${c.push_name}`);
    console.log(`  lead_id: ${c.lead_id || "none"}`);
    console.log(`  lead_link_source: ${c.lead_link_source || "none"}`);
    console.log(`  deleted_at: ${c.deleted_at || "no"}`);
    console.log(`  merged_into_chat_id: ${c.merged_into_chat_id || "no"}`);
    console.log(`  identity_conflict: ${c.identity_conflict}`);
  }

  // Also search by phone lookup keys
  const digits = phone.replace(/\D/g, "");
  const variants = new Set([digits]);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    variants.add(digits.slice(2));
  } else if (digits.length === 10 || digits.length === 11) {
    variants.add(`55${digits}`);
  }

  console.log(`\nSearching by variants: ${[...variants].join(", ")}`);
  for (const v of variants) {
    const { data } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id, phone_digits, display_name, lead_id, deleted_at, merged_into_chat_id")
      .eq("phone_digits", v);
    if (data?.length) {
      console.log(`  Variant ${v}: ${data.length} chat(s)`);
      for (const c of data) {
        console.log(`    ${c.external_chat_id} | display: ${c.display_name} | lead: ${c.lead_id || "none"} | merged: ${c.merged_into_chat_id || "no"}`);
      }
    }
  }
})();
