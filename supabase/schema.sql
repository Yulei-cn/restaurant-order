-- CUBE database schema
-- Target: Supabase Postgres
-- Scope:
-- 1. Internal restaurant orders
-- 2. Future external pickup orders
-- 3. Future invoice integration
-- Excludes:
-- - Printer integration
-- - Payment gateway/webhook processing logic

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source text not null check (source in ('internal', 'online_pickup', 'online_paid')),
  channel text not null default 'staff' check (channel in ('staff', 'web', 'phone', 'walk_in')),
  order_status text not null default 'new'
    check (order_status in ('new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pay_on_pickup', 'paid', 'failed', 'refunded')),
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_notes text,
  internal_notes text,
  fulfillment_type text not null default 'pickup'
    check (fulfillment_type in ('pickup', 'dine_in', 'delivery')),
  scheduled_for timestamptz,
  subtotal_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  invoice_needed boolean not null default false,
  invoice_id uuid,
  created_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_order_status on public.orders (order_status);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_source on public.orders (source);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  item_category text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 10.00 check (tax_rate >= 0),
  total_price numeric(10,2) generated always as (round((quantity * unit_price)::numeric, 2)) stored,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);

create table if not exists public.invoice_clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  legal_name text,
  address_line_1 text not null,
  address_line_2 text,
  postal_code text,
  city text not null,
  country text not null default 'France',
  vat_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_invoice_clients_company_name on public.invoice_clients (company_name);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid references public.orders(id) on delete set null,
  invoice_client_id uuid references public.invoice_clients(id) on delete set null,
  issue_date timestamptz not null default timezone('utc', now()),
  due_date timestamptz,
  payment_method text,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partial', 'cancelled', 'refunded')),
  subtotal_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_invoices_order_id on public.invoices (order_id);
create index if not exists idx_invoices_issue_date on public.invoices (issue_date desc);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sort_order integer not null default 0,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price_ht numeric(10,2) not null check (unit_price_ht >= 0),
  tax_rate numeric(5,2) not null default 10.00 check (tax_rate >= 0),
  unit_price_ttc numeric(10,2) not null check (unit_price_ttc >= 0),
  total_price_ttc numeric(10,2) generated always as (round((quantity * unit_price_ttc)::numeric, 2)) stored,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);

alter table public.orders
  add constraint fk_orders_invoice
  foreign key (invoice_id) references public.invoices(id) on delete set null;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_invoice_clients_updated_at on public.invoice_clients;
create trigger trg_invoice_clients_updated_at
before update on public.invoice_clients
for each row
execute function public.set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  current_date_part text;
  next_sequence integer;
begin
  current_date_part := to_char(timezone('utc', now()), 'YYYYMMDD');

  select coalesce(max(right(order_number, 3)::integer), 0) + 1
  into next_sequence
  from public.orders
  where order_number like current_date_part || '-%';

  return current_date_part || '-' || lpad(next_sequence::text, 3, '0');
end;
$$;

create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number := public.generate_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_assign_number on public.orders;
create trigger trg_orders_assign_number
before insert on public.orders
for each row
execute function public.assign_order_number();

create or replace function public.generate_invoice_number()
returns text
language plpgsql
as $$
declare
  current_date_part text;
  next_sequence integer;
begin
  current_date_part := to_char(timezone('utc', now()), 'YYYYMMDD');

  select coalesce(max(right(invoice_number, 3)::integer), 0) + 1
  into next_sequence
  from public.invoices
  where invoice_number like 'FAC-' || current_date_part || '-%';

  return 'FAC-' || current_date_part || '-' || lpad(next_sequence::text, 3, '0');
end;
$$;

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := public.generate_invoice_number();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_assign_number on public.invoices;
create trigger trg_invoices_assign_number
before insert on public.invoices
for each row
execute function public.assign_invoice_number();

create or replace view public.order_summary as
select
  o.id,
  o.order_number,
  o.source,
  o.channel,
  o.order_status,
  o.payment_status,
  o.customer_name,
  o.customer_phone,
  o.customer_address,
  o.customer_notes,
  o.fulfillment_type,
  o.scheduled_for,
  o.subtotal_amount,
  o.tax_amount,
  o.total_amount,
  o.currency,
  o.invoice_needed,
  o.created_at,
  o.updated_at,
  coalesce(
    json_agg(
      json_build_object(
        'id', oi.id,
        'name', oi.item_name,
        'category', oi.item_category,
        'qty', oi.quantity,
        'price', oi.unit_price,
        'tax_rate', oi.tax_rate,
        'total', oi.total_price,
        'notes', oi.notes,
        'sort_order', oi.sort_order
      )
      order by oi.sort_order, oi.created_at
    ) filter (where oi.id is not null),
    '[]'::json
  ) as items
from public.orders o
left join public.order_items oi on oi.order_id = o.id
group by o.id;
