begin;
create function public.bound_runner_availability() returns trigger language plpgsql set search_path='' as $$ begin if new.available_until is not null and new.available_until>now()+interval '12 hours' then raise exception 'Availability cannot exceed 12 hours';end if;return new;end; $$;
create trigger bound_runner_availability before insert or update of available_until on public.runners for each row execute function public.bound_runner_availability();
create function public.public_vendor_enabled(v uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.vendors where id=v and active and public.profile_enabled(owner_id)); $$;
-- Direct REST/RPC callers cannot prepare orders with blocked or suspended participants.
create function public.reject_blocked_order() returns trigger language plpgsql security definer set search_path='' as $$ declare owner uuid;begin select owner_id into owner from public.vendors where id=new.vendor_id;if not public.public_vendor_enabled(new.vendor_id) or exists(select 1 from public.blocks where (user_id=new.customer_id and blocked_user_id=owner) or (user_id=owner and blocked_user_id=new.customer_id)) then raise exception 'Vendor unavailable';end if;return new;end; $$;
create trigger reject_blocked_order before insert on public.orders for each row execute function public.reject_blocked_order();
revoke execute on function public.bound_runner_availability(),public.public_vendor_enabled(uuid),public.reject_blocked_order() from public,anon,authenticated;
grant execute on function public.public_vendor_enabled(uuid) to anon,authenticated;
commit;
