create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_agencies_updated_at on public.agencies;
create trigger set_agencies_updated_at before update on public.agencies for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_agency_users_updated_at on public.agency_users;
create trigger set_agency_users_updated_at before update on public.agency_users for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_passengers_updated_at on public.passengers;
create trigger set_passengers_updated_at before update on public.passengers for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_passenger_companions_updated_at on public.passenger_companions;
create trigger set_passenger_companions_updated_at before update on public.passenger_companions for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at before update on public.trips for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_trip_passengers_updated_at on public.trip_passengers;
create trigger set_trip_passengers_updated_at before update on public.trip_passengers for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_flights_updated_at on public.flights;
create trigger set_flights_updated_at before update on public.flights for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_hotels_updated_at on public.hotels;
create trigger set_hotels_updated_at before update on public.hotels for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_transports_updated_at on public.transports;
create trigger set_transports_updated_at before update on public.transports for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_tours_updated_at on public.tours;
create trigger set_tours_updated_at before update on public.tours for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_trains_updated_at on public.trains;
create trigger set_trains_updated_at before update on public.trains for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_insurances_updated_at on public.insurances;
create trigger set_insurances_updated_at before update on public.insurances for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.set_current_timestamp_updated_at();
drop trigger if exists set_internal_notes_updated_at on public.internal_notes;
create trigger set_internal_notes_updated_at before update on public.internal_notes for each row execute function public.set_current_timestamp_updated_at();

create or replace function public.is_agency_member(target_agency_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_users au
    where au.agency_id = target_agency_id
      and au.auth_user_id = auth.uid()
      and au.status = 'ACTIVE'
      and au.deleted_at is null
  );
$$;

create or replace function public.is_agency_manager(target_agency_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_users au
    where au.agency_id = target_agency_id
      and au.auth_user_id = auth.uid()
      and au.status = 'ACTIVE'
      and au.deleted_at is null
      and au.role in ('OWNER', 'ADMIN')
  );
$$;

create or replace function public.is_passenger_self(target_passenger_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.passengers p
    where p.id = target_passenger_id
      and p.auth_user_id = auth.uid()
      and p.deleted_at is null
  );
$$;

create or replace function public.can_access_trip(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = target_trip_id
      and public.is_agency_member(t.agency_id)
  )
  or exists (
    select 1
    from public.trip_passengers tp
    join public.passengers p on p.id = tp.passenger_id
    where tp.trip_id = target_trip_id
      and p.auth_user_id = auth.uid()
      and p.deleted_at is null
  )
  or exists (
    select 1
    from public.trip_passengers tp
    join public.passenger_companions pc on pc.id = tp.companion_id
    join public.passengers p on p.id = pc.passenger_id
    where tp.trip_id = target_trip_id
      and p.auth_user_id = auth.uid()
      and p.deleted_at is null
  );
$$;

create or replace function public.can_access_conversation(target_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and public.is_agency_member(c.agency_id)
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and c.passenger_id is not null
      and public.is_passenger_self(c.passenger_id)
  )
  or exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and c.trip_id is not null
      and public.can_access_trip(c.trip_id)
  );
$$;

create or replace function public.can_access_storage_object(object_bucket text, object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    where d.storage_bucket = object_bucket
      and d.storage_path = object_name
      and (
        public.is_agency_member(d.agency_id)
        or public.can_access_trip(d.trip_id)
      )
      and d.deleted_at is null
  );
$$;

alter table public.agencies enable row level security;
alter table public.agency_users enable row level security;
alter table public.passengers enable row level security;
alter table public.passenger_companions enable row level security;
alter table public.trips enable row level security;
alter table public.trip_passengers enable row level security;
alter table public.documents enable row level security;
alter table public.flights enable row level security;
alter table public.flight_status_history enable row level security;
alter table public.hotels enable row level security;
alter table public.transports enable row level security;
alter table public.tours enable row level security;
alter table public.trains enable row level security;
alter table public.insurances enable row level security;
alter table public.internal_notes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "agency members can read agencies" on public.agencies;
create policy "agency members can read agencies" on public.agencies
for select to authenticated
using (public.is_agency_member(id));

drop policy if exists "agency managers can update agencies" on public.agencies;
create policy "agency managers can update agencies" on public.agencies
for update to authenticated
using (public.is_agency_manager(id))
with check (public.is_agency_manager(id));

drop policy if exists "agency members can read users" on public.agency_users;
create policy "agency members can read users" on public.agency_users
for select to authenticated
using (public.is_agency_member(agency_id));

drop policy if exists "agency managers can manage users" on public.agency_users;
create policy "agency managers can manage users" on public.agency_users
for all to authenticated
using (public.is_agency_manager(agency_id))
with check (public.is_agency_manager(agency_id));

drop policy if exists "admins or passenger can read passengers" on public.passengers;
create policy "admins or passenger can read passengers" on public.passengers
for select to authenticated
using (public.is_agency_member(agency_id) or public.is_passenger_self(id));

drop policy if exists "agency members can manage passengers" on public.passengers;
create policy "agency members can manage passengers" on public.passengers
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "admins or passenger can read companions" on public.passenger_companions;
create policy "admins or passenger can read companions" on public.passenger_companions
for select to authenticated
using (
  public.is_agency_member(agency_id)
  or exists (
    select 1
    from public.passengers p
    where p.id = passenger_id
      and p.auth_user_id = auth.uid()
      and p.deleted_at is null
  )
);

drop policy if exists "agency members can manage companions" on public.passenger_companions;
create policy "agency members can manage companions" on public.passenger_companions
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "admins or passenger can read trips" on public.trips;
create policy "admins or passenger can read trips" on public.trips
for select to authenticated
using (public.is_agency_member(agency_id) or public.can_access_trip(id));

drop policy if exists "agency members can manage trips" on public.trips;
create policy "agency members can manage trips" on public.trips
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "admins or passenger can read trip passengers" on public.trip_passengers;
create policy "admins or passenger can read trip passengers" on public.trip_passengers
for select to authenticated
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
  or public.can_access_trip(trip_id)
);

drop policy if exists "agency members can manage trip passengers" on public.trip_passengers;
create policy "agency members can manage trip passengers" on public.trip_passengers
for all to authenticated
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
);

drop policy if exists "admins or passenger can read documents" on public.documents;
create policy "admins or passenger can read documents" on public.documents
for select to authenticated
using (
  public.is_agency_member(agency_id)
  or public.can_access_trip(trip_id)
);

drop policy if exists "agency members can manage documents" on public.documents;
create policy "agency members can manage documents" on public.documents
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "admins or passenger can read flights" on public.flights;
create policy "admins or passenger can read flights" on public.flights
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage flights" on public.flights;
create policy "agency members can manage flights" on public.flights
for all to authenticated
using (
  exists (
    select 1 from public.trips t
    where t.id = trip_id and public.is_agency_member(t.agency_id)
  )
)
with check (
  exists (
    select 1 from public.trips t
    where t.id = trip_id and public.is_agency_member(t.agency_id)
  )
);

drop policy if exists "admins or passenger can read flight history" on public.flight_status_history;
create policy "admins or passenger can read flight history" on public.flight_status_history
for select to authenticated
using (
  exists (
    select 1
    from public.flights f
    where f.id = flight_id
      and public.can_access_trip(f.trip_id)
  )
);

drop policy if exists "agency members can manage flight history" on public.flight_status_history;
create policy "agency members can manage flight history" on public.flight_status_history
for all to authenticated
using (
  exists (
    select 1
    from public.flights f
    join public.trips t on t.id = f.trip_id
    where f.id = flight_id
      and public.is_agency_member(t.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.flights f
    join public.trips t on t.id = f.trip_id
    where f.id = flight_id
      and public.is_agency_member(t.agency_id)
  )
);

drop policy if exists "admins or passenger can read hotels" on public.hotels;
create policy "admins or passenger can read hotels" on public.hotels
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage hotels" on public.hotels;
create policy "agency members can manage hotels" on public.hotels
for all to authenticated
using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
)
with check (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
);

drop policy if exists "admins or passenger can read transports" on public.transports;
create policy "admins or passenger can read transports" on public.transports
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage transports" on public.transports;
create policy "agency members can manage transports" on public.transports
for all to authenticated
using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
)
with check (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
);

drop policy if exists "admins or passenger can read tours" on public.tours;
create policy "admins or passenger can read tours" on public.tours
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage tours" on public.tours;
create policy "agency members can manage tours" on public.tours
for all to authenticated
using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
)
with check (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
);

drop policy if exists "admins or passenger can read trains" on public.trains;
create policy "admins or passenger can read trains" on public.trains
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage trains" on public.trains;
create policy "agency members can manage trains" on public.trains
for all to authenticated
using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
)
with check (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
);

drop policy if exists "admins or passenger can read insurances" on public.insurances;
create policy "admins or passenger can read insurances" on public.insurances
for select to authenticated
using (public.can_access_trip(trip_id));

drop policy if exists "agency members can manage insurances" on public.insurances;
create policy "agency members can manage insurances" on public.insurances
for all to authenticated
using (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
)
with check (
  exists (select 1 from public.trips t where t.id = trip_id and public.is_agency_member(t.agency_id))
);

drop policy if exists "agency members can read internal notes" on public.internal_notes;
create policy "agency members can read internal notes" on public.internal_notes
for select to authenticated
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
);

drop policy if exists "agency members can manage internal notes" on public.internal_notes;
create policy "agency members can manage internal notes" on public.internal_notes
for all to authenticated
using (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and public.is_agency_member(t.agency_id)
  )
);

drop policy if exists "admins or passenger can read conversations" on public.conversations;
create policy "admins or passenger can read conversations" on public.conversations
for select to authenticated
using (
  public.is_agency_member(agency_id)
  or (passenger_id is not null and public.is_passenger_self(passenger_id))
  or (trip_id is not null and public.can_access_trip(trip_id))
);

drop policy if exists "admins can manage conversations" on public.conversations;
create policy "admins can manage conversations" on public.conversations
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "conversation participants can read messages" on public.messages;
create policy "conversation participants can read messages" on public.messages
for select to authenticated
using (public.can_access_conversation(conversation_id));

drop policy if exists "conversation participants can insert messages" on public.messages;
create policy "conversation participants can insert messages" on public.messages
for insert to authenticated
with check (public.can_access_conversation(conversation_id));

drop policy if exists "agency members can manage messages" on public.messages;
create policy "agency members can manage messages" on public.messages
for update to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and public.is_agency_member(c.agency_id)
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and public.is_agency_member(c.agency_id)
  )
);

drop policy if exists "admins or passenger can read alerts" on public.alerts;
create policy "admins or passenger can read alerts" on public.alerts
for select to authenticated
using (
  public.is_agency_member(agency_id)
  or (trip_id is not null and public.can_access_trip(trip_id))
);

drop policy if exists "agency members can manage alerts" on public.alerts;
create policy "agency members can manage alerts" on public.alerts
for all to authenticated
using (public.is_agency_member(agency_id))
with check (public.is_agency_member(agency_id));

drop policy if exists "agency members can read audit logs" on public.audit_logs;
create policy "agency members can read audit logs" on public.audit_logs
for select to authenticated
using (public.is_agency_member(agency_id));

drop policy if exists "agency members can insert audit logs" on public.audit_logs;
create policy "agency members can insert audit logs" on public.audit_logs
for insert to authenticated
with check (public.is_agency_member(agency_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'passenger-documents',
  'passenger-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins manage passenger documents bucket" on storage.objects;
create policy "admins manage passenger documents bucket" on storage.objects
for all to authenticated
using (
  bucket_id = 'passenger-documents'
  and split_part(name, '/', 1) = 'agencies'
  and public.is_agency_member(split_part(name, '/', 2))
)
with check (
  bucket_id = 'passenger-documents'
  and split_part(name, '/', 1) = 'agencies'
  and public.is_agency_member(split_part(name, '/', 2))
);

drop policy if exists "passengers read their document objects" on storage.objects;
create policy "passengers read their document objects" on storage.objects
for select to authenticated
using (
  bucket_id = 'passenger-documents'
  and public.can_access_storage_object(bucket_id, name)
);
