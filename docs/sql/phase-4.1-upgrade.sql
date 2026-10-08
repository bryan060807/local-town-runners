begin;
alter table public.notification_deliveries
 add column auto_dispatch boolean not null default false,
 add column last_attempt_at timestamptz,
 add column first_provider_attempt_at timestamptz,
 add column email_payload jsonb,
 add column provider_event text,
 add column provider_event_at timestamptz,
 add column accepted_at timestamptz,
 add column job_status text generated always as(case status when 'queued' then 'pending' when 'sending' then 'processing' when 'accepted' then 'sent' when 'failed' then case when attempts<5 then 'retrying' else 'failed' end else 'failed' end) stored;
update public.notification_deliveries set first_provider_attempt_at=created_at where attempts>0 and (error_code in ('DELIVERY_UNCONFIRMED','INVALID_PROVIDER_RECEIPT','PROVIDER_RECONCILIATION_REQUIRED') or status='sending');
-- Existing jobs require an administrator's explicit retry; never bulk resend history.
alter table public.notification_deliveries alter column auto_dispatch set default true;
create function public.claim_notification_v41(delivery_id uuid,manual boolean default false) returns public.notification_deliveries language plpgsql security definer set search_path='' as $$
declare n public.notification_deliveries;
begin
 select * into n from public.notification_deliveries where id=delivery_id for update;
 if not found or n.provider_id is not null or n.status='accepted' or n.lease_until>now() then return null;end if;
 if not manual and (not n.auto_dispatch or n.status='blocked' or n.attempts>=5 or n.available_at>now()) then return null;end if;
 update public.notification_deliveries set status='sending',attempts=attempts+1,last_attempt_at=now(),lease_until=now()+interval '2 minutes' where id=n.id returning * into n;return n;
end;$$;
revoke all on function public.claim_notification_v41(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_notification_v41(uuid,boolean) to service_role;
create table public.agreement_presentations(submission_id uuid not null references public.agreement_submissions,format_version text not null check(format_version='readable-v1'),path text not null,sha256 text not null,created_at timestamptz not null default now(),primary key(submission_id,format_version));
alter table public.agreement_presentations enable row level security;
revoke all on public.agreement_presentations from anon,authenticated;
grant select on public.agreement_presentations to authenticated;
grant select,insert on public.agreement_presentations to service_role;
create policy presentation_read on public.agreement_presentations for select using(public.platform_admin());
create trigger presentation_immutable before update or delete on public.agreement_presentations for each row execute function public.immutable_agreement();
create table public.notification_provider_events(id text primary key,message_id text not null,event_type text not null,event_at timestamptz not null,received_at timestamptz not null default now());
alter table public.notification_provider_events enable row level security;
revoke all on public.notification_provider_events from anon,authenticated;
grant select on public.notification_provider_events to authenticated;
grant all on public.notification_provider_events to service_role;
create policy provider_events_admin on public.notification_provider_events for select using(public.platform_admin());
create function public.record_notification_event(event_id text,message_id text,event_type text,event_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_provider_events(id,message_id,event_type,event_at) values(event_id,message_id,event_type,event_at) on conflict do nothing;
 if not found then return;end if;
 update public.notification_deliveries set provider_event=case event_type when 'email.sent' then 'accepted' when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced' when 'email.failed' then 'rejected' when 'email.complained' then 'complained' else 'delayed' end,provider_event_at=event_at
 where provider_id=message_id and (provider_event_at is null or provider_event_at<=event_at) and not (event_type='email.sent' and provider_event in ('delivered','bounced','rejected','complained'));
end;$$;
revoke all on function public.record_notification_event(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_notification_event(text,text,text,timestamptz) to service_role;
create function public.phase41_ready() returns boolean language sql stable as $$select true$$;
revoke all on function public.phase41_ready() from public,anon,authenticated;
grant execute on function public.phase41_ready() to service_role;
commit;
