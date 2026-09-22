-- SQL Commands to implement Cookie Stock and Stored Procedure in Supabase

-- 1. Create Table: cookie_stock
create table if not exists public.cookie_stock (
  flavor_key text primary key,
  flavor_name text not null,
  price integer not null,
  initial_stock integer not null,
  available_stock integer not null,
  is_active boolean default true not null,
  updated_at timestamp with time zone default now() not null
);

-- 2. Seed Initial Stock Levels (subtracting the 12 existing preorders from your database)
insert into public.cookie_stock (flavor_key, flavor_name, price, initial_stock, available_stock, is_active)
values
  ('classic_chocolate_chip', 'Classic Chocolate Chip', 580, 200, 188, true),
  ('double_chocolate', 'Double Chocolate', 580, 200, 189, true),
  ('chocolate_chip_walnut', 'Chocolate Chip Walnut', 580, 100, 98, true),
  ('cookies_cream', 'Cookies & Cream', 620, 150, 146, true),
  ('kunafa_chocolate', 'Kunafa Chocolate', 620, 100, 94, true),
  ('hazelnut_filled', 'Hazelnut Filled', 620, 150, 144, true),
  ('lotus_lava', 'Lotus Lava', 620, 100, 96, true)
on conflict (flavor_key) do update set
  price = excluded.price,
  initial_stock = excluded.initial_stock,
  available_stock = excluded.available_stock;

-- 3. Stored Procedure: place_order_with_stock
-- Atomically validates stock, decrements quantities, and inserts the order inside a single database transaction.
create or replace function public.place_order_with_stock(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_order_type text,
  p_delivery_street text,
  p_delivery_street2 text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_zip text,
  p_delivery_landmark text,
  p_classic_chocolate_chip_qty integer,
  p_double_chocolate_qty integer,
  p_chocolate_chip_walnut_qty integer,
  p_cookies_cream_qty integer,
  p_kunafa_chocolate_qty integer,
  p_hazelnut_filled_qty integer,
  p_lotus_lava_qty integer,
  p_classic_bundle_qty integer,
  p_classic_bundle_flavours text,
  p_premium_bundle_qty integer,
  p_premium_bundle_flavours text,
  p_total_amount numeric,
  p_payment_proof_url text,
  p_deductions jsonb,
  p_items_breakdown jsonb default null
)
returns json as $$
declare
  r_flavor_key text;
  r_qty integer;
  r_available integer;
  r_flavor_name text;
  r_order_id uuid;
begin
  -- Loop through deductions to verify there is enough stock before committing any changes
  for r_flavor_key, r_qty in select * from jsonb_each_text(p_deductions) loop
    -- Convert string count to integer
    r_qty := r_qty::integer;
    
    if r_qty > 0 then
      select available_stock, flavor_name into r_available, r_flavor_name 
      from public.cookie_stock 
      where flavor_key = r_flavor_key 
      for update;

      if r_available is null then
        raise exception 'Flavor % does not exist in the stock table.', r_flavor_key;
      end if;

      if r_available < r_qty then
        raise exception 'Sorry, we are out of stock for %! (Requested %, only % left)', r_flavor_name, r_qty, r_available;
      end if;
    end if;
  end loop;

  -- Deduct stock
  for r_flavor_key, r_qty in select * from jsonb_each_text(p_deductions) loop
    r_qty := r_qty::integer;
    if r_qty > 0 then
      update public.cookie_stock
      set available_stock = available_stock - r_qty
      where flavor_key = r_flavor_key;
    end if;
  end loop;

  -- Insert order
  insert into public.orders (
    first_name, last_name, email, phone, order_type,
    delivery_street, delivery_street2, delivery_city, delivery_state, delivery_zip, delivery_landmark,
    classic_chocolate_chip_qty, double_chocolate_qty, chocolate_chip_walnut_qty,
    cookies_cream_qty, kunafa_chocolate_qty, hazelnut_filled_qty, lotus_lava_qty,
    classic_bundle_qty, classic_bundle_flavours,
    premium_bundle_qty, premium_bundle_flavours,
    total_amount, payment_proof_url, payment_status, order_status,
    items_breakdown
  ) values (
    p_first_name, p_last_name, p_email, p_phone, p_order_type,
    p_delivery_street, p_delivery_street2, p_delivery_city, p_delivery_state, p_delivery_zip, p_delivery_landmark,
    p_classic_chocolate_chip_qty, p_double_chocolate_qty, p_chocolate_chip_walnut_qty,
    p_cookies_cream_qty, p_kunafa_chocolate_qty, p_hazelnut_filled_qty, p_lotus_lava_qty,
    p_classic_bundle_qty, p_classic_bundle_flavours,
    p_premium_bundle_qty, p_premium_bundle_flavours,
    p_total_amount, p_payment_proof_url, 'pending', 'received',
    p_items_breakdown
  ) returning id into r_order_id;

  return json_build_object('success', true, 'order_id', r_order_id);
exception when others then
  return json_build_object('success', false, 'error', SQLERRM);
end;
$$ language plpgsql;
