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
  const channelId = "d7fee56f-3f2a-46cd-aec0-cf7ee5e7072c";
  const lidExternal = "111321358057561@lid";
  const phoneExternal = "5521971447031@s.whatsapp.net";

  console.log(`Merging LID ${lidExternal} into phone ${phoneExternal}...`);

  const { data, error } = await supabase.rpc("comm_whatsapp_reconcile_lid_identifier", {
    p_channel_id: channelId,
    p_lid_external_chat_id: lidExternal,
    p_phone_external_chat_id: phoneExternal,
    p_mapping_evidence: {
      round_trip_verified: true,
      source: "manual_fix_alessandra",
      forward_verified: true,
      reverse_unresolved_workaround: true,
    },
  });

  if (error) {
    console.log("ERRO:", error.message);
  } else {
    console.log("RESULT:", JSON.stringify(data, null, 2));
  }
})();
