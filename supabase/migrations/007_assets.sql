begin;
alter table public.vendors add column logo_url text,add column cover_url text;
alter table public.runners add column avatar_url text;
alter table public.listings add constraint listing_photo_count check(cardinality(photos)<=8);
grant update(logo_url,cover_url) on public.vendors to authenticated;
grant update(avatar_url) on public.runners to authenticated;
grant update(photos) on public.listings to authenticated;
create function public.asset_write_allowed(asset_name text) returns boolean language plpgsql stable security definer set search_path='' as $$ declare parts text[];begin parts=string_to_array(asset_name,'/');if cardinality(parts)<>3 or parts[2]!~'^[0-9a-f-]{36}$' or parts[3]!~'^[0-9a-f-]{36}\.webp$' then return false;end if;if parts[1]='vendor' then return public.owns_vendor(parts[2]::uuid);elsif parts[1]='runner' then return public.has_role('runner') and parts[2]::uuid=auth.uid();end if;return false;end; $$;
revoke execute on function public.asset_write_allowed(text) from public,anon,authenticated;
grant execute on function public.asset_write_allowed(text) to authenticated;
-- A reduced local Auth/PostgreSQL stack may omit Storage; it never pretends uploads succeeded.
do $$ begin if to_regclass('storage.buckets') is not null then
if exists(select 1 from storage.buckets where id='marketplace-assets') then raise exception 'Existing marketplace-assets bucket requires operator review before reuse';end if;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('marketplace-assets','marketplace-assets',true,5242880,array['image/webp']) on conflict(id) do nothing;
execute 'create policy marketplace_asset_read on storage.objects for select to anon,authenticated using(bucket_id=''marketplace-assets'')';
execute 'create policy marketplace_asset_server_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>''marketplace-assets'')';
execute 'create policy marketplace_asset_server_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>''marketplace-assets'') with check(bucket_id<>''marketplace-assets'')';
execute 'create policy marketplace_asset_server_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>''marketplace-assets'')';
end if;end $$;
commit;
