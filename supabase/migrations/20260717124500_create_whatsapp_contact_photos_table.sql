create table if not exists public.whatsapp_contact_photos (
  phone text primary key,
  photo_url text,
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_contact_photos_updated_at_idx
  on public.whatsapp_contact_photos (updated_at desc);
