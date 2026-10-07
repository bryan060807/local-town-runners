begin;
create table public.reviews(id uuid primary key default gen_random_uuid(),order_id uuid unique not null references public.orders,customer_id uuid not null references public.profiles,rating integer not null check(rating between 1 and 5),comment text not null check(length(comment)<=1000),created_at timestamptz not null default now());
alter table public.reviews enable row level security;
create policy review_read on public.reviews for select to authenticated using(customer_id=auth.uid() or public.has_role('admin') or exists(select 1 from public.orders where id=order_id and public.owns_vendor(vendor_id)));
create policy review_insert on public.reviews for insert to authenticated with check(customer_id=auth.uid() and public.account_active() and exists(select 1 from public.orders where id=order_id and customer_id=auth.uid() and state='COMPLETED'));
revoke all on public.reviews from anon,authenticated;
grant select,insert on public.reviews to authenticated;
create trigger review_audit after insert on public.reviews for each row execute function public.audit_change();
commit;
