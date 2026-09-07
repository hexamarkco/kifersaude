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
    .select("id, external_chat_id")
    .eq("display_name", "Contato privado")
    .is("merged_into_chat_id", null)
    .is("deleted_at", null);

  console.log(`=== CHATS "CONTATO PRIVADO" RESTANTES ===\n`);

  const useless = [];
  const useful = [];

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

    const outText = firstOut?.[0]?.text_content || "";
    const inText = firstIn?.[0]?.text_content || "";
    const msgCount = count || 0;

    // Classify: useless if generic "oi"/"olá" or only interactive messages
    const isGeneric = /^(oi|olá|ola|bom dia|boa tarde|boa noite)[\s!.,]*$/i.test(outText);
    const isInboundOnly = !outText && inText;
    const isInteractiveOnly = /\[Mensagem interativa\]|\[Mensagem\]/.test(inText) && !outText;

    if (isGeneric || isInboundOnly || isInteractiveOnly || msgCount <= 2) {
      useless.push({ chat, msgCount, outText: outText.substring(0, 60), inText: inText.substring(0, 60) });
    } else {
      useful.push({ chat, msgCount, outText: outText.substring(0, 60), inText: inText.substring(0, 60) });
    }
  }

  console.log(`--- INÚTEIS (${useless.length}) --- (deletar)`);
  for (const u of useless) {
    console.log(`  ${u.chat.external_chat_id} | ${u.msgCount} msgs | out: "${u.outText}" | in: "${u.inText}"`);
  }

  console.log(`\n--- COM MENSAGENS REAIS (${useful.length}) --- (manter ou analisar)`);
  for (const u of useful) {
    console.log(`  ${u.chat.external_chat_id} | ${u.msgCount} msgs | out: "${u.outText}" | in: "${u.inText}"`);
  }
})();
