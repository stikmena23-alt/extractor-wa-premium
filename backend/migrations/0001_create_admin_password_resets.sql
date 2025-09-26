-- Admin password recovery support
-- Run with `supabase db push` or include in your migration pipeline before
-- deploying the Supabase Edge Functions that rely on the table.

create extension if not exists "pgcrypto";

create table if not exists admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null,
  code_hash text not null,
  short_code text not null,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists admin_password_resets_user_lookup on admin_password_resets (user_id, used_at);
create index if not exists admin_password_resets_token_hash on admin_password_resets (token_hash);
create index if not exists admin_password_resets_code_hash on admin_password_resets (code_hash);
create index if not exists admin_password_resets_short_code on admin_password_resets (short_code);
