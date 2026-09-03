#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const APPLY = process.argv.includes("--apply");
const CHAT_ID = process.argv.find((arg) => arg.startsWith("--chat="))?.split("=")[1];
const LIMIT = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || "10");
const TOKEN_ARG = process.argv.find((arg) => arg.startsWith("--token="))?.split("=")[1];

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

function toTrimmedString(value) {
  return String(value ?? "").trim();
}

function normalizeDigits(value) {
  return toTrimmedString(value).replace(/\D/g, "");
}

function extractWhapiMessageId(message) {
  if (!message || typeof message !== "object") return "";
  return toTrimmedString(message.id) || toTrimmedString(message.message_id);
}

function extractWhapiMediaMeta(message) {
  if (!message || typeof message !== "object") return {};
  const type = toTrimmedString(message.type).toLowerCase();
  const mediaMeta = {};

  if (type === "image" && message.image) {
    mediaMeta.mediaId = toTrimmedString(message.image.id) || toTrimmedString(message.image.file);
    mediaMeta.mediaMimeType = toTrimmedString(message.image.mime_type);
    mediaMeta.mediaFileName = toTrimmedString(message.image.file);
    if (message.image.caption) mediaMeta.mediaCaption = toTrimmedString(message.image.caption);
  } else if (type === "video" && message.video) {
    mediaMeta.mediaId = toTrimmedString(message.video.id) || toTrimmedString(message.video.file);
    mediaMeta.mediaMimeType = toTrimmedString(message.video.mime_type);
    mediaMeta.mediaFileName = toTrimmedString(message.video.file);
    if (message.video.caption) mediaMeta.mediaCaption = toTrimmedString(message.video.caption);
  } else if (type === "audio" || type === "voice") {
    const audio = message.audio || message.voice || {};
    mediaMeta.mediaId = toTrimmedString(audio.id) || toTrimmedString(audio.file);
    mediaMeta.mediaMimeType = toTrimmedString(audio.mime_type);
    if (audio.duration) mediaMeta.mediaDurationSeconds = Number(audio.duration);
  } else if (type === "document" && message.document) {
    mediaMeta.mediaId = toTrimmedString(message.document.id) || toTrimmedString(message.document.file);
    mediaMeta.mediaMimeType = toTrimmedString(message.document.mime_type);
    mediaMeta.mediaFileName = toTrimmedString(message.document.file_name) || toTrimmedString(message.document.file);
    if (message.document.caption) mediaMeta.mediaCaption = toTrimmedString(message.document.caption);
    if (message.document.file_length) mediaMeta.mediaSizeBytes = Number(message.document.file_length);
  } else if (type === "sticker" && message.sticker) {
    mediaMeta.mediaId = toTrimmedString(message.sticker.id) || toTrimmedString(message.sticker.file);
    mediaMeta.mediaMimeType = toTrimmedString(message.sticker.mime_type);
  }

  return mediaMeta;
}

function summarizeWhapiMessage(message) {
  if (!message || typeof message !== "object") return "[Mensagem]";
  const type = toTrimmedString(message.type).toLowerCase();
  const mediaMeta = extractWhapiMediaMeta(message);

  const readBody = (obj) => {
    if (!obj || typeof obj !== "object") return "";
    return toTrimmedString(obj.text) || toTrimmedString(obj.body) || "";
  };

  const textBody = readBody(message.text);
  if (textBody) return textBody;

  const linkPreviewBody = readBody(message.link_preview);
  if (linkPreviewBody) return linkPreviewBody;

  if (mediaMeta.mediaCaption) return mediaMeta.mediaCaption;

  switch (type) {
    case "image": return "[Imagem]";
    case "video": case "gif": case "short": return "[Video]";
    case "audio": case "voice": return "[Audio]";
    case "document": return "[Documento]";
    case "location": case "live_location": return "[Localizacao]";
    case "sticker": return "[Sticker]";
    case "contact": case "contact_list": return "[Contato]";
    case "poll": return "[Enquete]";
    default: return "[Mensagem]";
  }
}

function unixTimestampToIso(timestamp) {
  const num = Number(timestamp);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (num > 1e12) return new Date(num).toISOString();
  return new Date(num * 1000).toISOString();
}

async function fetchWhapiChatMessages(token, chatId) {
  const allMessages = [];
  let offset = 0;
  const count = 100;

  while (true) {
    const url = `https://gate.whapi.cloud/messages/list/${encodeURIComponent(chatId)}?count=${count}&offset=${offset}&sort=desc`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (!response.ok) break;

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    allMessages.push(...messages);
    if (messages.length < count) break;
    offset += messages.length;
  }

  return allMessages;
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let whapiToken = TOKEN_ARG || "";

  if (!whapiToken) {
    const tokenFile = path.join(ROOT, ".whapi-token");
    if (fs.existsSync(tokenFile)) {
      whapiToken = fs.readFileSync(tokenFile, "utf8").trim();
    }
  }

  if (!whapiToken) {
    const { data: settings } = await supabase
      .from("integration_settings")
      .select("settings")
      .eq("slug", "whatsapp_auto_contact")
      .single();

    if (settings?.settings && typeof settings.settings === "object") {
      whapiToken = settings.settings.token || "";
    }
  }

  if (!whapiToken) {
    console.error("No Whapi token found. Provide --token=xxx or create .whapi-token file");
    process.exit(1);
  }

  const { data: channel } = await supabase
    .from("comm_whatsapp_channels")
    .select("id")
    .eq("slug", "primary")
    .single();

  if (!channel) {
    console.error("No primary WhatsApp channel found");
    process.exit(1);
  }

  let chats;
  if (CHAT_ID) {
    const { data } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id")
      .eq("channel_id", channel.id)
      .eq("id", CHAT_ID)
      .single();
    chats = data ? [data] : [];
  } else {
    const { data } = await supabase
      .from("comm_whatsapp_chats")
      .select("id, external_chat_id")
      .eq("channel_id", channel.id)
      .order("last_message_at", { ascending: false })
      .limit(LIMIT);
    chats = data || [];
  }

  console.log(`Found ${chats.length} chats to check`);

  let totalRecovered = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const chat of chats) {
    const externalChatId = toTrimmedString(chat.external_chat_id);
    if (!externalChatId) continue;

    const { count: existingCount } = await supabase
      .from("comm_whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("chat_id", chat.id);

    const whapiMessages = await fetchWhapiChatMessages(whapiToken, externalChatId);

    const missingMessages = [];
    for (const msg of whapiMessages) {
      const extId = extractWhapiMessageId(msg);
      if (!extId) continue;

      const { data: existing } = await supabase
        .from("comm_whatsapp_messages")
        .select("id")
        .eq("external_message_id", extId)
        .maybeSingle();

      if (!existing) {
        missingMessages.push(msg);
      }
    }

    if (missingMessages.length === 0) continue;

    console.log(`Chat ${chat.id} (${externalChatId}): ${existingCount} existing, ${whapiMessages.length} in Whapi, ${missingMessages.length} missing`);

    if (!APPLY) {
      console.log("  (dry-run) would insert:");
      for (const msg of missingMessages.slice(0, 5)) {
        const extId = extractWhapiMessageId(msg);
        const dir = msg.from_me ? "outbound" : "inbound";
        const text = summarizeWhapiMessage(msg).slice(0, 60);
        console.log(`    ${extId} [${dir}] ${text}`);
      }
      if (missingMessages.length > 5) console.log(`    ... and ${missingMessages.length - 5} more`);
      totalSkipped += missingMessages.length;
      continue;
    }

    for (const msg of missingMessages) {
      const extId = extractWhapiMessageId(msg);
      const direction = msg.from_me ? "outbound" : "inbound";
      const messageType = toTrimmedString(msg.type) || "text";
      const text = summarizeWhapiMessage(msg);
      const messageAt = unixTimestampToIso(msg.timestamp) || new Date().toISOString();
      const mediaMeta = extractWhapiMediaMeta(msg);

      const { error } = await supabase.rpc("comm_whatsapp_persist_message", {
        p_channel_id: channel.id,
        p_external_chat_id: externalChatId,
        p_phone_number: null,
        p_display_name: null,
        p_push_name: direction === "inbound" ? toTrimmedString(msg.push_name) || null : null,
        p_last_message_text: null,
        p_last_message_direction: null,
        p_last_message_at: null,
        p_increment_unread: null,
        p_external_message_id: extId,
        p_direction: direction,
        p_message_type: messageType,
        p_delivery_status: direction === "outbound" ? "sent" : "received",
        p_text_content: text,
        p_created_by: null,
        p_source: null,
        p_sender_name: direction === "inbound" ? toTrimmedString(msg.push_name) || toTrimmedString(msg.from_name) || null : null,
        p_sender_phone: direction === "inbound" ? normalizeDigits(msg.from) || null : null,
        p_status_updated_at: messageAt,
        p_error_message: null,
        p_metadata: null,
        p_media_id: mediaMeta.mediaId || null,
        p_media_url: null,
        p_media_mime_type: mediaMeta.mediaMimeType || null,
        p_media_file_name: mediaMeta.mediaFileName || null,
        p_media_size_bytes: mediaMeta.mediaSizeBytes || null,
        p_media_duration_seconds: mediaMeta.mediaDurationSeconds || null,
        p_media_caption: mediaMeta.mediaCaption || null,
      });

      if (error) {
        console.error(`  Failed to insert ${extId}: ${error.message}`);
        totalFailed++;
      } else {
        totalRecovered++;
      }
    }

    console.log(`  Recovered ${missingMessages.length} messages`);
  }

  console.log(`\nDone. Recovered: ${totalRecovered}, Skipped (dry-run): ${totalSkipped}, Failed: ${totalFailed}`);
  if (!APPLY) console.log("\nRun with --apply to execute recovery.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
