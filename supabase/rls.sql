-- CUBE security baseline for Supabase
-- Goal:
-- 1. Keep browser users blocked from direct access to operational tables
-- 2. Allow server-side API routes that use the service role / secret server key
-- 3. Avoid breaking inserts/updates from Vercel API routes

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoice_clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payment_events enable row level security;
alter table public.cashier_audit_logs enable row level security;
alter table public.cash_register_days enable row level security;

alter table public.orders no force row level security;
alter table public.order_items no force row level security;
alter table public.invoice_clients no force row level security;
alter table public.invoices no force row level security;
alter table public.invoice_items no force row level security;
alter table public.payment_events no force row level security;
alter table public.cashier_audit_logs no force row level security;
alter table public.cash_register_days no force row level security;

drop policy if exists "service_orders_all" on public.orders;
drop policy if exists "service_order_items_all" on public.order_items;
drop policy if exists "service_invoice_clients_all" on public.invoice_clients;
drop policy if exists "service_invoices_all" on public.invoices;
drop policy if exists "service_invoice_items_all" on public.invoice_items;
drop policy if exists "service_payment_events_all" on public.payment_events;
drop policy if exists "service_cashier_audit_logs_all" on public.cashier_audit_logs;
drop policy if exists "service_cash_register_days_all" on public.cash_register_days;

drop policy if exists "orders_anon_read" on public.orders;
drop policy if exists "orders_anon_write" on public.orders;
drop policy if exists "order_items_anon_read" on public.order_items;
drop policy if exists "order_items_anon_write" on public.order_items;
drop policy if exists "invoice_clients_anon_read" on public.invoice_clients;
drop policy if exists "invoice_clients_anon_write" on public.invoice_clients;
drop policy if exists "invoices_anon_read" on public.invoices;
drop policy if exists "invoices_anon_write" on public.invoices;
drop policy if exists "invoice_items_anon_read" on public.invoice_items;
drop policy if exists "invoice_items_anon_write" on public.invoice_items;

create policy "service_orders_all"
on public.orders
for all
to service_role
using (true)
with check (true);

create policy "service_order_items_all"
on public.order_items
for all
to service_role
using (true)
with check (true);

create policy "service_invoice_clients_all"
on public.invoice_clients
for all
to service_role
using (true)
with check (true);

create policy "service_invoices_all"
on public.invoices
for all
to service_role
using (true)
with check (true);

create policy "service_invoice_items_all"
on public.invoice_items
for all
to service_role
using (true)
with check (true);

create policy "service_payment_events_all"
on public.payment_events
for all
to service_role
using (true)
with check (true);

create policy "service_cashier_audit_logs_all"
on public.cashier_audit_logs
for all
to service_role
using (true)
with check (true);

create policy "service_cash_register_days_all"
on public.cash_register_days
for all
to service_role
using (true)
with check (true);

revoke all on public.order_summary from anon;
revoke all on public.order_summary from authenticated;
grant select on public.order_summary to service_role;

revoke all on function public.create_order_with_items(jsonb, jsonb) from public;
revoke all on function public.create_order_with_items(jsonb, jsonb) from anon;
revoke all on function public.create_order_with_items(jsonb, jsonb) from authenticated;
grant execute on function public.create_order_with_items(jsonb, jsonb) to service_role;

revoke all on function public.record_payment_event(jsonb) from public;
revoke all on function public.record_payment_event(jsonb) from anon;
revoke all on function public.record_payment_event(jsonb) from authenticated;
grant execute on function public.record_payment_event(jsonb) to service_role;

revoke all on function public.close_cash_register_day(jsonb) from public;
revoke all on function public.close_cash_register_day(jsonb) from anon;
revoke all on function public.close_cash_register_day(jsonb) from authenticated;
grant execute on function public.close_cash_register_day(jsonb) to service_role;

revoke all on function public.create_invoice_with_items(jsonb, jsonb) from public;
revoke all on function public.create_invoice_with_items(jsonb, jsonb) from anon;
revoke all on function public.create_invoice_with_items(jsonb, jsonb) from authenticated;
grant execute on function public.create_invoice_with_items(jsonb, jsonb) to service_role;
