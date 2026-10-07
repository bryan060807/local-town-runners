begin;
-- A browser must never bind an arbitrary payment identifier to a local order.
revoke execute on function public.attach_paypal_order(uuid,text) from public,anon,authenticated,service_role;
create function public.attach_verified_paypal_order(order_id uuid,paypal_id text,customer_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
select * into o from public.orders where id=order_id for update;
if not found or o.customer_id is distinct from customer_id or not public.profile_enabled(customer_id) or o.state not in ('DRAFT','PENDING_PAYMENT') or (o.paypal_order_id is not null and o.paypal_order_id<>paypal_id) or paypal_id is null or length(paypal_id) not between 1 and 100 then raise exception 'Order not payable';end if;
if o.paypal_order_id=paypal_id and o.state='PENDING_PAYMENT' then return;end if;
update public.orders set paypal_order_id=paypal_id,state='PENDING_PAYMENT' where id=o.id;
insert into public.order_events(order_id,actor_id,event) values(o.id,customer_id,'PAYMENT_PENDING');
end; $$;
revoke execute on function public.attach_verified_paypal_order(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.attach_verified_paypal_order(uuid,text,uuid) to service_role;

create or replace function public.accept_run(order_id uuid) returns public.orders language plpgsql security definer set search_path='' as $$
declare o public.orders;r public.runners;l public.listings;v public.vendors;distance numeric;
begin
if not public.has_role('runner') then raise exception 'Runner required';end if;
select * into r from public.runners where id=auth.uid() for update;
if not found or not r.visible or r.available_until is null or r.available_until<=now() then raise exception 'Runner unavailable';end if;
select * into o from public.orders where id=order_id for update;
if not found or o.state<>'RUNNER_MATCHING' then raise exception 'Order unavailable';end if;
select * into l from public.listings where id=o.listing_id;
select * into v from public.vendors where id=o.vendor_id;
if not public.public_vendor_enabled(v.id) or not l.category=any(r.categories) then raise exception 'Incompatible pickup';end if;
distance=3958.8*2*asin(least(1,sqrt(power(sin(radians((v.public_lat-r.public_lat)::double precision)/2),2)+cos(radians(r.public_lat::double precision))*cos(radians(v.public_lat::double precision))*power(sin(radians((v.public_lon-r.public_lon)::double precision)/2),2))));
if distance>r.max_detour_miles then raise exception 'Pickup outside declared approach limit';end if;
if (select count(*) from public.orders where runner_id=r.id and state in ('RUNNER_ASSIGNED','READY_FOR_PICKUP','PICKED_UP','OUT_FOR_DELIVERY'))>=3 then raise exception 'Workload exceeded';end if;
update public.orders set runner_id=r.id,state='RUNNER_ASSIGNED' where id=o.id;
insert into public.order_events(order_id,actor_id,event) values(o.id,auth.uid(),'RUNNER_ASSIGNED');
select * into o from public.orders where id=order_id;return o;
end; $$;
-- One current trip intention per runner. Serialize concurrent submissions.
create function public.replace_trip_intention() returns trigger language plpgsql security definer set search_path='' as $$
begin
perform pg_advisory_xact_lock(hashtextextended(new.runner_id::text,0));
if not public.public_vendor_enabled(new.destination_vendor_id) then raise exception 'Destination unavailable';end if;
update public.runner_trips set expires_at=now() where runner_id=new.runner_id and expires_at>now() and id<>new.id;
return new;
end; $$;
revoke execute on function public.replace_trip_intention() from public,anon,authenticated;
create trigger replace_trip_intention before insert on public.runner_trips for each row execute function public.replace_trip_intention();
-- Seed/demo provenance is explicit for runner profiles too.
alter table public.runners add column demo boolean not null default false;
create function public.phase2_payment_ready() returns boolean language sql stable set search_path='' as $$ select true; $$;
revoke execute on function public.phase2_payment_ready() from public,anon,authenticated;
grant execute on function public.phase2_payment_ready() to service_role;
notify pgrst,'reload schema';
commit;
