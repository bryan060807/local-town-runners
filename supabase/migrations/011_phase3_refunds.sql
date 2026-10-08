begin;
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
