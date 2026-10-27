-- Local Town Runners: community reputation upgrade (after migrations 001-014).
-- Paste this whole file into the existing project's SQL Editor and run once.
-- Safe to retry: creates read-only aggregate RPCs and supporting indexes only.
-- Existing orders, reviews, payment records and runner rewards remain intact.
begin;

-- Reputation is derived from recorded payment and completion evidence. These
-- functions never award money, write counters, change orders or grant roles.
create index if not exists reputation_completed_events
  on public.order_events(order_id) where event='COMPLETED';
create index if not exists reputation_vendor_orders
  on public.orders(vendor_id,customer_id) where paypal_capture_id is not null;
create index if not exists reputation_customer_orders
  on public.orders(customer_id,vendor_id) where paypal_capture_id is not null;

create or replace function public.vendor_reputation(vendor_ids uuid[])
returns table(
  vendor_id uuid,
  completed_orders bigint,
  review_count bigint,
  average_rating numeric,
  community_favorite boolean
)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(cardinality(vendor_ids),0)>100 then
    raise exception 'Request at most 100 vendors' using errcode='22023';
  end if;
  return query
  with eligible as (
    select o.id,o.vendor_id,o.customer_id
    from public.orders o
    join public.vendors v on v.id=o.vendor_id
    join public.profiles c on c.id=o.customer_id
    where v.id=any(coalesce(vendor_ids,'{}'::uuid[]))
      and public.public_vendor_enabled(v.id)
      and public.demo_profile_active(c.id)
      and o.customer_id is distinct from v.owner_id
      and c.demo_workspace is not distinct from v.demo_workspace
      and o.paypal_capture_id is not null
      and o.total_cents>0
      and exists(select 1 from public.ledger l where l.order_id=o.id
        and l.kind='CUSTOMER_PAYMENT' and not l.simulated
        and l.amount_cents=o.total_cents)
      and (o.state='COMPLETED' or exists(select 1 from public.order_events e
        where e.order_id=o.id and e.event='COMPLETED'))
  )
  select v.id,count(e.id),count(r.id),round(avg(r.rating),2),
    count(distinct r.customer_id)>=5 and coalesce(avg(r.rating)>=4.5,false)
  from public.vendors v
  left join eligible e on e.vendor_id=v.id
  left join public.reviews r on r.order_id=e.id and r.customer_id=e.customer_id
  where v.id=any(coalesce(vendor_ids,'{}'::uuid[]))
    and public.public_vendor_enabled(v.id)
  group by v.id;
end;
$$;

create or replace function public.my_community_progress()
returns table(
  completed_orders bigint,
  thoughtful_reviews bigint,
  points bigint,
  vendor_completed_orders bigint,
  vendor_review_count bigint,
  vendor_average_rating numeric,
  demo boolean
)
language plpgsql stable security definer set search_path='' as $$
declare mine uuid; scope uuid;
begin
  mine=auth.uid();
  if mine is null or not public.account_active() then
    raise exception 'Active account required' using errcode='42501';
  end if;
  select p.demo_workspace into scope from public.profiles p where p.id=mine;
  return query
  with eligible as (
    select o.id,o.customer_id,v.owner_id
    from public.orders o
    join public.vendors v on v.id=o.vendor_id
    join public.profiles c on c.id=o.customer_id
    where (o.customer_id=mine or v.owner_id=mine)
      and public.demo_profile_active(c.id)
      and o.customer_id is distinct from v.owner_id
      and c.demo_workspace is not distinct from v.demo_workspace
      and v.demo_workspace is not distinct from scope
      and o.paypal_capture_id is not null
      and o.total_cents>0
      and exists(select 1 from public.ledger l where l.order_id=o.id
        and l.kind='CUSTOMER_PAYMENT' and not l.simulated
        and l.amount_cents=o.total_cents)
      and (o.state='COMPLETED' or exists(select 1 from public.order_events e
        where e.order_id=o.id and e.event='COMPLETED'))
  ), totals as (
    select count(*) filter(where e.customer_id=mine) as customer_orders,
      count(*) filter(where e.customer_id=mine and length(btrim(r.comment))>=20) as customer_reviews,
      count(*) filter(where e.owner_id=mine) as vendor_orders,
      count(r.id) filter(where e.owner_id=mine) as vendor_reviews,
      round(avg(r.rating) filter(where e.owner_id=mine),2) as vendor_rating
    from eligible e
    left join public.reviews r on r.order_id=e.id and r.customer_id=e.customer_id
  )
  select t.customer_orders,t.customer_reviews,
    t.customer_orders*10+t.customer_reviews*5,
    t.vendor_orders,t.vendor_reviews,t.vendor_rating,scope is not null
  from totals t;
end;
$$;

-- No direct review rows, customer identifiers, order identifiers, comments or
-- customer scores are added to the public API. Only the aggregate is public.
revoke execute on function public.vendor_reputation(uuid[]),public.my_community_progress()
  from public,anon,authenticated;
grant execute on function public.vendor_reputation(uuid[]) to anon,authenticated,service_role;
grant execute on function public.my_community_progress() to authenticated;
notify pgrst,'reload schema';
commit;
