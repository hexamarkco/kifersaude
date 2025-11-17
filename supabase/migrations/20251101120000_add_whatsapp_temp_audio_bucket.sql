-- Create bucket for temporary WhatsApp audio uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'whatsapp-temp-audio', 'whatsapp-temp-audio', false, 15728640,
       array['audio/aac', 'audio/mp4', 'audio/amr', 'audio/mpeg', 'audio/ogg']
where not exists (
  select 1 from storage.buckets where id = 'whatsapp-temp-audio'
);
