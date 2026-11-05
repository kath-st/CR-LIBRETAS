-- La malla de cada grupo conserva sus UUID y el catálogo inicial permanece intacto.
alter table public.group_areas
  alter column catalog_area_id drop not null,
  add column name_aliases text[] not null default '{}';

alter table public.group_subjects
  add column name_aliases text[] not null default '{}';

create unique index group_areas_group_name_unique_idx
  on public.group_areas (group_id, lower(btrim(name)));

drop index public.group_subjects_custom_name_unique_idx;
create unique index group_subjects_area_name_unique_idx
  on public.group_subjects (group_area_id, lower(btrim(name)));

create or replace function app_private.track_group_area_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    -- La restauración se ejecuta como propietaria de la función (postgres).
    new.name_aliases := case when current_user = 'postgres'
      then coalesce(new.name_aliases, '{}') else '{}' end;
  else
    new.name_aliases := old.name_aliases;
    if old.name is distinct from new.name
       and not (old.name = any(new.name_aliases)) then
      new.name_aliases := array_append(new.name_aliases, old.name);
    end if;
  end if;
  return new;
end;
$$;

create or replace function app_private.track_group_subject_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    new.name_aliases := case when current_user = 'postgres'
      then coalesce(new.name_aliases, '{}') else '{}' end;
  else
    new.name_aliases := old.name_aliases;
    if old.name is distinct from new.name
       and not (old.name = any(new.name_aliases)) then
      new.name_aliases := array_append(new.name_aliases, old.name);
    end if;
  end if;
  return new;
end;
$$;

create trigger group_areas_track_name
before insert or update on public.group_areas
for each row execute function app_private.track_group_area_name();

create trigger group_subjects_track_name
before insert or update on public.group_subjects
for each row execute function app_private.track_group_subject_name();

-- Solo estas funciones pueden borrar filas; no se concede DELETE directo.
create or replace function public.delete_group_subject(
  target_group_id uuid,
  target_subject_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_subject public.group_subjects%rowtype;
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este grupo.';
  end if;

  select * into target_subject
  from public.group_subjects
  where id = target_subject_id and group_id = target_group_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'La asignatura no pertenece al grupo.';
  end if;

  if exists (
    select 1 from public.grades
    where group_id = target_group_id and group_subject_id = target_subject_id
  ) or exists (
    select 1
    from public.report_card_generations generation
    cross join lateral jsonb_array_elements(coalesce(generation.snapshot->'cards', '[]'::jsonb)) card
    cross join lateral jsonb_array_elements(coalesce(card->'areas', '[]'::jsonb)) area
    cross join lateral jsonb_array_elements(coalesce(area->'subjects', '[]'::jsonb)) subject
    where generation.group_id = target_group_id
      and subject->>'id' = target_subject_id::text
  ) then
    raise exception using errcode = '23503',
      message = 'La asignatura tiene notas o boletas históricas. Desactívala para conservarlas.';
  end if;

  delete from public.group_subjects
  where id = target_subject_id and group_id = target_group_id;
end;
$$;

create or replace function public.delete_group_area(
  target_group_id uuid,
  target_area_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_area public.group_areas%rowtype;
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception using errcode = '42501', message = 'No tienes acceso a este grupo.';
  end if;

  select * into target_area
  from public.group_areas
  where id = target_area_id and group_id = target_group_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'El área no pertenece al grupo.';
  end if;

  if exists (
    select 1 from public.grades grade
    join public.group_subjects subject
      on subject.id = grade.group_subject_id and subject.group_id = grade.group_id
    where subject.group_area_id = target_area_id and grade.group_id = target_group_id
  ) or exists (
    select 1
    from public.report_card_generations generation
    cross join lateral jsonb_array_elements(coalesce(generation.snapshot->'cards', '[]'::jsonb)) card
    cross join lateral jsonb_array_elements(coalesce(card->'areas', '[]'::jsonb)) area
    where generation.group_id = target_group_id
      and area->>'id' = target_area_id::text
  ) then
    raise exception using errcode = '23503',
      message = 'El área o sus asignaturas tienen notas o boletas históricas. Desactívala para conservarlas.';
  end if;

  delete from public.group_subjects
  where group_id = target_group_id and group_area_id = target_area_id;
  delete from public.group_areas
  where id = target_area_id and group_id = target_group_id;
end;
$$;

revoke all on function public.delete_group_subject(uuid, uuid) from public;
revoke all on function public.delete_group_area(uuid, uuid) from public;
grant execute on function public.delete_group_subject(uuid, uuid) to authenticated;
grant execute on function public.delete_group_area(uuid, uuid) to authenticated;
revoke all on function app_private.track_group_area_name() from public;
revoke all on function app_private.track_group_subject_name() from public;
