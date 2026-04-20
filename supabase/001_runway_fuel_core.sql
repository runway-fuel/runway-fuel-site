begin;

create extension if not exists pgcrypto;

create or replace function public.rf_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.rf_customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  buyer_email text not null,
  buyer_name text,
  organization text,
  stripe_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  constraint rf_customers_buyer_email_format check (position('@' in buyer_email) > 1)
);

create unique index if not exists rf_customers_buyer_email_key
  on public.rf_customers (buyer_email);

create unique index if not exists rf_customers_stripe_customer_id_key
  on public.rf_customers (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.rf_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  order_number text not null,
  correlation_key text not null,
  customer_id uuid not null references public.rf_customers(id) on delete restrict,
  offer_code text not null,
  offer_label text not null,
  order_kind text not null default 'one_time',
  currency text not null default 'usd',
  amount_subtotal_cents integer not null default 0,
  amount_total_cents integer not null default 0,
  stripe_session_id text not null,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  checkout_status text not null default 'open',
  payment_status text not null default 'paid',
  fulfillment_status text not null default 'paid',
  fulfillment_due_at timestamptz,
  paid_at timestamptz,
  buyer_email text not null,
  buyer_name text,
  organization text,
  order_metadata jsonb not null default '{}'::jsonb,
  intake_submitted_at timestamptz,
  constraint rf_orders_order_number_key unique (order_number),
  constraint rf_orders_correlation_key_key unique (correlation_key),
  constraint rf_orders_stripe_session_id_key unique (stripe_session_id),
  constraint rf_orders_stripe_payment_intent_id_key unique (stripe_payment_intent_id),
  constraint rf_orders_offer_code_check check (
    offer_code in ('rf_diagnostic', 'rf_blueprint', 'rf_deposit')
  ),
  constraint rf_orders_order_kind_check check (order_kind = 'one_time'),
  constraint rf_orders_amount_subtotal_nonnegative check (amount_subtotal_cents >= 0),
  constraint rf_orders_amount_total_nonnegative check (amount_total_cents >= 0),
  constraint rf_orders_payment_status_check check (
    payment_status in ('paid', 'unpaid', 'no_payment_required', 'refunded', 'failed', 'partially_refunded')
  ),
  constraint rf_orders_fulfillment_status_check check (
    fulfillment_status in ('paid', 'intake_received', 'in_progress', 'delivery_sent', 'completed', 'blocked', 'canceled')
  )
);

create index if not exists rf_orders_customer_id_idx
  on public.rf_orders (customer_id);

create index if not exists rf_orders_offer_code_idx
  on public.rf_orders (offer_code);

create index if not exists rf_orders_payment_status_idx
  on public.rf_orders (payment_status);

create index if not exists rf_orders_fulfillment_status_idx
  on public.rf_orders (fulfillment_status);

create index if not exists rf_orders_created_at_idx
  on public.rf_orders (created_at desc);

create index if not exists rf_orders_paid_at_idx
  on public.rf_orders (paid_at desc);

create table if not exists public.rf_order_intakes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz not null default timezone('utc', now()),
  order_id uuid not null references public.rf_orders(id) on delete cascade,
  submitted_by_email text,
  project_background text,
  current_stack text,
  constraints text,
  goals text,
  priorities text,
  links jsonb not null default '[]'::jsonb,
  delivery_notes text,
  intake_payload jsonb not null default '{}'::jsonb,
  constraint rf_order_intakes_order_id_key unique (order_id)
);

create index if not exists rf_order_intakes_submitted_at_idx
  on public.rf_order_intakes (submitted_at desc);

create table if not exists public.rf_order_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  order_id uuid references public.rf_orders(id) on delete cascade,
  customer_id uuid references public.rf_customers(id) on delete set null,
  event_kind text not null,
  event_source text not null,
  stripe_event_id text,
  stripe_event_type text,
  stripe_session_id text,
  correlation_key text,
  event_status text not null default 'recorded',
  payload jsonb not null default '{}'::jsonb,
  constraint rf_order_events_stripe_event_id_key unique (stripe_event_id)
);

create index if not exists rf_order_events_order_id_idx
  on public.rf_order_events (order_id);

create index if not exists rf_order_events_customer_id_idx
  on public.rf_order_events (customer_id);

create index if not exists rf_order_events_event_kind_idx
  on public.rf_order_events (event_kind);

create index if not exists rf_order_events_event_source_idx
  on public.rf_order_events (event_source);

create index if not exists rf_order_events_stripe_session_id_idx
  on public.rf_order_events (stripe_session_id);

create index if not exists rf_order_events_created_at_idx
  on public.rf_order_events (created_at desc);

drop trigger if exists rf_customers_set_updated_at on public.rf_customers;
create trigger rf_customers_set_updated_at
before update on public.rf_customers
for each row
execute function public.rf_set_updated_at();

drop trigger if exists rf_orders_set_updated_at on public.rf_orders;
create trigger rf_orders_set_updated_at
before update on public.rf_orders
for each row
execute function public.rf_set_updated_at();

drop trigger if exists rf_order_intakes_set_updated_at on public.rf_order_intakes;
create trigger rf_order_intakes_set_updated_at
before update on public.rf_order_intakes
for each row
execute function public.rf_set_updated_at();

commit;
