begin;
-- Durable one-attempt boundary: uncertain outcomes never authorize another capture.
create table public.payment_recovery (
  order_id uuid primary key references public.orders(id),
  capture_attempted_at timestamptz,
  phase text not null default 'review' check (phase in ('awaiting_approval','approved','capture_pending','captured','confirmed','confirmation_pending','failed','review')),
  observed_capture_id text check (length(observed_capture_id) between 1 and 100),
  provider_status text,
  pending_reason text,
  updated_at timestamptz not null default now()
);
-- Earlier capture attempts were not recorded durably. Existing bound pending orders
-- may only be checked/reconciled; do not guess that a financial retry is safe.
insert into public.payment_recovery(order_id,capture_attempted_at,phase)
select id,now(),'review' from public.orders where state='PENDING_PAYMENT' and paypal_order_id is not null;
alter table public.payment_recovery enable row level security;
create policy payment_recovery_read on public.payment_recovery for select to authenticated using(public.order_access(order_id));
revoke all on public.payment_recovery from anon,authenticated;
grant select on public.payment_recovery to authenticated;
grant all on public.payment_recovery to service_role;
create function public.claim_payment_capture(order_id uuid,paypal_id text) returns boolean language plpgsql security definer set search_path='' as $$
declare o public.orders; attempted timestamptz;
begin
select * into o from public.orders where id=order_id for update;
if not found or o.state<>'PENDING_PAYMENT' or o.paypal_order_id is distinct from paypal_id or paypal_id is null then raise exception 'Order not payable'; end if;
insert into public.payment_recovery(order_id) values(o.id) on conflict do nothing;
select capture_attempted_at into attempted from public.payment_recovery where payment_recovery.order_id=o.id for update;
if attempted is not null then return false; end if;
update public.payment_recovery set capture_attempted_at=now(),updated_at=now() where payment_recovery.order_id=o.id;
return true;
end; $$;
revoke execute on function public.claim_payment_capture(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_payment_capture(uuid,text) to service_role;
-- Keep the established row-locked reconciliation mechanism; reject conflicting audit identifiers.
create or replace function public.confirm_payment(order_id uuid,capture_id text,event_id text,amount_cents bigint) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; prior public.payment_events; v bigint; r bigint;
begin
if capture_id is null or length(capture_id) not between 1 and 100 or event_id is null or length(event_id) not between 1 and 200 then raise exception 'Invalid payment identifier'; end if;
select * into o from public.orders where id=order_id for update;
if not found or o.total_cents<>amount_cents or amount_cents is null or o.paypal_order_id is null then raise exception 'Payment mismatch'; end if;
if o.paypal_capture_id is not null and o.paypal_capture_id<>capture_id then raise exception 'Conflicting capture'; end if;
if o.paypal_capture_id is null and o.state<>'PENDING_PAYMENT' then raise exception 'Not payable'; end if;
insert into public.payment_events values(event_id,o.id,capture_id,now()) on conflict do nothing;
select * into prior from public.payment_events where payment_events.event_id=confirm_payment.event_id;
if prior.order_id is distinct from o.id or prior.capture_id is distinct from confirm_payment.capture_id then raise exception 'Conflicting payment event'; end if;
if o.paypal_capture_id=capture_id then return; end if;
update public.orders set state='PAID',paypal_capture_id=capture_id where id=o.id;
v=o.total_cents*80/100; r=o.total_cents*15/100;
insert into public.ledger(order_id,kind,amount_cents,simulated) values(o.id,'CUSTOMER_PAYMENT',o.total_cents,false),(o.id,'VENDOR_ALLOCATION',v,true),(o.id,'RUNNER_ALLOCATION',r,true),(o.id,'PLATFORM_ALLOCATION',o.total_cents-v-r,true);
insert into public.order_events(order_id,event) values(o.id,'PAYMENT_CONFIRMED');
end; $$;
revoke execute on function public.confirm_payment(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.confirm_payment(uuid,text,text,bigint) to service_role;
create function public.phase42_ready() returns boolean language sql stable set search_path='' as $$select true;$$;
revoke execute on function public.phase42_ready() from public,anon,authenticated;
grant execute on function public.phase42_ready() to service_role;
notify pgrst,'reload schema';
commit;
