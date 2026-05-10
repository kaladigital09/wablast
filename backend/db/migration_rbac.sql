-- ============================================================
-- Migration: RBAC + Authentication
-- Jalankan di Supabase SQL Editor SETELAH schema.sql
-- ============================================================

-- 1. User profiles (role + client linking)
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'client_user')),
  client_id uuid references clients(id) on delete cascade, -- null untuk super_admin
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_profiles_client on user_profiles(client_id);
create index if not exists idx_user_profiles_role on user_profiles(role);

-- 2. Clients: toggle scheduler & email contact
alter table clients add column if not exists schedule_enabled boolean default false;
alter table clients add column if not exists contact_email text;
alter table clients add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_clients_owner on clients(owner_user_id);

-- 3. Helper view: client + user info (untuk admin dashboard)
create or replace view clients_with_user as
select
  c.*,
  up.id as user_id,
  up.full_name as user_full_name,
  au.email as user_email,
  au.last_sign_in_at as user_last_sign_in
from clients c
left join user_profiles up on up.client_id = c.id
left join auth.users au on au.id = up.id;

-- 4. RLS policies (defense-in-depth, walaupun backend sudah scope manual)
alter table user_profiles enable row level security;

drop policy if exists "Users can read own profile" on user_profiles;
create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Service role full access user_profiles" on user_profiles;
create policy "Service role full access user_profiles"
  on user_profiles for all
  using (auth.role() = 'service_role');

-- Disable RLS untuk semua tabel app.
-- Backend pakai service_role key & sudah handle authorization via middleware
-- (requireSuperAdmin, scopeByClient, assertClientAccess). RLS default-deny
-- malah block backend walau service_role JWT seharusnya bypass — pengalaman
-- production: PostgREST nested select silent-fail return [].
-- user_profiles tetap RLS-enabled karena dipakai langsung oleh Supabase Auth.
alter table clients disable row level security;
alter table wa_sessions disable row level security;
alter table wa_auth_state disable row level security;
alter table campaigns disable row level security;
alter table messages disable row level security;
