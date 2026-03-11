alter table public.whatsapp_chats
  add column if not exists last_message_direction text;

comment on column public.whatsapp_chats.last_message_direction is
  'Cached direction of the latest meaningful WhatsApp message shown in the chat list.';

with latest_preview as (
  select distinct on (wm.chat_id)
    wm.chat_id,
    case
      when coalesce(wm.is_deleted, false) then 'Mensagem apagada'
      when lower(coalesce(wm.type, '')) = 'action'
        and lower(coalesce(wm.payload -> 'action' ->> 'type', '')) in ('reaction', 'edit', 'edited')
        then null
      when lower(coalesce(wm.type, '')) = 'system'
        and (
          lower(btrim(coalesce(wm.body, ''))) = '[mensagem criptografada]'
          or lower(btrim(coalesce(wm.body, ''))) like '%aguardando esta mensagem%'
          or lower(btrim(coalesce(wm.body, ''))) like '%waiting for this message%'
          or lower(coalesce(wm.payload ->> 'subtype', '')) = 'ciphertext'
          or lower(coalesce(wm.payload -> 'system' ->> 'body', '')) like '%aguardando esta mensagem%'
          or lower(coalesce(wm.payload -> 'system' ->> 'body', '')) like '%waiting for this message%'
        )
        then null
      when lower(btrim(coalesce(wm.body, ''))) in (
        '[evento do whatsapp]',
        '[atualização do whatsapp]',
        '[atualizacao do whatsapp]',
        '[mensagem não suportada]',
        '[mensagem nao suportada]'
      )
        then null
      when nullif(btrim(coalesce(wm.body, '')), '') is not null then btrim(wm.body)
      when lower(coalesce(wm.type, '')) = 'image' then '[Imagem]'
      when lower(coalesce(wm.type, '')) in ('video', 'short', 'gif') then '[Vídeo]'
      when lower(coalesce(wm.type, '')) in ('audio', 'voice', 'ptt') then '[Áudio]'
      when lower(coalesce(wm.type, '')) = 'document' then '[Documento]'
      when lower(coalesce(wm.type, '')) = 'contact' then '[Contato]'
      when lower(coalesce(wm.type, '')) in ('location', 'live_location') then '[Localização]'
      when coalesce(wm.has_media, false) then '[Anexo]'
      else null
    end as preview_body,
    case
      when lower(coalesce(wm.direction, '')) in ('inbound', 'outbound') then lower(wm.direction)
      else null
    end as preview_direction,
    coalesce(wm.timestamp, wm.created_at) as preview_timestamp,
    wm.created_at as preview_created_at
  from public.whatsapp_messages wm
)
update public.whatsapp_chats wc
set
  last_message = lp.preview_body,
  last_message_direction = lp.preview_direction
from latest_preview lp
where wc.id = lp.chat_id
  and lp.preview_body is not null;
