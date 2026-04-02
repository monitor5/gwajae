create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (email = lower(email))
);

drop trigger if exists allowed_users_set_updated_at on public.allowed_users;
create trigger allowed_users_set_updated_at
before update on public.allowed_users
for each row
execute function public.set_updated_at();

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_users
    where email = public.current_auth_email()
      and role = 'admin'
      and active = true
  )
$$;

alter table public.allowed_users enable row level security;

drop policy if exists "allowed_users_select_self_or_admin" on public.allowed_users;
create policy "allowed_users_select_self_or_admin"
on public.allowed_users
for select
to authenticated
using (
  public.is_admin_user()
  or email = public.current_auth_email()
);

drop policy if exists "allowed_users_insert_admin" on public.allowed_users;
create policy "allowed_users_insert_admin"
on public.allowed_users
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "allowed_users_update_admin" on public.allowed_users;
create policy "allowed_users_update_admin"
on public.allowed_users
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.allowed_users (email, role, active)
values ('yoonggee95@gmail.com', 'admin', true)
on conflict (email) do update
set role = excluded.role,
    active = excluded.active;

insert into public.allowed_users (email, role, active)
values ('yoonggee@dgu.ac.kr', 'admin', true)
on conflict (email) do update
set role = excluded.role,
    active = excluded.active;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists subjects_owner_name_lower_idx
on public.subjects (owner_user_id, lower(name));

create unique index if not exists subjects_owner_default_idx
on public.subjects (owner_user_id)
where is_default = true;

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_updated_at();

alter table public.subjects enable row level security;

drop policy if exists "subjects_select_owner" on public.subjects;
create policy "subjects_select_owner"
on public.subjects
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "subjects_insert_owner" on public.subjects;
create policy "subjects_insert_owner"
on public.subjects
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "subjects_update_owner" on public.subjects;
create policy "subjects_update_owner"
on public.subjects
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "subjects_delete_owner" on public.subjects;
create policy "subjects_delete_owner"
on public.subjects
for delete
to authenticated
using (owner_user_id = auth.uid() and is_default = false);

create or replace function public.ensure_default_subject(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  default_subject_id uuid;
begin
  select id
  into default_subject_id
  from public.subjects
  where owner_user_id = target_user_id
    and is_default = true
  limit 1;

  if default_subject_id is null then
    insert into public.subjects (owner_user_id, name, color, is_default)
    values (target_user_id, '미지정', '#d7dee7', true)
    returning id into default_subject_id;
  end if;

  return default_subject_id;
end;
$$;

create or replace function public.create_default_subject_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_default_subject(new.id);
  return new;
end;
$$;

drop trigger if exists create_default_subject_after_signup on auth.users;
create trigger create_default_subject_after_signup
after insert on auth.users
for each row
execute function public.create_default_subject_for_new_user();

insert into public.subjects (owner_user_id, name, color, is_default)
select u.id, '미지정', '#d7dee7', true
from auth.users u
where not exists (
  select 1
  from public.subjects s
  where s.owner_user_id = u.id
    and s.is_default = true
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null,
  due_date timestamptz not null,
  submitted boolean not null default false,
  is_favorite boolean not null default false,
  description text,
  external_link text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
declare
  due_date_type text;
begin
  select data_type
    into due_date_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'assignments'
    and column_name = 'due_date';

  if due_date_type = 'date' then
    execute '
      alter table public.assignments
      alter column due_date type timestamptz
      using due_date::timestamp with time zone
    ';
  elsif due_date_type = 'timestamp without time zone' then
    execute '
      alter table public.assignments
      alter column due_date type timestamptz
      using due_date at time zone ''Asia/Seoul''
    ';
  end if;
end
$$;

create index if not exists assignments_owner_due_date_idx
on public.assignments (owner_user_id, due_date, created_at desc);

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
before update on public.assignments
for each row
execute function public.set_updated_at();

alter table public.assignments enable row level security;

drop policy if exists "assignments_select_owner" on public.assignments;
create policy "assignments_select_owner"
on public.assignments
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "assignments_insert_owner" on public.assignments;
create policy "assignments_insert_owner"
on public.assignments
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "assignments_update_owner" on public.assignments;
create policy "assignments_update_owner"
on public.assignments
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "assignments_delete_owner" on public.assignments;
create policy "assignments_delete_owner"
on public.assignments
for delete
to authenticated
using (owner_user_id = auth.uid());

create table if not exists public.assignment_assets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  asset_type text not null default 'file' check (asset_type in ('file', 'image')),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  is_thumbnail boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.assignment_assets
add column if not exists assignment_id uuid references public.assignments(id) on delete cascade;

alter table public.assignment_assets
add column if not exists is_thumbnail boolean not null default false;

create index if not exists assignment_assets_assignment_idx
on public.assignment_assets (assignment_id);

alter table public.assignment_assets enable row level security;

drop policy if exists "assignment_assets_select_owner" on public.assignment_assets;
create policy "assignment_assets_select_owner"
on public.assignment_assets
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "assignment_assets_insert_owner" on public.assignment_assets;
create policy "assignment_assets_insert_owner"
on public.assignment_assets
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "assignment_assets_update_owner" on public.assignment_assets;
create policy "assignment_assets_update_owner"
on public.assignment_assets
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "assignment_assets_delete_owner" on public.assignment_assets;
create policy "assignment_assets_delete_owner"
on public.assignment_assets
for delete
to authenticated
using (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('assignment-assets', 'assignment-assets', false)
on conflict (id) do nothing;

drop policy if exists "assignment_assets_storage_select_own" on storage.objects;
create policy "assignment_assets_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assignment-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "assignment_assets_storage_insert_own" on storage.objects;
create policy "assignment_assets_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assignment-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "assignment_assets_storage_update_own" on storage.objects;
create policy "assignment_assets_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'assignment-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'assignment-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "assignment_assets_storage_delete_own" on storage.objects;
create policy "assignment_assets_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assignment-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.get_storage_usage_summary()
returns table (
  personal_bytes bigint,
  total_bytes bigint,
  personal_limit_bytes bigint,
  total_limit_bytes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select sum(size_bytes)::bigint
        from public.assignment_assets
        where owner_user_id = auth.uid()
      ),
      0::bigint
    ) as personal_bytes,
    case
      when public.is_admin_user()
        then coalesce((select sum(size_bytes)::bigint from public.assignment_assets), 0::bigint)
      else 0::bigint
    end as total_bytes,
    104857600::bigint as personal_limit_bytes,
    1073741824::bigint as total_limit_bytes
$$;

grant execute on function public.get_storage_usage_summary() to authenticated;
