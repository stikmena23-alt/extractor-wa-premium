-- Crear o reemplazar la función que centraliza la lectura de usuarios bloqueados
-- desde Supabase. Devuelve la información principal del bloqueo junto con los
-- datos básicos del perfil para ser consumidos por el panel administrador.
create or replace function public.admin_list_active_blocks(
  user_ids uuid[] default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  blocked_at timestamptz,
  blocked_until timestamptz,
  reason text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  blocks_table text;
  blocks_table_name text;
  has_block_reason boolean := false;
  has_blocked_at boolean := false;
  profile_has_blocked_until boolean := false;
  profile_has_blocked_at boolean := false;
  profile_has_block_reason boolean := false;
  profile_has_contact_email boolean := false;
  profile_has_email boolean := false;
  profile_has_display_name boolean := false;
  profile_has_full_name boolean := false;
  profile_has_updated_at boolean := false;
  profile_has_inserted_at boolean := false;
  reason_expr text := 'NULL';
  blocked_at_expr text := 'now()';
  profile_email_expr text := 'au.email';
  profile_name_expr text := 'coalesce(au.raw_user_meta_data->>''full_name'', au.raw_user_meta_data->>''name'')';
  profile_blocked_at_expr text := 'now()';
  profile_blocked_until_expr text := 'NULL';
  profile_reason_expr text := 'NULL';
  profile_condition text := 'false';
  query text;
begin
  if to_regclass('public.account_blocks') is not null then
    blocks_table := 'public.account_blocks';
  elsif to_regclass('public.user_blocks') is not null then
    blocks_table := 'public.user_blocks';
  end if;

  if blocks_table is not null then
    blocks_table_name := split_part(blocks_table, '.', 2);
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = blocks_table_name and column_name = 'reason'
    ) into has_block_reason;
    select exists(
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = blocks_table_name and column_name = 'blocked_at'
    ) into has_blocked_at;
    if has_block_reason then
      reason_expr := 'nullif(b.reason, '''')';
    end if;
    if has_blocked_at then
      blocked_at_expr := 'coalesce(b.blocked_at, now())';
    end if;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'blocked_until'
  ) into profile_has_blocked_until;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'blocked_at'
  ) into profile_has_blocked_at;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'block_reason'
  ) into profile_has_block_reason;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'contact_email'
  ) into profile_has_contact_email;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into profile_has_email;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) into profile_has_display_name;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) into profile_has_full_name;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'updated_at'
  ) into profile_has_updated_at;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'inserted_at'
  ) into profile_has_inserted_at;

  if profile_has_contact_email then
    profile_email_expr := format('coalesce(p.contact_email, %s)', profile_email_expr);
  end if;
  if profile_has_email then
    profile_email_expr := format('coalesce(p.email, %s)', profile_email_expr);
  end if;
  if profile_has_full_name then
    profile_name_expr := format('coalesce(p.full_name, %s)', profile_name_expr);
  end if;
  if profile_has_display_name then
    profile_name_expr := format('coalesce(p.display_name, %s)', profile_name_expr);
  end if;
  if profile_has_blocked_at then
    profile_blocked_at_expr := 'coalesce(p.blocked_at, now())';
  end if;
  if profile_has_updated_at then
    profile_blocked_at_expr := format('coalesce(%s, p.updated_at, now())', profile_blocked_at_expr);
  end if;
  if profile_has_inserted_at then
    profile_blocked_at_expr := format('coalesce(%s, p.inserted_at, now())', profile_blocked_at_expr);
  end if;
  if profile_has_blocked_until then
    profile_blocked_until_expr := 'p.blocked_until';
  end if;
  if profile_has_block_reason then
    profile_reason_expr := 'nullif(p.block_reason, '''')';
  end if;

  if profile_blocked_until_expr <> 'NULL' then
    profile_condition := format('(%1$s is not null and (%1$s = ''infinity''::timestamptz or %1$s > now()))', profile_blocked_until_expr);
  end if;
  if profile_reason_expr <> 'NULL' then
    if profile_condition = 'false' then
      profile_condition := format('(%s is not null)', profile_reason_expr);
    else
      profile_condition := format('((%s) or (%s is not null))', profile_condition, profile_reason_expr);
    end if;
  end if;
  if profile_condition = 'false' then
    profile_condition := 'false';
  end if;

  if blocks_table is not null then
    query := format($q$
      with profile_flags as (
        select
          p.id as user_id,
          %1$s as email,
          %2$s as full_name,
          %3$s as blocked_at,
          %4$s as blocked_until,
          %5$s as reason
        from profiles p
        left join auth.users au on au.id = p.id
        where %6$s
      )
      select
        coalesce(b.user_id, pf.user_id) as user_id,
        coalesce(pf.email, u.email) as email,
        coalesce(pf.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') as full_name,
        coalesce(%7$s, pf.blocked_at, now()) as blocked_at,
        coalesce(b.blocked_until, pf.blocked_until) as blocked_until,
        nullif(coalesce(%8$s, pf.reason), '') as reason
      from %9$s b
      left join profile_flags pf on pf.user_id = b.user_id
      left join auth.users u on u.id = coalesce(b.user_id, pf.user_id)
      where (b.blocked_until is null or b.blocked_until = 'infinity'::timestamptz or b.blocked_until > now())
        %10$s
      union
      select
        pf.user_id,
        pf.email,
        pf.full_name,
        pf.blocked_at,
        pf.blocked_until,
        pf.reason
      from profile_flags pf
      where (pf.blocked_until is null or pf.blocked_until = 'infinity'::timestamptz or pf.blocked_until > now())
        %11$s
      order by coalesce(coalesce(b.blocked_until, pf.blocked_until), now() + interval '100 years') desc,
               coalesce(%7$s, pf.blocked_at, now()) desc
    $q$,
      profile_email_expr,
      profile_name_expr,
      profile_blocked_at_expr,
      profile_blocked_until_expr,
      profile_reason_expr,
      profile_condition,
      blocked_at_expr,
      reason_expr,
      blocks_table,
      case when user_ids is null then '' else ' and b.user_id = any($1)' end,
      case when user_ids is null then '' else ' and pf.user_id = any($1)' end
    );
    if user_ids is null then
      return query execute query;
    else
      return query execute query using user_ids;
    end if;
  else
    query := format($q$
      select
        p.id as user_id,
        %1$s as email,
        %2$s as full_name,
        %3$s as blocked_at,
        %4$s as blocked_until,
        %5$s as reason
      from profiles p
      left join auth.users au on au.id = p.id
      where %6$s
        %7$s
      order by coalesce(%4$s, now() + interval '100 years') desc,
               %3$s desc
    $q$,
      profile_email_expr,
      profile_name_expr,
      profile_blocked_at_expr,
      profile_blocked_until_expr,
      profile_reason_expr,
      profile_condition,
      case when user_ids is null then '' else ' and p.id = any($1)' end
    );
    if user_ids is null then
      return query execute query;
    else
      return query execute query using user_ids;
    end if;
  end if;
end;
$$;
