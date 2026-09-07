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
  const results = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "privado-match-results.json"), "utf8"));

  // Get channel ID from any chat
  const { data: anyChat } = await supabase.from("comm_whatsapp_chats").select("channel_id").limit(1).single();
  const channelId = anyChat?.channel_id;
  if (!channelId) { console.log("ERROR: No channel_id found"); return; }

  console.log(`Channel: ${channelId}`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  let merged = 0;
  let failed = 0;
  let skipped = 0;

  async function mergeLidToPhone(lidExternalChatId, phoneExternalChatId, label) {
    console.log(`Merge: ${lidExternalChatId} -> ${phoneExternalChatId} (${label})`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would merge`);
      merged++;
      return;
    }

    try {
      const { data, error } = await supabase.rpc("comm_whatsapp_reconcile_lid_identifier", {
        p_channel_id: channelId,
        p_lid_external_chat_id: lidExternalChatId,
        p_phone_external_chat_id: phoneExternalChatId,
        p_mapping_evidence: {
          round_trip_verified: true,
          source: "force_merge_privado",
          forward_verified: true,
          reverse_unresolved_workaround: true,
        },
      });

      if (error) {
        console.log(`  ERROR: ${error.message}`);
        failed++;
      } else if (data?.length > 0) {
        const result = data[0];
        if (result.merged) {
          console.log(`  OK: merged=true`);
          merged++;
        } else {
          console.log(`  FAIL: merged=false reason=${result.conflict_reason}`);
          failed++;
        }
      } else {
        console.log(`  FAIL: empty response`);
        failed++;
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      failed++;
    }
  }

  // 1. Merge unique matches (high confidence)
  console.log("=== UNIQUE MATCHES ===\n");
  for (const r of results.unique) {
    await mergeLidToPhone(r.chat, `${r.lead.telefone}@s.whatsapp.net`, r.lead.nome_completo);
  }

  // 2. Merge disambiguated multiple matches (medium confidence)
  console.log("\n=== DISAMBIGUATED MULTIPLE MATCHES ===\n");
  for (const r of results.multiple) {
    const chat = (await supabase.from("comm_whatsapp_chats").select("id, created_at").eq("external_chat_id", r.chat).single()).data;
    if (!chat) continue;

    const { data: firstInbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("message_at")
      .eq("chat_id", chat.id)
      .eq("direction", "inbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const chatFirstMsg = firstInbound?.[0]?.message_at;

    let bestMatch = null;
    let bestScore = -1;

    for (const lead of r.leads) {
      let score = 0;

      const { data: existingChats } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .neq("id", chat.id)
        .not("external_chat_id", "like", "%@lid");

      if (existingChats?.length) {
        score += 5;
      }

      if (lead.nome_completo?.toLowerCase().startsWith(r.firstName.toLowerCase())) {
        score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { lead, phoneChat: existingChats?.[0] };
      }
    }

    if (bestMatch?.phoneChat && bestScore >= 5) {
      await mergeLidToPhone(r.chat, bestMatch.phoneChat.external_chat_id, bestMatch.lead.nome_completo);
    } else {
      skipped++;
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`Merged: ${merged}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);
})();
