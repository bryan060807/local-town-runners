-- Local Town Runners: explicit, isolated, nonfinancial order simulations.
-- Run after migrations 001-015. Safe to retry; existing orders/payment rows
-- are not rewritten. Simulations never create PayPal identifiers or captures.
begin;

alter table public.orders add column if not exists demo_simulated boolean not null default false;
alter table public.orders add column if not exists demo_simulated_at timestamptz;
alter table public.orders drop constraint if exists order_demo_simulation_marker;
alter table public.orders add constraint order_demo_simulation_marker
  check(demo_simulated=(demo_simulated_at is not null));
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check
  check(kind in ('CUSTOMER_PAYMENT','VENDOR_ALLOCATION','RUNNER_ALLOCATION','PLATFORM_ALLOCATION','REFUND','ADJUSTMENT','DEMO_PAYMENT'));
alter table public.ledger drop constraint if exists ledger_demo_payment_simulated;
alter table public.ledger add constraint ledger_demo_payment_simulated
  check(kind<>'DEMO_PAYMENT' or simulated);
create index if not exists demo_simulated_customer_orders on public.orders(customer_id) where demo_simulated;

-- A genuine checkout intent is recorded before any provider call. Once an
-- intent exists, an uncertain provider outcome must never become a simulation.
create table if not exists public.paypal_checkout_intents(
  order_id uuid primary key references public.orders(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.paypal_checkout_intents enable row level security;
drop policy if exists paypal_checkout_intent_read on public.paypal_checkout_intents;
create policy paypal_checkout_intent_read on public.paypal_checkout_intents
  for select to authenticated using(public.order_access(order_id));
revoke all on public.paypal_checkout_intents from public,anon,authenticated;
grant select on public.paypal_checkout_intents to authenticated;
grant all on public.paypal_checkout_intents to service_role;

create or replace function public.claim_paypal_checkout(order_id uuid,customer_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=order_id for update;
  if not found or o.customer_id is distinct from customer_id
    or not public.demo_profile_active(customer_id)
    or o.demo_simulated or o.state not in ('DRAFT','PENDING_PAYMENT')
    or o.paypal_capture_id is not null or o.refund_state<>'NONE' then
    raise exception 'Order is not eligible for PayPal checkout';
  end if;
  insert into public.paypal_checkout_intents(order_id) values(o.id) on conflict do nothing;
  return o;
end;
$$;

create or replace function public.require_private_demo_session(session_hash text,actor_id uuid,acting_role text)
returns public.demo_sessions language plpgsql security definer set search_path='' as $$
declare s public.demo_sessions;
begin
  if not public.demo_mode_enabled() or session_hash is null
    or session_hash !~ '^[a-f0-9]{64}$' or acting_role not in ('customer','vendor') then
    raise exception 'Active isolated demo session required' using errcode='42501';
  end if;
  select d.* into s from public.demo_sessions d
    join public.demo_workspaces w on w.id=d.workspace_id
    where d.token_hash=session_hash and d.expires_at>now()
      and not w.is_template and w.expires_at>now()
      and actor_id=case acting_role when 'customer' then d.customer_id else d.vendor_id end
    for share of d,w;
  if not found or s.customer_id=s.vendor_id or s.customer_id=s.runner_id or s.vendor_id=s.runner_id
    or not exists(select 1 from public.profiles p where p.id=s.customer_id and p.demo_workspace=s.workspace_id and not p.suspended)
    or not exists(select 1 from public.profiles p where p.id=s.vendor_id and p.demo_workspace=s.workspace_id and not p.suspended)
    or not exists(select 1 from public.profiles p where p.id=s.runner_id and p.demo_workspace=s.workspace_id and not p.suspended)
    or not exists(select 1 from public.user_roles r where r.user_id=s.customer_id and r.role='customer')
    or not exists(select 1 from public.user_roles r where r.user_id=s.vendor_id and r.role='vendor')
    or not exists(select 1 from public.user_roles r where r.user_id=s.runner_id and r.role='runner') then
    raise exception 'Active isolated demo session required' using errcode='42501';
  end if;
  return s;
end;
$$;

create or replace function public.guard_order_simulation()
returns trigger language plpgsql security definer set search_path='' as $$
declare scope uuid;
begin
  if tg_op='INSERT' then
    if new.demo_simulated then raise exception 'Prepare a draft before simulating'; end if;
    return new;
  end if;
  if old.demo_simulated and (
    not new.demo_simulated or new.demo_simulated_at is distinct from old.demo_simulated_at
    or new.customer_id<>old.customer_id or new.vendor_id<>old.vendor_id
    or new.listing_id<>old.listing_id or new.total_cents<>old.total_cents
    or new.quantity<>old.quantity or new.unit_price_cents<>old.unit_price_cents
  ) then raise exception 'Simulation provenance is immutable'; end if;
  if new.demo_simulated then
    select demo_workspace into scope from public.profiles where id=new.customer_id;
    if scope is null or not exists(select 1 from public.demo_workspaces w where w.id=scope and not w.is_template)
      or not exists(select 1 from public.vendors v where v.id=new.vendor_id and v.demo_workspace=scope)
      or new.paypal_order_id is not null or new.paypal_capture_id is not null
      or new.paypal_refund_id is not null or new.refund_state<>'NONE'
      or exists(select 1 from public.paypal_checkout_intents c where c.order_id=new.id)
      or exists(select 1 from public.payment_events p where p.order_id=new.id)
      or exists(select 1 from public.payment_recovery p where p.order_id=new.id)
      or exists(select 1 from public.ledger l where l.order_id=new.id and (not l.simulated or l.kind in ('CUSTOMER_PAYMENT','REFUND')))
    then raise exception 'Simulation cannot contain provider payment evidence'; end if;
    if not old.demo_simulated and (old.state<>'DRAFT' or new.state<>'PAID'
      or exists(select 1 from public.ledger l where l.order_id=new.id)) then
      raise exception 'Only an unpaid draft may become a simulation';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_order_simulation on public.orders;
create trigger guard_order_simulation before insert or update on public.orders
  for each row execute function public.guard_order_simulation();

-- Lock the same parent order before allowing financial evidence to be written.
-- This also protects against a provider-intent/simulation race across requests.
create or replace function public.guard_simulation_financial_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
declare simulated_order boolean;
begin
  if tg_op='UPDATE' and new.order_id is distinct from old.order_id then
    raise exception 'Financial evidence cannot be reassigned to another order';
  end if;
  if tg_op='INSERT' then
    select demo_simulated into simulated_order from public.orders where id=new.order_id for update;
  else
    -- Existing evidence already excludes simulation. Avoid inverting the normal
    -- order -> payment_recovery row-lock order during observation updates.
    select demo_simulated into simulated_order from public.orders where id=new.order_id;
  end if;
  if simulated_order then
    if tg_table_name<>'ledger' then
      raise exception 'Simulated orders cannot contain PayPal evidence';
    end if;
    if not new.simulated or new.kind not in ('DEMO_PAYMENT','VENDOR_ALLOCATION','RUNNER_ALLOCATION','PLATFORM_ALLOCATION') then
      raise exception 'Simulated orders require simulated ledger entries';
    end if;
  elsif tg_table_name='ledger' then
    if new.kind='DEMO_PAYMENT' then raise exception 'Demo payment requires simulation provenance'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists simulation_ledger_guard on public.ledger;
create trigger simulation_ledger_guard before insert or update on public.ledger
  for each row execute function public.guard_simulation_financial_evidence();
drop trigger if exists simulation_event_guard on public.payment_events;
create trigger simulation_event_guard before insert or update on public.payment_events
  for each row execute function public.guard_simulation_financial_evidence();
drop trigger if exists simulation_recovery_guard on public.payment_recovery;
create trigger simulation_recovery_guard before insert or update on public.payment_recovery
  for each row execute function public.guard_simulation_financial_evidence();
drop trigger if exists simulation_checkout_guard on public.paypal_checkout_intents;
create trigger simulation_checkout_guard before insert or update on public.paypal_checkout_intents
  for each row execute function public.guard_simulation_financial_evidence();

create or replace function public.simulate_demo_payment(order_id uuid,session_hash text,customer_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.demo_sessions; v bigint; r bigint;
begin
  s=public.require_private_demo_session(session_hash,customer_id,'customer');
  select * into o from public.orders where id=order_id for update;
  if not found or o.customer_id is distinct from customer_id
    or not exists(select 1 from public.vendors vend where vend.id=o.vendor_id
      and vend.owner_id=s.vendor_id and vend.demo_workspace=s.workspace_id and vend.active)
    then raise exception 'Order does not belong to this demo' using errcode='42501'; end if;
  if o.demo_simulated then return o; end if;
  if o.state<>'DRAFT' or o.paypal_order_id is not null or o.paypal_capture_id is not null
    or o.paypal_refund_id is not null or o.refund_state<>'NONE' or o.runner_id is not null
    or exists(select 1 from public.paypal_checkout_intents c where c.order_id=o.id)
    or exists(select 1 from public.payment_recovery p where p.order_id=o.id)
    or exists(select 1 from public.payment_events p where p.order_id=o.id)
    or exists(select 1 from public.ledger l where l.order_id=o.id)
    then raise exception 'Only a draft with no started PayPal checkout can be simulated'; end if;
  if not exists(select 1 from public.order_private p where p.order_id=o.id)
    or not exists(select 1 from public.order_items i where i.order_id=o.id)
    or exists(select 1 from public.order_items i join public.listings l on l.id=i.listing_id
      where i.order_id=o.id and (l.vendor_id<>o.vendor_id or l.mode<>'SELL' or not l.active or l.prohibited))
    then raise exception 'Prepare a valid demo order with a delivery address'; end if;
  update public.orders set state='PAID',demo_simulated=true,demo_simulated_at=now() where id=o.id returning * into o;
  v=o.total_cents*80/100; r=o.total_cents*15/100;
  insert into public.ledger(order_id,kind,amount_cents,simulated) values
    (o.id,'DEMO_PAYMENT',o.total_cents,true),(o.id,'VENDOR_ALLOCATION',v,true),
    (o.id,'RUNNER_ALLOCATION',r,true),(o.id,'PLATFORM_ALLOCATION',o.total_cents-v-r,true);
  insert into public.order_events(order_id,actor_id,event) values(o.id,customer_id,'DEMO_PAYMENT_SIMULATED');
  insert into public.audit_events(actor_id,event,resource_id) values(customer_id,'DEMO_PAYMENT_SIMULATED',o.id);
  return o;
end;
$$;

create or replace function public.cancel_demo_order(order_id uuid,session_hash text,actor_id uuid)
returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders; s public.demo_sessions;
begin
  s=public.require_private_demo_session(session_hash,actor_id,'vendor');
  select * into o from public.orders where id=order_id for update;
  if not found or not o.demo_simulated or o.customer_id<>s.customer_id
    or not exists(select 1 from public.vendors v where v.id=o.vendor_id
      and v.owner_id=s.vendor_id and v.demo_workspace=s.workspace_id)
    then raise exception 'Simulated order does not belong to this demo' using errcode='42501'; end if;
  if o.state='CANCELLED' then return o; end if;
  if o.state not in ('PAID','VENDOR_ACCEPTED','RUNNER_MATCHING') or o.runner_id is not null then
    raise exception 'Assigned or completed simulations cannot be cancelled';
  end if;
  update public.listings l set inventory=l.inventory+i.quantity
    from public.order_items i where i.order_id=o.id and l.id=i.listing_id;
  update public.orders set state='CANCELLED' where id=o.id returning * into o;
  insert into public.order_events(order_id,actor_id,event) values(o.id,actor_id,'DEMO_ORDER_CANCELLED');
  insert into public.audit_events(actor_id,event,resource_id) values(actor_id,'DEMO_ORDER_CANCELLED',o.id);
  return o;
end;
$$;

create or replace function public.available_runs_with_source()
returns table(id uuid,vendor_name text,category text,public_lon numeric,public_lat numeric,demo_simulated boolean)
language sql stable security definer set search_path='' as $$
  select r.id,r.vendor_name,r.category,r.public_lon,r.public_lat,o.demo_simulated
  from public.available_runs() r join public.orders o on o.id=r.id;
$$;

revoke execute on function public.require_private_demo_session(text,uuid,text),public.guard_order_simulation(),
  public.guard_simulation_financial_evidence(),public.claim_paypal_checkout(uuid,uuid),
  public.simulate_demo_payment(uuid,text,uuid),public.cancel_demo_order(uuid,text,uuid),
  public.available_runs_with_source() from public,anon,authenticated;
grant execute on function public.claim_paypal_checkout(uuid,uuid),public.simulate_demo_payment(uuid,text,uuid),
  public.cancel_demo_order(uuid,text,uuid) to service_role;
grant execute on function public.available_runs_with_source() to authenticated;

-- Private demo recognition can use explicit simulated evidence; genuine public
-- reputation still requires genuine capture/ledger evidence. No seed ratings.
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
      and o.total_cents>0
      and ((not o.demo_simulated and o.paypal_capture_id is not null
        and exists(select 1 from public.ledger l where l.order_id=o.id
          and l.kind='CUSTOMER_PAYMENT' and not l.simulated and l.amount_cents=o.total_cents))
        or (o.demo_simulated and o.demo_simulated_at is not null
          and o.paypal_order_id is null and o.paypal_capture_id is null
          and c.demo_workspace is not null
          and c.demo_workspace=(select p.demo_workspace from public.profiles p where p.id=auth.uid())
          and exists(select 1 from public.demo_workspaces w where w.id=c.demo_workspace and not w.is_template and w.expires_at>now())
          and exists(select 1 from public.ledger l where l.order_id=o.id
            and l.kind='DEMO_PAYMENT' and l.simulated and l.amount_cents=o.total_cents)
          and not exists(select 1 from public.ledger l where l.order_id=o.id and not l.simulated)))
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
      and o.total_cents>0
      and ((not o.demo_simulated and o.paypal_capture_id is not null
        and exists(select 1 from public.ledger l where l.order_id=o.id
          and l.kind='CUSTOMER_PAYMENT' and not l.simulated and l.amount_cents=o.total_cents))
        or (o.demo_simulated and o.demo_simulated_at is not null
          and o.paypal_order_id is null and o.paypal_capture_id is null
          and c.demo_workspace is not null
          and c.demo_workspace=(select p.demo_workspace from public.profiles p where p.id=auth.uid())
          and exists(select 1 from public.demo_workspaces w where w.id=c.demo_workspace and not w.is_template and w.expires_at>now())
          and exists(select 1 from public.ledger l where l.order_id=o.id
            and l.kind='DEMO_PAYMENT' and l.simulated and l.amount_cents=o.total_cents)
          and not exists(select 1 from public.ledger l where l.order_id=o.id and not l.simulated)))
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

revoke execute on function public.vendor_reputation(uuid[]),public.my_community_progress() from public,anon,authenticated;
grant execute on function public.vendor_reputation(uuid[]) to anon,authenticated,service_role;
grant execute on function public.my_community_progress() to authenticated;
notify pgrst,'reload schema';
commit;
