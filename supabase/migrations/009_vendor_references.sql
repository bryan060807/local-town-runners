begin;
alter table public.vendors add column website_url text,add column social_urls text[] not null default '{}';
alter table public.vendors add constraint vendor_website_https check(website_url is null or website_url ~ '^https://[^[:space:]]+$');
alter table public.vendors add constraint vendor_social_count check(cardinality(social_urls)<=5);
grant update(website_url,social_urls) on public.vendors to authenticated;
notify pgrst,'reload schema';
commit;
