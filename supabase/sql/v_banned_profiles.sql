-- Vista principal de usuarios baneados activos basada en la tabla banned_users.
-- Incluye datos básicos del perfil para que el panel administrador pueda
-- mostrar nombre y otra información de contacto.
create or replace view public.v_profiles_banned as
select
  p.id as profile_id,
  coalesce(p."Display name", p.display_name, p.full_name) as profile_name,
  coalesce(p.full_name, p.display_name, p."Display name") as full_name,
  p.email,
  p.contact_email,
  p.user_email,
  p.auth_email,
  p.identity,
  p.phone_number,
  p.phone,
  b.banned_at,
  b.banned_until,
  b.reason,
  b.actor_email,
  b.updated_at,
  true as is_banned_now
from public.banned_users b
join public.profiles p
  on p.id = b.user_id
where b.banned_until is not null
  and (b.banned_until = 'infinity'::timestamptz or b.banned_until > now());

-- Alias legado para clientes que aún consultan la vista antigua.
create or replace view public.v_banned_profiles as
select * from public.v_profiles_banned;
