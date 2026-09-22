-- Cafe Esero × Crumble Cookie
-- Database Schema Updates for Admin CRUD & Pre-Order Batch Management

-- 1. Add batch_name to orders table to organize preorders into rounds (Pre-Order 1, Pre-Order 2, etc.)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'orders' and column_name = 'batch_name'
  ) then
    alter table public.orders add column batch_name text default 'Pre-Order 1' not null;
  end if;
end $$;

-- Create index on batch_name for fast filtering
create index if not exists idx_orders_batch_name on public.orders(batch_name);

-- 2. Add category to cookie_stock table to support Classic, Premium, Special, etc.
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'cookie_stock' and column_name = 'category'
  ) then
    alter table public.cookie_stock add column category text default 'classic' not null;
  end if;
end $$;

-- Update existing items to appropriate categories
update public.cookie_stock
set category = 'classic'
where flavor_key in ('classic_chocolate_chip', 'double_chocolate', 'chocolate_chip_walnut');

update public.cookie_stock
set category = 'premium'
where flavor_key in ('cookies_cream', 'kunafa_chocolate', 'hazelnut_filled', 'lotus_lava');

-- 3. Initialize default Pre-Order Batches in settings table if not already set
insert into public.settings (key, value)
values (
  'preorder_batches',
  '{
    "activeBatchId": "batch_1",
    "batches": [
      {
        "id": "batch_1",
        "name": "Pre-Order 1",
        "status": "active",
        "createdAt": "2026-09-15T00:00:00.000Z",
        "notes": "Initial pre-order launch round"
      }
    ]
  }'::jsonb
)
on conflict (key) do nothing;

-- 4. Add items_breakdown JSONB column to orders table to store full itemized snapshots (including dynamic menu items like Crumble Pot)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'orders' and column_name = 'items_breakdown'
  ) then
    alter table public.orders add column items_breakdown jsonb;
  end if;
end $$;

