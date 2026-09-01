import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

const env = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...process.env,
};

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[repair] Missing VITE_SUPABASE_URL/SUPABASE_URL or service role key in local env.');
  process.exit(1);
}

const sinceArg = process.argv.find((arg) => arg.startsWith('--since='));
const since = sinceArg?.slice('--since='.length) || '2026-09-01T03:00:00.000Z';
const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const visibleMarkers = new Set([
  '[imagem]',
  '[video]',
  '[documento]',
  '[audio]',
  '[link]',
  '[localizacao]',
  '[sticker]',
  '[contato]',
  '[enquete]',
  '[resposta]',
  '[mensagem interativa]',
]);

function isHiddenPreviewText(value, messageType) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const normalizedType = String(messageType || '').trim().toLowerCase();
  if (!normalizedValue) return true;

  const messageMarker = normalizedType
    ? normalizedType === 'text'
      ? '[mensagem]'
      : `[${normalizedType}]`
    : null;

  return [
    '[mensagem]',
    '[mensagem sem texto]',
    '[mensagem sem conteudo]',
    '[mensagem sem conteúdo]',
    '[payload invalido]',
    '[payload inválido]',
    '[acao]',
    '[ação]',
    '[action]',
    '[reacao]',
    '[reação]',
    '[reaction]',
    '[atualizacao de midia]',
    '[atualização de mídia]',
    '[media update]',
    '[voto em enquete]',
  ].includes(normalizedValue)
    || (messageMarker !== null && normalizedValue === messageMarker && !visibleMarkers.has(normalizedValue))
    || (/^\[[^\]]+\]$/.test(normalizedValue) && !visibleMarkers.has(normalizedValue));
}

function messagePreview(message) {
  const messageType = String(message.message_type || '').trim().toLowerCase();
  for (const raw of [message.media_caption, message.text_content, message.transcription_text]) {
    const value = String(raw || '').trim();
    if (value && !isHiddenPreviewText(value, messageType)) return value;
  }

  if (['audio', 'voice'].includes(messageType)) return '[Áudio]';
  if (messageType === 'image') return '[Imagem]';
  if (['video', 'gif', 'short'].includes(messageType)) return '[Vídeo]';
  if (messageType === 'document') return '[Documento]';
  if (messageType === 'link_preview') return '[Link]';
  if (['location', 'live_location'].includes(messageType)) return '[Localização]';
  if (messageType === 'sticker') return '[Sticker]';
  if (['contact', 'contact_list'].includes(messageType)) return '[Contato]';
  if (messageType === 'poll') return '[Enquete]';
  if (messageType === 'reply') return '[Resposta]';
  if (['interactive', 'hsm', 'carousel'].includes(messageType)) return '[Mensagem interativa]';
  return '';
}

async function main() {
  const { data: targets, error } = await supabase
    .from('comm_whatsapp_campaign_targets')
    .select('id,campaign_id,chat_id,display_name,phone_digits,status,current_step_index,sent_at,responded_at,stopped_at,stopped_reason,next_send_at,ab_variant')
    .eq('status', 'responded')
    .eq('stopped_reason', 'inbound_reply')
    .gte('responded_at', since)
    .gte('current_step_index', 1)
    .limit(1000);

  if (error) throw error;

  const summary = {
    since,
    dryRun,
    checked: 0,
    repaired: 0,
    keptDelayedStep: 0,
    rows: [],
  };

  for (const target of targets || []) {
    summary.checked += 1;
    const variant = target.ab_variant || 'A';
    const { data: steps, error: stepError } = await supabase
      .from('comm_whatsapp_campaign_steps')
      .select('id,delay_amount,variant_label,step_index')
      .eq('campaign_id', target.campaign_id)
      .eq('step_index', target.current_step_index)
      .in('variant_label', ['ANY', variant]);

    if (stepError) throw stepError;

    const step = (steps || []).find((item) => item.variant_label === variant)
      || (steps || []).find((item) => item.variant_label === 'ANY')
      || null;

    if (!step || Number(step.delay_amount || 0) > 0) {
      summary.keptDelayedStep += 1;
      continue;
    }

    let visibleReply = null;
    if (target.chat_id && target.sent_at) {
      const { data: messages, error: messagesError } = await supabase
        .from('comm_whatsapp_messages')
        .select('id,message_type,text_content,media_caption,transcription_text,message_at,source')
        .eq('chat_id', target.chat_id)
        .eq('direction', 'inbound')
        .gte('message_at', target.sent_at)
        .order('message_at', { ascending: true })
        .limit(50);

      if (messagesError) throw messagesError;
      visibleReply = (messages || []).find((message) => messagePreview(message));
    }

    const update = {
      status: 'scheduled',
      stopped_at: null,
      stopped_reason: null,
      error_message: null,
      next_retry_at: null,
      locked_at: null,
      lock_token: null,
      responded_at: visibleReply ? target.responded_at : null,
      updated_at: new Date().toISOString(),
    };

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('comm_whatsapp_campaign_targets')
        .update(update)
        .eq('id', target.id);

      if (updateError) throw updateError;
    }

    summary.repaired += 1;
    summary.rows.push({
      id: target.id,
      name: target.display_name,
      current_step_index: target.current_step_index,
      visible_reply: Boolean(visibleReply),
      next_send_at: target.next_send_at,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[repair] Failed:', error.message || error);
  process.exit(1);
});
