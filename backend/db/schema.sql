-- ============================================================
-- Blast WA — Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- 1. Clients (client undangan: pengantin, brand, dll)
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  event_type text,           -- pernikahan, ulang tahun, dll
  event_date date,
  notes text,
  created_at timestamptz default now()
);

-- 2. WA Sessions (akun WA yang dipakai untuk blast)
create table if not exists wa_sessions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  label text not null,                  -- "Nomor Utama", "Nomor Backup"
  phone_number text,
  status text default 'disconnected',   -- disconnected | connecting | qr | connected | logged_out
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. WA Auth State (storage untuk session Baileys agar persist di Supabase)
create table if not exists wa_auth_state (
  session_id uuid not null references wa_sessions(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  primary key (session_id, key)
);

-- 4. Campaigns (kampanye blast)
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  session_id uuid references wa_sessions(id) on delete set null,
  name text not null,
  template_text text not null,
  image_url text,
  status text default 'draft',          -- draft | scheduled | running | paused_limit | completed | cancelled
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_recipients int default 0,
  notes text,
  created_at timestamptz default now()
);

-- 5. Messages (1 baris = 1 pesan ke 1 nomor)
create table if not exists messages (
  id bigserial primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references wa_sessions(id) on delete set null,
  phone text not null,
  name text,
  variables jsonb default '{}',
  status text default 'pending',        -- pending | sent | failed
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_messages_campaign on messages(campaign_id);
create index if not exists idx_messages_status on messages(status);
create index if not exists idx_messages_session_sent on messages(session_id, sent_at);
create index if not exists idx_campaigns_status_scheduled on campaigns(status, scheduled_at);

-- 6. Storage bucket untuk upload gambar undangan
-- Jalankan ini juga di SQL Editor:
insert into storage.buckets (id, name, public)
values ('invitations', 'invitations', true)
on conflict (id) do nothing;

-- Policy: izinkan public read
drop policy if exists "Public can read invitations" on storage.objects;
create policy "Public can read invitations"
  on storage.objects for select
  using (bucket_id = 'invitations');
