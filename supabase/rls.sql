-- CUBE security baseline for Supabase
-- Goal:
-- 1. Block all direct browser access to operational tables
-- 2. Keep access available through server-side API routes using the secret key
-- 3. Prepare for future authenticated admin access without exposing data now

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.invoice_clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.invoice_clients force row level security;
alter table public.invoices force row level security;
alter table public.invoice_items force row level security;

-- Remove any previously created broad policies if they exist.
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

-- No SELECT/INSERT/UPDATE/DELETE policies are created on purpose.
-- Result:
-- - anon/authenticated browser clients cannot read or write these tables
-- - service-role / secret-key requests from your backend continue to work

-- Lock down the summary view as well.
revoke all on public.order_summary from anon;
revoke all on public.order_summary from authenticated;

-- Optional explicit grants for backend roles usually remain managed by Supabase.
-- If you later add admin login with Supabase Auth, create narrow policies then.
