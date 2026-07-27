-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- Table: email_verifications
-- Stores OTP codes sent to customers for email verification.
create table if not exists public.email_verifications (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  verified boolean default false not null,
  created_at timestamp with time zone default now() not null
);

-- Create index for faster OTP lookup
create index if not exists idx_email_verifications_email_code on public.email_verifications(email, code);

-- Table: phone_verifications
-- Stores OTP codes sent to customers for mobile/WhatsApp verification.
create table if not exists public.phone_verifications (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  verified boolean default false not null,
  created_at timestamp with time zone default now() not null
);

-- Create index for faster phone OTP lookup
create index if not exists idx_phone_verifications_phone_code on public.phone_verifications(phone, code);

-- Table: settings
-- Stores global system configuration, such as cookie stock.
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now() not null
);

-- Table: orders
-- Stores preorder bookings, customer details, item quantities, total price, and payment proof link.
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now() not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  order_type text not null check (order_type in ('dine_in', 'takeaway', 'delivery')),
  
  -- Complete Delivery Address (Optional depending on order_type)
  delivery_street text,
  delivery_street2 text,
  delivery_city text,
  delivery_state text,
  delivery_zip text,
  delivery_landmark text,
  
  -- Cookie Quantities
  classic_chocolate_chip_qty integer default 0,
  double_chocolate_qty integer default 0,
  chocolate_chip_walnut_qty integer default 0,
  cookies_cream_qty integer default 0,
  kunafa_chocolate_qty integer default 0,
  hazelnut_filled_qty integer default 0,
  lotus_lava_qty integer default 0,
  
  -- Bundles
  classic_bundle_qty integer default 0,
  classic_bundle_flavours text,
  premium_bundle_qty integer default 0,
  premium_bundle_flavours text,
  
  -- Total Amount in PKR
  total_amount numeric not null,
  
  -- Payment Verification
  payment_proof_url text not null,
  payment_status text default 'pending' not null check (payment_status in ('pending', 'approved', 'rejected')),
  order_status text default 'received' not null check (order_status in ('received', 'preparing', 'completed', 'cancelled'))
);

-- Create index for filtering orders
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- Insert Default Cookie Stock Settings
insert into public.settings (key, value)
values (
  'cookie_stock', 
  '{"classic_chocolate_chip": true, "double_chocolate": true, "chocolate_chip_walnut": true, "cookies_cream": true, "kunafa_chocolate": true, "hazelnut_filled": true, "lotus_lava": true, "classic_bundle": true, "premium_bundle": true}'::jsonb
)
on conflict (key) do nothing;
