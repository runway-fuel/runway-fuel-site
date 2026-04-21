begin;

alter table public.rf_customers enable row level security;
alter table public.rf_orders enable row level security;
alter table public.rf_order_intakes enable row level security;
alter table public.rf_order_events enable row level security;

revoke all on table public.rf_customers from anon, authenticated;
revoke all on table public.rf_orders from anon, authenticated;
revoke all on table public.rf_order_intakes from anon, authenticated;
revoke all on table public.rf_order_events from anon, authenticated;

comment on table public.rf_customers is 'Runway Fuel buyers. Access is restricted to server-side service role flows.';
comment on table public.rf_orders is 'Runway Fuel one-time commercial orders. Access is restricted to server-side service role flows.';
comment on table public.rf_order_intakes is 'Structured post-purchase intake records. Access is restricted to server-side service role flows.';
comment on table public.rf_order_events is 'Immutable payment and operations event log. Access is restricted to server-side service role flows.';

commit;
