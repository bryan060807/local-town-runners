begin;
create function public.blocked_run_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.runner_id is not null and new.runner_id is distinct from old.runner_id and exists(select 1 from public.blocks where (user_id=new.customer_id and blocked_user_id=new.runner_id) or (user_id=new.runner_id and blocked_user_id=new.customer_id)) then raise exception 'Runner blocked';end if;return new;end; $$;
create trigger blocked_run_guard before update of runner_id on public.orders for each row execute function public.blocked_run_guard();
create function public.blocked_vendors() returns table(vendor_id uuid) language sql stable security definer set search_path='' as $$ select v.id from public.vendors v join public.blocks b on (b.user_id=auth.uid() and b.blocked_user_id=v.owner_id) or (b.blocked_user_id=auth.uid() and b.user_id=v.owner_id) where public.account_active(); $$;
revoke execute on function public.blocked_run_guard(),public.blocked_vendors() from public,anon,authenticated;
grant execute on function public.blocked_vendors() to authenticated;
commit;
