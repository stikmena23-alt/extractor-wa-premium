-- View: v_banned_profiles
-- Mantiene un listado de los perfiles con baneos activos.
-- Requiere permisos de lectura sobre auth.users y profiles.

create or replace view public.v_banned_profiles as
with prof as (
  select
    p.id,
    to_jsonb(p.*) as j
  from profiles p
)
select
  prof.id as profile_id,
  coalesce(
    prof.j ->> 'full_name',
    prof.j ->> 'display_name',
    prof.j ->> 'name',
    prof.j ->> 'owner_name',
    prof.j ->> 'contact_name'
  ) as profile_name,
  prof.j ->> 'contact_email' as contact_email,
  prof.j ->> 'phone_number' as phone_number,
  prof.j ->> 'plan' as plan,
  (prof.j ->> 'credits')::integer as credits,
  u.email as auth_email,
  u.banned_until,
  now() as checked_at
from auth.users u
join prof on prof.id = u.id
where u.banned_until is not null
  and u.banned_until > now();
