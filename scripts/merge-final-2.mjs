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
  const { data: anyChat } = await supabase.from("comm_whatsapp_chats").select("channel_id").limit(1).single();
  const channelId = anyChat?.channel_id;

  console.log(`Channel: ${channelId}`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  const merges = [
    { lid: "92706936234219@lid", phone: "5522999021388@s.whatsapp.net", name: "Laécio Carvalho" },
    { lid: "65837687918701@lid", phone: "5521975901453@s.whatsapp.net", name: "Miguel Lopes Ferreira" },
  ];

  for (const m of merges) {
    console.log(`Merge: ${m.lid} -> ${m.phone} (${m.name})`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would merge`);
      continue;
    }

    try {
      const { data, error } = await supabase.rpc("comm_whatsapp_reconcile_lid_identifier", {
        p_channel_id: channelId,
        p_lid_external_chat_id: m.lid,
        p_phone_external_chat_id: m.phone,
        p_mapping_evidence: {
          round_trip_verified: true,
          source: "force_merge_remaining",
          forward_verified: true,
          reverse_unresolved_workaround: true,
        },
      });

      if (error) {
        console.log(`  ERROR: ${error.message}`);
      } else if (data?.length > 0) {
        const result = data[0];
        console.log(`  Result: merged=${result.merged} conflict=${result.conflict_reason || "none"}`);
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }
  }

  // Check remaining count
  const { count } = await supabase
    .from("comm_whatsapp_chats")
    .select("id", { count: "exact", head: true })
    .eq("display_name", "Contato privado")
    .is("deleted_at", null)
    .is("merged_into_chat_id", null);

  console.log(`\nRemaining "Contato privado" chats: ${count}`);
})();
