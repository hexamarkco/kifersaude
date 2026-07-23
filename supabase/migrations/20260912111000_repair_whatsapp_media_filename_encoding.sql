-- Repair filenames whose UTF-8 bytes were previously decoded as Latin-1 by the provider.
do $$
declare
  message_row record;
begin
  for message_row in
    select id, media_file_name
    from public.comm_whatsapp_messages
    where media_file_name is not null
      and (
        position(chr(195) in media_file_name) > 0
        or position(chr(194) in media_file_name) > 0
      )
  loop
    begin
      update public.comm_whatsapp_messages
      set media_file_name = convert_from(convert_to(message_row.media_file_name, 'LATIN1'), 'UTF8')
      where id = message_row.id;
    exception when others then
      null;
    end;
  end loop;
end $$;
