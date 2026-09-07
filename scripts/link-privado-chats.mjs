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

  console.log("=== LINKING UNIQUE MATCHES ===\n");
  console.log(`Dry run: ${DRY_RUN}\n`);

  let linked = 0;
  for (const r of results.unique) {
    const chat = (await supabase.from("comm_whatsapp_chats").select("id, display_name").eq("external_chat_id", r.chat).single()).data;
    if (!chat) { console.log(`SKIP ${r.chat}: chat not found`); continue; }

    console.log(`Chat ${r.chat} -> Lead ${r.lead.nome_completo} (${r.lead.telefone})`);

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("comm_whatsapp_chats")
        .update({
          lead_id: r.lead.id,
          display_name: r.lead.nome_completo,
        })
        .eq("id", chat.id);

      if (error) {
        console.log(`  ERROR: ${error.message}`);
      } else {
        console.log(`  OK`);
        linked++;
      }
    } else {
      console.log(`  [DRY RUN] Would update: lead_id=${r.lead.id}, display_name="${r.lead.nome_completo}"`);
      linked++;
    }
  }

  console.log(`\nTotal linked: ${linked}/${results.unique.length}`);

  // Now try to disambiguate multiple matches
  console.log("\n=== DISAMBIGUATING MULTIPLE MATCHES ===\n");

  for (const r of results.multiple) {
    const chat = (await supabase.from("comm_whatsapp_chats").select("id, display_name, created_at").eq("external_chat_id", r.chat).single()).data;
    if (!chat) continue;

    // Get first inbound message date
    const { data: firstInbound } = await supabase
      .from("comm_whatsapp_messages")
      .select("message_at")
      .eq("chat_id", chat.id)
      .eq("direction", "inbound")
      .order("message_at", { ascending: true })
      .limit(1);

    const chatFirstMsg = firstInbound?.[0]?.message_at;

    // Try to narrow down by checking if lead has a phone-based chat
    let bestMatch = null;
    let bestScore = -1;

    for (const lead of r.leads) {
      let score = 0;

      // Check if lead has any existing chat
      const { data: existingChats } = await supabase
        .from("comm_whatsapp_chats")
        .select("id, external_chat_id, created_at")
        .eq("lead_id", lead.id)
        .is("deleted_at", null);

      if (existingChats?.length) {
        // Lead already has a chat - this LID chat might not be for this lead
        score -= 10;
      }

      // Check if lead was created around the same time
      if (lead.created_at && chatFirstMsg) {
        const leadDate = new Date(lead.created_at);
        const msgDate = new Date(chatFirstMsg);
        const diffHours = Math.abs(leadDate - msgDate) / (1000 * 60 * 60);
        if (diffHours < 24) score += 5;
        if (diffHours < 72) score += 2;
      }

      // Check if lead name matches more closely
      if (lead.nome_completo?.toLowerCase().startsWith(r.firstName.toLowerCase())) {
        score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = lead;
      }
    }

    if (bestMatch && bestScore > 0) {
      console.log(`Chat ${r.chat}: Best match = ${bestMatch.nome_completo} (score: ${bestScore})`);

      if (!DRY_RUN) {
        const { error } = await supabase
          .from("comm_whatsapp_chats")
          .update({
            lead_id: bestMatch.id,
            display_name: bestMatch.nome_completo,
          })
          .eq("id", chat.id);

        if (error) {
          console.log(`  ERROR: ${error.message}`);
        } else {
          console.log(`  OK`);
        }
      }
    } else {
      console.log(`Chat ${r.chat}: Cannot disambiguate (best score: ${bestScore})`);
      console.log(`  Candidates:`);
      for (const l of r.leads) {
        console.log(`    ${l.nome_completo} (${l.telefone})`);
      }
    }
  }
})();
