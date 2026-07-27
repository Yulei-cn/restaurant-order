-- Apply this file once in the Supabase SQL Editor.
-- A cashier day lasts 24 hours from its first opening.

create or replace function public.require_open_cash_register_day()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.cash_register_days as cash_day
    where cash_day.status = 'open'
      and cash_day.opened_at > timezone('utc', now()) - interval '24 hours'
  ) then
    raise exception 'Cash register is not open for today';
  end if;
  return new;
end;
$$;

create or replace function public.close_cash_register_day(close_payload jsonb)
returns table (business_date date, expected_cash numeric, counted_cash numeric, variance_cash numeric)
language plpgsql
as $$
declare
  target_counted numeric := (close_payload->>'counted_cash')::numeric;
  target_actor text := close_payload->>'closed_by';
  calculated_cash numeric;
  active_day public.cash_register_days%rowtype;
begin
  if target_counted is null or target_counted < 0
    or target_actor is null or btrim(target_actor) = '' then
    raise exception 'Invalid daily closure';
  end if;

  select * into active_day
  from public.cash_register_days as cash_day
  where cash_day.status = 'open'
    and cash_day.opened_at > timezone('utc', now()) - interval '24 hours'
  order by cash_day.opened_at desc
  limit 1;
  if not found then
    raise exception 'Cash register is not open for today';
  end if;

  select coalesce(sum(
    case
      when event_type = 'payment' and payment_method = 'cash' then amount
      when event_type in ('refund', 'void') and payment_method = 'cash' then -amount
      else 0
    end
  ), 0)
  into calculated_cash
  from public.payment_events
  where recorded_at >= active_day.opened_at and recorded_at <= timezone('utc', now());

  update public.cash_register_days as cash_day
  set status = 'closed',
      expected_cash = opening_cash + calculated_cash,
      counted_cash = target_counted,
      variance_cash = target_counted - (opening_cash + calculated_cash),
      closed_by = target_actor,
      closed_at = timezone('utc', now()),
      closing_hash = encode(digest(
        concat_ws('|', active_day.business_date::text, calculated_cash::text, target_counted::text, target_actor),
        'sha256'
      ), 'hex')
  where cash_day.business_date = active_day.business_date and cash_day.status = 'open'
  returning cash_day.expected_cash, cash_day.counted_cash, cash_day.variance_cash
  into expected_cash, counted_cash, variance_cash;

  insert into public.cashier_audit_logs (event_type, entity_type, actor, details)
  values ('daily_close', 'cash_register_day', target_actor, jsonb_build_object(
    'business_date', active_day.business_date,
    'expected_cash', expected_cash,
    'counted_cash', counted_cash,
    'variance_cash', variance_cash
  ));

  business_date := active_day.business_date;
  return next;
end;
$$;

create or replace function public.open_cash_register_day(open_payload jsonb)
returns table (business_date date, opening_cash numeric)
language plpgsql
as $$
declare
  target_opening numeric := (open_payload->>'opening_cash')::numeric;
  target_actor text := open_payload->>'opened_by';
  recent_day public.cash_register_days%rowtype;
begin
  if target_opening is null or target_opening < 0
    or target_actor is null or btrim(target_actor) = '' then
    raise exception 'Invalid opening';
  end if;

  select * into recent_day
  from public.cash_register_days as cash_day
  where cash_day.opened_at > timezone('utc', now()) - interval '24 hours'
  order by cash_day.opened_at desc
  limit 1;

  if found and recent_day.status = 'open' then
    raise exception 'Cash register is already open';
  elsif found then
    update public.cash_register_days as cash_day
    set status = 'open',
        expected_cash = null,
        counted_cash = null,
        variance_cash = null,
        closed_by = null,
        closed_at = null,
        closing_hash = null
    where cash_day.business_date = recent_day.business_date;

    insert into public.cashier_audit_logs (event_type, entity_type, actor, details)
    values ('daily_reopen', 'cash_register_day', target_actor,
      jsonb_build_object('business_date', recent_day.business_date));

    business_date := recent_day.business_date;
    opening_cash := recent_day.opening_cash;
  else
    update public.cash_register_days
    set status = 'closed', closed_by = target_actor, closed_at = timezone('utc', now())
    where status = 'open'
      and opened_at <= timezone('utc', now()) - interval '24 hours';

    insert into public.cash_register_days (business_date, opening_cash, opened_by)
    values (current_date, target_opening, target_actor);

    insert into public.cashier_audit_logs (event_type, entity_type, actor, details)
    values ('daily_open', 'cash_register_day', target_actor,
      jsonb_build_object('business_date', current_date, 'opening_cash', target_opening));

    business_date := current_date;
    opening_cash := target_opening;
  end if;
  return next;
end;
$$;
