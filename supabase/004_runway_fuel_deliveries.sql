begin;

create table if not exists public.rf_order_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  delivered_at timestamptz not null default timezone('utc', now()),
  order_id uuid not null references public.rf_orders(id) on delete cascade,
  delivered_by text,
  summary text not null,
  message text,
  links jsonb not null default '[]'::jsonb,
  delivery_payload jsonb not null default '{}'::jsonb,
  constraint rf_order_deliveries_order_id_key unique (order_id),
  constraint rf_order_deliveries_summary_not_blank check (length(btrim(summary)) > 0)
);

create index if not exists rf_order_deliveries_created_at_idx
  on public.rf_order_deliveries (created_at desc);

alter table public.rf_order_deliveries enable row level security;
revoke all on table public.rf_order_deliveries from anon, authenticated;

comment on table public.rf_order_deliveries is
  'Operator-issued deliverables per order. Access is restricted to server-side service role flows.';

drop trigger if exists rf_order_deliveries_set_updated_at on public.rf_order_deliveries;
create trigger rf_order_deliveries_set_updated_at
before update on public.rf_order_deliveries
for each row
execute function public.rf_set_updated_at();

commit;
