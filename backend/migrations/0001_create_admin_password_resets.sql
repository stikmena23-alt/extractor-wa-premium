-- Admin password recovery table aligned with Supabase auth schema
create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists public.admin_password_resets (
  id uuid not null default gen_random_uuid(),
  admin_email public.citext not null,
  token_hash bytea not null,
  code_hash bytea not null,
  short_code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  attempts integer not null default 0,
  requested_by_email public.citext null,
  ip_address inet null,
  user_agent text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id uuid null references auth.users(id) on delete cascade,
  constraint admin_password_resets_pkey primary key (id),
  constraint admin_password_resets_attempts_check check (attempts >= 0),
  constraint admin_password_resets_short_code_check check (
    char_length(short_code) between 4 and 12
  ),
  constraint admin_password_resets_expires_after_create check (expires_at > created_at)
);

create index if not exists admin_pwresets_code_hash_idx on public.admin_password_resets (code_hash);
create unique index if not exists admin_pwresets_token_hash_uq on public.admin_password_resets (token_hash);
create index if not exists admin_pwresets_email_created_idx on public.admin_password_resets (admin_email, created_at desc);
create index if not exists admin_pwresets_expires_idx on public.admin_password_resets (expires_at);
create index if not exists admin_pwresets_user_created_idx on public.admin_password_resets (user_id, created_at desc);
create index if not exists admin_pwresets_active_user_idx on public.admin_password_resets (user_id)
  where consumed_at is null and user_id is not null;
create index if not exists admin_pwresets_active_email_idx on public.admin_password_resets (admin_email)
  where consumed_at is null and user_id is null;
create unique index if not exists admin_pwresets_user_shortcode_active_uq
  on public.admin_password_resets (user_id, lower(short_code))
  where consumed_at is null and user_id is not null;
create unique index if not exists admin_pwresets_email_shortcode_active_uq
  on public.admin_password_resets (admin_email, lower(short_code))
  where consumed_at is null and user_id is null;

create or replace function public.set_admin_pwresets_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger trg_admin_pwresets_updated_at
before update on public.admin_password_resets
for each row
execute function public.set_admin_pwresets_updated_at();
