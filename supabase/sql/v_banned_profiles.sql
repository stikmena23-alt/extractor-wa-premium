create or replace view public.v_profiles_banned as
with latest as (
  select distinct on (user_id)
         user_id,
         action,
         ban_duration,
         banned_until,
         reason,
         actor_id,
         actor_email,
         created_at
  from public.admin_ban_log
  order by user_id, created_at desc
)
select
  p.id             as profile_id,
  p."Display name" as profile_name,
  l.banned_until,
  l.created_at     as banned_at,
  l.reason,
  l.actor_email,
  true             as is_banned_now
from latest l
join public.profiles p
  on p.id = l.user_id
where l.action = 'ban'
  and l.banned_until is not null
  and l.banned_until > now();

create or replace view public.v_banned_profiles as
select * from public.v_profiles_banned;
