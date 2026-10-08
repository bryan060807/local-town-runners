-- Apply ONCE to the Phase 2 Supabase project. Entire upgrade is atomic.
-- Preserves existing customers, vendors, orders and payment history.
begin;
create table public.demo_settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.demo_settings values(true,false);
create table public.demo_workspaces(id uuid primary key,is_template boolean not null default false,expires_at timestamptz not null,created_at timestamptz not null default now());
create unique index one_demo_template on public.demo_workspaces(is_template) where is_template;
create table public.demo_sessions(token_hash text primary key,workspace_id uuid not null references public.demo_workspaces,credentials text not null,customer_id uuid not null references public.profiles,vendor_id uuid not null references public.profiles,runner_id uuid not null references public.profiles,expires_at timestamptz not null);
alter table public.profiles add column demo_workspace uuid references public.demo_workspaces;
alter table public.vendors add column demo_workspace uuid references public.demo_workspaces;
alter table public.listings add column secondhand boolean not null default false,add column demo_stock integer;
alter table public.runners add column transportation text not null default 'Walking';
grant update(transportation) on public.runners to authenticated;
create table public.cart_items(customer_id uuid not null references public.profiles,listing_id uuid not null references public.listings,quantity integer not null check(quantity between 1 and 20),primary key(customer_id,listing_id));
create table public.order_items(order_id uuid not null references public.orders on delete cascade,listing_id uuid not null references public.listings,title text not null,quantity integer not null check(quantity between 1 and 20),unit_price_cents bigint not null,primary key(order_id,listing_id));
create table public.customer_preferences(customer_id uuid primary key references public.profiles,delivery_address text not null default 'DEMO TEST ADDRESS — not a real residence, Louisiana, MO',delivery_notes text not null default '',check(length(delivery_address) between 8 and 500),check(length(delivery_notes)<=500));
create table public.inquiries(id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.profiles,listing_id uuid not null references public.listings,message text not null check(length(message) between 5 and 1000),status text not null default 'OPEN' check(status in ('OPEN','RESPONDED','CLOSED')),response text not null default '' check(length(response)<=2000),created_at timestamptz not null default now());
alter table public.orders add column refund_state text not null default 'NONE' check(refund_state in ('NONE','PENDING','COMPLETED')),add column paypal_refund_id text unique;
create table public.demo_entry_limits(key_hash text not null,window_start timestamptz not null,count integer not null,primary key(key_hash,window_start));

create function public.demo_mode_enabled() returns boolean language sql stable security definer set search_path='' as $$select coalesce((select enabled from public.demo_settings where id),false);$$;
create function public.demo_profile_active(profile_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles p where p.id=profile_id and not p.suspended and (p.demo_workspace is null or (public.demo_mode_enabled() and exists(select 1 from public.demo_workspaces w where w.id=p.demo_workspace and w.expires_at>now()))));$$;
create or replace function public.account_active() returns boolean language sql stable security definer set search_path='' as $$select public.demo_profile_active(auth.uid());$$;
create or replace function public.has_role(wanted public.app_role) returns boolean language sql stable security definer set search_path='' as $$select public.account_active() and exists(select 1 from public.user_roles where user_id=auth.uid() and role=wanted);$$;
create or replace function public.profile_enabled(p uuid) returns boolean language sql stable security definer set search_path='' as $$select p is null or public.demo_profile_active(p);$$;
create function public.demo_visible(scope uuid) returns boolean language plpgsql stable security definer set search_path='' as $$declare mine uuid;begin
select demo_workspace into mine from public.profiles where id=auth.uid();
if public.has_role('admin') then return true;end if;
if mine is not null then return public.account_active() and mine=scope;end if;
if scope is null then return true;end if;
return public.demo_mode_enabled() and exists(select 1 from public.demo_workspaces where id=scope and is_template and expires_at>now());end;$$;
create function public.demo_runner_visible(runner_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=runner_id and public.demo_visible(demo_workspace));$$;
create function public.demo_vendor_visible(vendor_id uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.vendors where id=vendor_id and public.demo_visible(demo_workspace));$$;
create or replace function public.public_vendor_enabled(v uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.vendors where id=v and active and public.profile_enabled(owner_id) and public.demo_visible(demo_workspace));$$;
drop policy vendors_read on public.vendors;
create policy vendors_read on public.vendors for select using(((active and public.profile_enabled(owner_id)) and public.demo_visible(demo_workspace)) or public.owns_vendor(id) or public.has_role('admin'));
drop policy listings_read on public.listings;
create policy listings_read on public.listings for select using((active and not prohibited and public.public_vendor_enabled(vendor_id)) or public.owns_vendor(vendor_id) or public.has_role('admin'));
drop policy runner_read on public.runners;
create policy runner_read on public.runners for select using((visible and available_until>now() and public.profile_enabled(id) and public.demo_runner_visible(id)) or (id=auth.uid() and public.account_active()) or public.has_role('admin'));
drop policy trips_read on public.runner_trips;
create policy trips_read on public.runner_trips for select using((expires_at>now() and public.demo_runner_visible(runner_id) and exists(select 1 from public.runners where id=runner_id and visible and available_until>now())) or (runner_id=auth.uid() and public.account_active()) or public.has_role('admin'));

create or replace function public.replace_trip_intention() returns trigger language plpgsql security definer set search_path='' as $$declare runner_scope uuid;begin
perform pg_advisory_xact_lock(hashtextextended(new.runner_id::text,0));
select demo_workspace into runner_scope from public.profiles where id=new.runner_id;
if not exists(select 1 from public.vendors v where v.id=new.destination_vendor_id and v.active and public.profile_enabled(v.owner_id) and v.demo_workspace is not distinct from runner_scope) then raise exception 'Destination unavailable';end if;
update public.runner_trips set expires_at=now() where runner_id=new.runner_id and expires_at>now() and id<>new.id;return new;end;$$;

-- New shops created by demo vendors must stay inside their workspace.
create function public.guard_demo_vendor() returns trigger language plpgsql security definer set search_path='' as $$begin
select demo_workspace into new.demo_workspace from public.profiles where id=new.owner_id;
if new.demo_workspace is not null then new.demo=true;new.verified=false;end if;return new;end;$$;
create trigger guard_demo_vendor before insert on public.vendors for each row execute function public.guard_demo_vendor();
revoke execute on function public.guard_demo_vendor() from public,anon,authenticated;

-- Security-definer order functions cannot cross demo workspaces or buy service quotes.
create function public.guard_demo_order() returns trigger language plpgsql security definer set search_path='' as $$declare customer_scope uuid;vendor_scope uuid;listing_mode text;begin
select demo_workspace into customer_scope from public.profiles where id=new.customer_id;
select demo_workspace into vendor_scope from public.vendors where id=new.vendor_id;
select mode into listing_mode from public.listings where id=new.listing_id;
if not public.has_role('customer') or customer_scope is distinct from vendor_scope then raise exception 'Enter your isolated demo workspace or select your own marketplace';end if;
if listing_mode<>'SELL' then raise exception 'Request a quote for MAKE or DO listings';end if;return new;end;$$;
create trigger guard_demo_order before insert on public.orders for each row execute function public.guard_demo_order();
create function public.guard_demo_assignment() returns trigger language plpgsql security definer set search_path='' as $$declare c uuid;r uuid;begin
if new.runner_id is not null and new.runner_id is distinct from old.runner_id then
select demo_workspace into c from public.profiles where id=new.customer_id;select demo_workspace into r from public.profiles where id=new.runner_id;
if c is distinct from r then raise exception 'Runner belongs to another marketplace';end if;end if;return new;end;$$;
create trigger guard_demo_assignment before update of runner_id on public.orders for each row execute function public.guard_demo_assignment();
create function public.demo_address_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
if exists(select 1 from public.orders o join public.profiles p on p.id=o.customer_id where o.id=new.order_id and p.demo_workspace is not null) then new.delivery_address='DEMO TEST ADDRESS — not a real residence, Louisiana, MO';end if;return new;end;$$;
create trigger demo_address_guard before insert or update on public.order_private for each row execute function public.demo_address_guard();
create function public.single_order_item() returns trigger language plpgsql security definer set search_path='' as $$begin
insert into public.order_items(order_id,listing_id,title,quantity,unit_price_cents) select new.id,new.listing_id,title,new.quantity,new.unit_price_cents from public.listings where id=new.listing_id;return new;end;$$;
create trigger single_order_item after insert on public.orders for each row execute function public.single_order_item();
insert into public.order_items select o.id,o.listing_id,l.title,o.quantity,o.unit_price_cents from public.orders o join public.listings l on l.id=o.listing_id;

create function public.cart_guard() returns trigger language plpgsql security definer set search_path='' as $$declare l public.listings;c uuid;v uuid;begin
if not public.account_active() or new.customer_id<>auth.uid() or not public.has_role('customer') then raise exception 'Customer required';end if;
perform 1 from public.profiles where id=auth.uid() for update;
select * into l from public.listings where id=new.listing_id;
select demo_workspace into c from public.profiles where id=new.customer_id;select demo_workspace into v from public.vendors where id=l.vendor_id;
if not l.active or l.prohibited or l.mode<>'SELL' or l.inventory<new.quantity or not public.public_vendor_enabled(l.vendor_id) or c is distinct from v then raise exception 'Listing unavailable for this cart';end if;return new;end;$$;
create trigger cart_guard before insert or update on public.cart_items for each row execute function public.cart_guard();
create function public.prepare_cart(vendor_id uuid,request_key uuid,delivery_address text) returns public.orders language plpgsql security definer set search_path='' as $$declare o public.orders;l public.listings;item record;qty integer=0;total bigint=0;first_id uuid;first_price bigint;begin
if not public.has_role('customer') or length(delivery_address) not between 8 and 500 then raise exception 'Customer and delivery address required';end if;
perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||request_key::text,0));
select * into o from public.orders where customer_id=auth.uid() and orders.request_key=prepare_cart.request_key;if found then return o;end if;
perform 1 from public.profiles where id=auth.uid() for update;
for item in select c.listing_id,c.quantity from public.cart_items c join public.listings x on x.id=c.listing_id where c.customer_id=auth.uid() and x.vendor_id=prepare_cart.vendor_id order by c.listing_id for update of c loop
select * into l from public.listings where id=item.listing_id for update;
if not l.active or l.prohibited or l.mode<>'SELL' or l.inventory<item.quantity or not public.public_vendor_enabled(l.vendor_id) then raise exception 'Cart inventory unavailable';end if;
qty=qty+item.quantity;total=total+l.price_cents*item.quantity;if first_id is null then first_id=l.id;first_price=l.price_cents;end if;
end loop;
if first_id is null or qty>20 then raise exception 'Cart must contain 1–20 units for this vendor';end if;
insert into public.orders(customer_id,listing_id,vendor_id,quantity,unit_price_cents,total_cents,request_key) values(auth.uid(),first_id,vendor_id,qty,first_price,total,request_key) returning * into o;
delete from public.order_items where order_id=o.id;
for item in select c.listing_id,c.quantity from public.cart_items c join public.listings x on x.id=c.listing_id where c.customer_id=auth.uid() and x.vendor_id=prepare_cart.vendor_id order by c.listing_id loop
update public.listings set inventory=inventory-item.quantity where id=item.listing_id;
insert into public.order_items select o.id,item.listing_id,title,item.quantity,price_cents from public.listings where id=item.listing_id;
end loop;
delete from public.cart_items c using public.listings x where c.listing_id=x.id and c.customer_id=auth.uid() and x.vendor_id=prepare_cart.vendor_id;
insert into public.order_private values(o.id,delivery_address);insert into public.order_events(order_id,actor_id,event) values(o.id,auth.uid(),'CART_RESERVED');return o;end;$$;
create or replace function public.cancel_draft(order_id uuid) returns void language plpgsql security definer set search_path='' as $$declare o public.orders;begin
select * into o from public.orders where id=order_id for update;
if not found or o.customer_id<>auth.uid() or not public.account_active() then raise exception 'Cannot cancel';end if;
if o.state='CANCELLED' then return;end if;
if o.state<>'DRAFT' or o.paypal_order_id is not null then raise exception 'Cannot cancel';end if;
update public.listings l set inventory=l.inventory+i.quantity from public.order_items i where i.order_id=o.id and l.id=i.listing_id;
update public.orders set state='CANCELLED' where id=o.id;insert into public.order_events(order_id,actor_id,event) values(o.id,auth.uid(),'ORDER_CANCELLED');end;$$;

create function public.guard_inquiry() returns trigger language plpgsql security definer set search_path='' as $$declare c uuid;v uuid;begin
select demo_workspace into c from public.profiles where id=new.customer_id;select demo_workspace into v from public.vendors where id=(select vendor_id from public.listings where id=new.listing_id);
if c is distinct from v or not exists(select 1 from public.listings where id=new.listing_id and active and not prohibited and public.public_vendor_enabled(vendor_id)) then raise exception 'Inquiry unavailable';end if;return new;end;$$;
create trigger guard_inquiry before insert on public.inquiries for each row execute function public.guard_inquiry();

alter table public.demo_settings enable row level security;alter table public.demo_workspaces enable row level security;alter table public.demo_sessions enable row level security;alter table public.demo_entry_limits enable row level security;
alter table public.cart_items enable row level security;alter table public.order_items enable row level security;alter table public.customer_preferences enable row level security;alter table public.inquiries enable row level security;
create policy cart_owner on public.cart_items for all to authenticated using(customer_id=auth.uid() and public.has_role('customer')) with check(customer_id=auth.uid() and public.has_role('customer'));
create policy order_item_read on public.order_items for select to authenticated using(public.order_access(order_id));
create policy preferences_owner on public.customer_preferences for all to authenticated using(customer_id=auth.uid() and public.has_role('customer')) with check(customer_id=auth.uid() and public.has_role('customer'));
create policy inquiry_read on public.inquiries for select to authenticated using((customer_id=auth.uid() and public.account_active()) or public.owns_vendor((select vendor_id from public.listings where id=listing_id)));
create policy inquiry_insert on public.inquiries for insert to authenticated with check(customer_id=auth.uid() and public.has_role('customer'));
create policy inquiry_respond on public.inquiries for update to authenticated using(public.owns_vendor((select vendor_id from public.listings where id=listing_id))) with check(public.owns_vendor((select vendor_id from public.listings where id=listing_id)));
revoke all on public.demo_settings,public.demo_workspaces,public.demo_sessions,public.demo_entry_limits,public.cart_items,public.order_items,public.customer_preferences,public.inquiries from anon,authenticated;
grant select,insert,update,delete on public.cart_items,public.customer_preferences to authenticated;
grant select on public.order_items to authenticated;grant select,insert on public.inquiries to authenticated;grant update(status,response) on public.inquiries to authenticated;
grant all on public.demo_settings,public.demo_workspaces,public.demo_sessions,public.demo_entry_limits,public.cart_items,public.order_items,public.customer_preferences,public.inquiries to service_role;
create function public.consume_demo_entry(key_hash text) returns void language plpgsql security definer set search_path='' as $$declare n integer;begin
insert into public.demo_entry_limits values(key_hash,date_trunc('hour',now()),1) on conflict on constraint demo_entry_limits_pkey do update set count=demo_entry_limits.count+1 returning count into n;if n>5 then raise exception 'Demo entry limit exceeded';end if;end;$$;
revoke execute on function public.demo_mode_enabled(),public.demo_profile_active(uuid),public.demo_visible(uuid),public.demo_runner_visible(uuid),public.demo_vendor_visible(uuid),public.guard_demo_order(),public.guard_demo_assignment(),public.demo_address_guard(),public.single_order_item(),public.cart_guard(),public.guard_inquiry(),public.prepare_cart(uuid,uuid,text),public.consume_demo_entry(text) from public,anon,authenticated;
grant execute on function public.demo_mode_enabled(),public.demo_profile_active(uuid),public.demo_visible(uuid),public.demo_runner_visible(uuid),public.demo_vendor_visible(uuid) to anon,authenticated;
grant execute on function public.prepare_cart(uuid,uuid,text) to authenticated;
grant execute on function public.consume_demo_entry(text),public.demo_mode_enabled() to service_role;
create table public.runner_declines(runner_id uuid not null references public.runners,order_id uuid not null references public.orders,primary key(runner_id,order_id));
alter table public.runner_declines enable row level security;
revoke all on public.runner_declines from anon,authenticated;grant all on public.runner_declines to service_role;
create function public.decline_run(order_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
if not public.has_role('runner') or not exists(select 1 from public.orders o join public.vendors v on v.id=o.vendor_id where o.id=order_id and o.state='RUNNER_MATCHING' and o.refund_state='NONE' and public.public_vendor_enabled(v.id) and (select demo_workspace from public.profiles where id=o.customer_id) is not distinct from (select demo_workspace from public.profiles where id=auth.uid())) then raise exception 'Run unavailable';end if;
insert into public.runner_declines values(auth.uid(),order_id) on conflict do nothing;end;$$;
revoke execute on function public.decline_run(uuid) from public,anon;grant execute on function public.decline_run(uuid) to authenticated;
create or replace function public.available_runs() returns table(id uuid,vendor_name text,category text,public_lon numeric,public_lat numeric) language sql stable security definer set search_path='' as $$select o.id,v.name,l.category,v.public_lon,v.public_lat from public.orders o join public.vendors v on v.id=o.vendor_id join public.listings l on l.id=o.listing_id join public.runners r on r.id=auth.uid() where r.visible and r.available_until>now() and not exists(select 1 from public.order_items i join public.listings li on li.id=i.listing_id where i.order_id=o.id and not li.category=any(r.categories)) and 3958.8*2*asin(least(1,sqrt(power(sin(radians((v.public_lat-r.public_lat)::double precision)/2),2)+cos(radians(r.public_lat::double precision))*cos(radians(v.public_lat::double precision))*power(sin(radians((v.public_lon-r.public_lon)::double precision)/2),2))))<=r.max_detour_miles and (select count(*) from public.orders assigned where assigned.runner_id=r.id and assigned.state in ('RUNNER_ASSIGNED','READY_FOR_PICKUP','PICKED_UP','OUT_FOR_DELIVERY'))<3 and not exists(select 1 from public.runner_declines d where d.order_id=o.id and d.runner_id=auth.uid()) and o.state='RUNNER_MATCHING' and o.refund_state='NONE' and public.has_role('runner') and public.public_vendor_enabled(v.id) and (select demo_workspace from public.profiles where id=o.customer_id) is not distinct from (select demo_workspace from public.profiles where id=auth.uid());$$;
create or replace function public.runner_workloads() returns table(runner_id uuid,workload bigint) language sql stable security definer set search_path='' as $$select r.id,count(o.id) from public.runners r left join public.orders o on o.runner_id=r.id and o.state in ('RUNNER_ASSIGNED','READY_FOR_PICKUP','PICKED_UP','OUT_FOR_DELIVERY') where r.visible and r.available_until>now() and public.profile_enabled(r.id) and public.demo_runner_visible(r.id) group by r.id;$$;
notify pgrst,'reload schema';

create function public.begin_refund(order_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$declare o public.orders;begin
select * into o from public.orders where id=order_id for update;
if not found or o.paypal_capture_id is null or o.runner_id is not null or (o.refund_state<>'COMPLETED' and o.state not in ('PAID','VENDOR_ACCEPTED','RUNNER_MATCHING')) then raise exception 'Order not refundable';end if;
if o.refund_state='NONE' then update public.orders set refund_state='PENDING' where id=o.id;insert into public.order_events(order_id,event) values(o.id,'REFUND_REQUESTED');end if;
select * into o from public.orders where id=order_id;return o;end;$$;
create function public.confirm_refund(order_id uuid,refund_id text,amount_cents bigint) returns void language plpgsql security definer set search_path='' as $$declare o public.orders;begin
select * into o from public.orders where id=order_id for update;
if not found or amount_cents<>o.total_cents or refund_id is null or length(refund_id) not between 1 and 100 then raise exception 'Refund mismatch';end if;
if o.refund_state='COMPLETED' and o.paypal_refund_id=refund_id then return;end if;
if o.refund_state<>'PENDING' or o.runner_id is not null then raise exception 'Refund not pending';end if;
update public.listings l set inventory=l.inventory+i.quantity from public.order_items i where i.order_id=o.id and l.id=i.listing_id;
insert into public.ledger(order_id,kind,amount_cents,simulated) values(o.id,'REFUND',-o.total_cents,false);
update public.orders set refund_state='COMPLETED',paypal_refund_id=refund_id,state='CANCELLED' where id=o.id;
insert into public.order_events(order_id,event) values(o.id,'PAYMENT_REFUNDED');insert into public.audit_events(event,resource_id) values('PAYMENT_REFUNDED',o.id);end;$$;
create function public.guard_pending_refund() returns trigger language plpgsql set search_path='' as $$begin
if old.refund_state='PENDING' and new.state is distinct from old.state and new.state<>'CANCELLED' then raise exception 'Refund reconciliation is pending';end if;return new;end;$$;
create trigger guard_pending_refund before update of state on public.orders for each row execute function public.guard_pending_refund();
-- Every item category must fit, even when a cart groups multiple products.
create function public.guard_assignment_items() returns trigger language plpgsql security definer set search_path='' as $$begin
if new.runner_id is not null and new.runner_id is distinct from old.runner_id then
if old.refund_state<>'NONE' or exists(select 1 from public.order_items i join public.listings l on l.id=i.listing_id join public.runners r on r.id=new.runner_id where i.order_id=new.id and not l.category=any(r.categories)) then raise exception 'Runner cannot fulfill every item';end if;end if;return new;end;$$;
create trigger guard_assignment_items before update of runner_id on public.orders for each row execute function public.guard_assignment_items();
revoke execute on function public.begin_refund(uuid),public.confirm_refund(uuid,text,bigint),public.guard_pending_refund(),public.guard_assignment_items() from public,anon,authenticated;
grant execute on function public.begin_refund(uuid),public.confirm_refund(uuid,text,bigint) to service_role;
create function public.phase3_ready() returns boolean language sql stable set search_path='' as $$select true;$$;
revoke execute on function public.phase3_ready() from public,anon,authenticated;grant execute on function public.phase3_ready() to service_role;
notify pgrst,'reload schema';

commit;
select public.phase3_ready();
