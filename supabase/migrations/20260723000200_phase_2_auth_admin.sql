-- CR Libretas — Fase 2
-- Ciclo de aprobación, recuperación de contraseña y asignación segura de grupos.

alter table public.profiles
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles (id),
  add column deactivated_at timestamptz;

create index profiles_status_idx on public.profiles (status);
create index profiles_role_status_idx on public.profiles (role, status);
create index academic_groups_active_idx on public.academic_groups (active);

create or replace function app_private.set_profile_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'activo' then
      new.approved_at := coalesce(new.approved_at, now());
      new.approved_by := coalesce(new.approved_by, auth.uid());
      new.deactivated_at := null;
    elsif new.status = 'inactivo' then
      new.deactivated_at := now();
    else
      new.approved_at := null;
      new.approved_by := null;
      new.deactivated_at := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_set_lifecycle
before update of status on public.profiles
for each row execute function app_private.set_profile_lifecycle();

create or replace function app_private.validate_group_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.teacher_id
      and role = 'docente'
      and status = 'activo'
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'El grupo debe asignarse a una docente activa.';
  end if;

  return new;
end;
$$;

create trigger academic_groups_validate_teacher
before insert or update of teacher_id on public.academic_groups
for each row execute function app_private.validate_group_teacher();

drop policy "groups_select_assigned_or_admin"
on public.academic_groups;

create policy "groups_select_assigned_or_admin"
on public.academic_groups
for select
to authenticated
using (
  app_private.is_active_admin()
  or (
    active
    and teacher_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid() and status = 'activo'
    )
  )
);

create or replace function app_private.handle_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set must_change_password = false
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_password_changed
after update of encrypted_password on auth.users
for each row
when (old.encrypted_password is distinct from new.encrypted_password)
execute function app_private.handle_auth_password_change();

revoke all on function app_private.set_profile_lifecycle() from public;
revoke all on function app_private.validate_group_teacher() from public;
revoke all on function app_private.handle_auth_password_change() from public;

comment on function app_private.handle_auth_password_change() is
  'Cierra automáticamente el cambio obligatorio después de que Supabase Auth actualiza la contraseña.';
