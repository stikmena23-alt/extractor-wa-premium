-- Ejecuta el descuento de múltiples créditos en una sola llamada.
-- Reutiliza la lógica existente de la función RPC `spend_credit`
-- para mantener reglas de negocio y validaciones.
create or replace function public.spend_credits(amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
begin
  if amount is null or amount <= 0 then
    return jsonb_build_object('ok', true, 'consumed', 0);
  end if;

  for i in 1..amount loop
    perform public.spend_credit();
  end loop;

  return jsonb_build_object('ok', true, 'consumed', amount);
exception
  when others then
    -- Propaga el error original (por ejemplo, NO_CREDITS) para que el cliente lo maneje.
    raise;
end;
$$;
