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

-- 4. Disable RLS untuk SEMUA tabel app.
-- Backend pakai service_role key & sudah handle authorization via middleware
-- (requireSuperAdmin, scopeByClient, assertClientAccess di backend/src/middleware/auth.js).
--
-- Pengalaman: RLS aktif tanpa policy match bikin backend di-block walau pakai
-- service_role JWT (PostgREST nested select silent-fail return []). User_profiles
-- juga termasuk — saat super_admin mau baca profile client lain, RLS block
-- karena policy `auth.uid() = id` cuma allow read profile sendiri.
--
-- Frontend Kala Blast TIDAK pernah query Supabase langsung (semua via backend),
-- jadi disable RLS aman. Kalau di masa depan tambah Supabase JS di frontend,
-- WAJIB re-enable RLS dengan policy proper dulu.
alter table user_profiles disable row level security;
alter table clients disable row level security;
alter table wa_sessions disable row level security;
alter table wa_auth_state disable row level security;
alter table campaigns disable row level security;
alter table messages disable row level security;
