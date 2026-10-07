begin;
-- General admin inspection does not justify default access to private home pickup addresses.
drop policy private_vendor_read on public.vendor_private;
create policy private_vendor_read on public.vendor_private for select to authenticated using(public.owns_vendor(vendor_id) or (public.account_active() and public.has_role('runner') and exists(select 1 from public.orders where orders.vendor_id=vendor_private.vendor_id and runner_id=auth.uid() and state in ('RUNNER_ASSIGNED','READY_FOR_PICKUP','PICKED_UP','OUT_FOR_DELIVERY'))));
commit;
