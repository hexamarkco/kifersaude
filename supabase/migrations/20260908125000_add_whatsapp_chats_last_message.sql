alter table public.whatsapp_chats
  add column if not exists last_message text;

comment on column public.whatsapp_chats.last_message is
  'Cached preview of the latest meaningful WhatsApp message shown in the chat list.';

with latest_activity as (
  select distinct on (wm.chat_id)
    wm.chat_id,
    coalesce(wm.timestamp, wm.created_at) as last_message_at,
    wm.created_at as sort_created_at
  from public.whatsapp_messages wm
  order by
    wm.chat_id,
    coalesce(wm.timestamp, wm.created_at) desc nulls last,
    wm.created_at desc nulls last,
    wm.id desc
),
preview_candidates as (
  select
    wm.chat_id,
    coalesce(wm.timestamp, wm.created_at) as preview_timestamp,
    wm.created_at as preview_created_at,
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
    end as preview_body
  from public.whatsapp_messages wm
),
latest_preview as (
  select distinct on (pc.chat_id)
    pc.chat_id,
    pc.preview_body
  from preview_candidates pc
  where pc.preview_body is not null
  order by
    pc.chat_id,
    pc.preview_timestamp desc nulls last,
    pc.preview_created_at desc nulls last
)
update public.whatsapp_chats wc
set
  last_message_at = coalesce(la.last_message_at, wc.last_message_at),
  last_message = lp.preview_body
from latest_activity la
left join latest_preview lp
  on lp.chat_id = la.chat_id
where wc.id = la.chat_id;
