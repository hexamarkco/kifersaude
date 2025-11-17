-- Create bucket to store WhatsApp chat profile photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'whatsapp-chat-photos', 'whatsapp-chat-photos', true, 5242880,
       array['image/jpeg', 'image/png', 'image/webp']
where not exists (
  select 1 from storage.buckets where id = 'whatsapp-chat-photos'
);
