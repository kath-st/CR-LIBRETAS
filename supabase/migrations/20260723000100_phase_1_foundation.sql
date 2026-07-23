-- CR Libretas — Fase 1
-- Perfiles, configuración institucional, grupos y aislamiento inicial por RLS.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public;

create type public.app_role as enum ('admin', 'docente');
create type public.profile_status as enum ('pendiente', 'activo', 'inactivo');
create type public.education_level as enum ('inicial', 'primaria', 'secundaria');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  dni text not null unique check (dni ~ '^[0-9]{8}$'),
  nombres text not null check (char_length(btrim(nombres)) between 2 and 80),
  apellidos text not null check (char_length(btrim(apellidos)) between 2 and 100),
  role public.app_role not null default 'docente',
  status public.profile_status not null default 'pendiente',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institution_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  address text not null,
  motto text not null,
  official_year_name text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create table public.academic_groups (
  id uuid primary key default gen_random_uuid(),
  academic_year smallint not null check (academic_year between 2020 and 2100),
  level public.education_level not null,
  grade smallint not null,
  section text not null default 'Única'
    check (char_length(btrim(section)) between 1 and 30),
  display_name text not null check (char_length(btrim(display_name)) between 3 and 120),
  teacher_id uuid not null references public.profiles (id),
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_groups_level_grade_check check (
    (level = 'inicial' and grade between 3 and 5)
    or (level = 'primaria' and grade between 1 and 6)
    or (level = 'secundaria' and grade between 1 and 5)
  ),
  constraint academic_groups_unique unique (academic_year, level, grade, section)
);

create index academic_groups_teacher_id_idx
  on public.academic_groups (teacher_id);

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function app_private.set_updated_at();

create trigger institution_settings_set_updated_at
before update on public.institution_settings
for each row execute function app_private.set_updated_at();

create trigger academic_groups_set_updated_at
before update on public.academic_groups
for each row execute function app_private.set_updated_at();

create or replace function app_private.is_active_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
      and status = 'activo'
  );
$$;

create or replace function app_private.is_active_teacher_for_group(
  target_group_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academic_groups groups
    join public.profiles profiles on profiles.id = groups.teacher_id
    where groups.id = target_group_id
      and groups.teacher_id = user_id
      and groups.active
      and profiles.status = 'activo'
  );
$$;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_dni text;
begin
  user_dni := coalesce(
    new.raw_user_meta_data ->> 'dni',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  if user_dni !~ '^[0-9]{8}$' then
    raise exception 'El usuario debe incluir un DNI de 8 dígitos.';
  end if;

  insert into public.profiles (id, dni, nombres, apellidos)
  values (
    new.id,
    user_dni,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombres'), ''), 'Pendiente'),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'apellidos'), ''), 'Pendiente')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.institution_settings enable row level security;
alter table public.academic_groups enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or app_private.is_active_admin());

create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (app_private.is_active_admin())
with check (app_private.is_active_admin());

create policy "institution_authenticated_read"
on public.institution_settings
for select
to authenticated
using (true);

create policy "institution_admin_insert"
on public.institution_settings
for insert
to authenticated
with check (app_private.is_active_admin());

create policy "institution_admin_update"
on public.institution_settings
for update
to authenticated
using (app_private.is_active_admin())
with check (app_private.is_active_admin());

create policy "groups_select_assigned_or_admin"
on public.academic_groups
for select
to authenticated
using (
  app_private.is_active_admin()
  or (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid() and status = 'activo'
    )
  )
);

create policy "groups_admin_insert"
on public.academic_groups
for insert
to authenticated
with check (app_private.is_active_admin());

create policy "groups_admin_update"
on public.academic_groups
for update
to authenticated
using (app_private.is_active_admin())
with check (app_private.is_active_admin());

create policy "groups_admin_delete"
on public.academic_groups
for delete
to authenticated
using (app_private.is_active_admin());

revoke all on public.profiles from anon;
revoke all on public.institution_settings from anon;
revoke all on public.academic_groups from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.institution_settings to authenticated;
grant select, insert, update, delete on public.academic_groups to authenticated;

grant usage on schema app_private to authenticated;
grant execute on function app_private.is_active_admin(uuid) to authenticated;
grant execute on function app_private.is_active_teacher_for_group(uuid, uuid)
  to authenticated;

revoke all on function app_private.handle_new_auth_user() from public;
revoke all on function app_private.set_updated_at() from public;

comment on table public.profiles is
  'Perfil y estado de autorización asociado a Supabase Auth.';
comment on table public.academic_groups is
  'Unidad principal de aislamiento académico.';
comment on function app_private.is_active_teacher_for_group(uuid, uuid) is
  'Regla reutilizable para las futuras tablas dependientes de grupo.';
