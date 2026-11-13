-- CR Libretas — Fase 3
-- Alumnos, matrículas, malla por grupo, notas y recomendaciones.

create type public.enrollment_status as enum ('activo', 'retirado');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_names text not null
    check (char_length(btrim(first_names)) between 2 and 100),
  last_names text not null
    check (char_length(btrim(last_names)) between 2 and 120),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  student_id uuid not null references public.students (id),
  status public.enrollment_status not null default 'activo',
  withdrawn_from_term smallint
    check (withdrawn_from_term between 1 and 4),
  withdrawal_reason text
    check (withdrawal_reason is null or char_length(btrim(withdrawal_reason)) <= 300),
  withdrawn_at timestamptz,
  withdrawn_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_unique_student_group unique (group_id, student_id),
  constraint enrollments_id_group_unique unique (id, group_id),
  constraint enrollments_withdrawal_consistency check (
    (
      status = 'activo'
      and withdrawn_from_term is null
      and withdrawn_at is null
      and withdrawn_by is null
    )
    or (
      status = 'retirado'
      and withdrawn_from_term is not null
      and withdrawn_at is not null
      and withdrawn_by is not null
    )
  )
);

create table public.academic_area_catalog (
  id uuid primary key,
  code text not null unique,
  name text not null unique,
  position smallint not null check (position > 0),
  is_direct boolean not null default false,
  included_in_final_by_default boolean not null default true
);

create table public.subject_catalog (
  id uuid primary key,
  area_id uuid not null references public.academic_area_catalog (id),
  code text not null unique,
  name text not null,
  position smallint not null check (position > 0),
  constraint subject_catalog_area_name_unique unique (area_id, name)
);

create table public.group_areas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  catalog_area_id uuid not null references public.academic_area_catalog (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  position smallint not null check (position > 0),
  active boolean not null default true,
  included_in_final boolean not null default true,
  is_direct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_areas_group_catalog_unique unique (group_id, catalog_area_id),
  constraint group_areas_id_group_unique unique (id, group_id)
);

create table public.group_subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  group_area_id uuid not null,
  catalog_subject_id uuid references public.subject_catalog (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  position smallint not null check (position > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_subjects_area_group_fk
    foreign key (group_area_id, group_id)
    references public.group_areas (id, group_id),
  constraint group_subjects_id_group_unique unique (id, group_id)
);

create unique index group_subjects_catalog_unique_idx
  on public.group_subjects (group_id, catalog_subject_id)
  where catalog_subject_id is not null;
create unique index group_subjects_custom_name_unique_idx
  on public.group_subjects (group_area_id, lower(name))
  where catalog_subject_id is null;

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  enrollment_id uuid not null,
  group_subject_id uuid not null,
  term smallint not null check (term between 1 and 4),
  score smallint check (score between 0 and 20),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grades_enrollment_group_fk
    foreign key (enrollment_id, group_id)
    references public.enrollments (id, group_id),
  constraint grades_subject_group_fk
    foreign key (group_subject_id, group_id)
    references public.group_subjects (id, group_id),
  constraint grades_unique_cell
    unique (enrollment_id, group_subject_id, term)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  enrollment_id uuid not null,
  term smallint not null check (term between 1 and 4),
  text text not null default ''
    check (char_length(text) <= 300),
  updated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendations_enrollment_group_fk
    foreign key (enrollment_id, group_id)
    references public.enrollments (id, group_id),
  constraint recommendations_unique_term
    unique (enrollment_id, term)
);

create index enrollments_group_status_idx
  on public.enrollments (group_id, status);
create index enrollments_student_idx
  on public.enrollments (student_id);
create index group_areas_group_position_idx
  on public.group_areas (group_id, position);
create index group_subjects_group_area_position_idx
  on public.group_subjects (group_id, group_area_id, position);
create index grades_group_subject_idx
  on public.grades (group_id, group_subject_id);
create index grades_group_enrollment_idx
  on public.grades (group_id, enrollment_id);
create index recommendations_group_term_idx
  on public.recommendations (group_id, term);

create trigger students_set_updated_at
before update on public.students
for each row execute function app_private.set_updated_at();

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function app_private.set_updated_at();

create trigger group_areas_set_updated_at
before update on public.group_areas
for each row execute function app_private.set_updated_at();

create trigger group_subjects_set_updated_at
before update on public.group_subjects
for each row execute function app_private.set_updated_at();

create trigger grades_set_updated_at
before update on public.grades
for each row execute function app_private.set_updated_at();

create trigger recommendations_set_updated_at
before update on public.recommendations
for each row execute function app_private.set_updated_at();

create or replace function app_private.protect_enrollment_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.group_id is distinct from new.group_id
     or old.student_id is distinct from new.student_id then
    raise exception
      using
        errcode = '23514',
        message = 'No se puede cambiar el alumno o grupo de una matrícula.';
  end if;

  if old.status is distinct from new.status then
    if new.status = 'retirado' then
      if new.withdrawn_from_term is null then
        raise exception
          using
            errcode = '23514',
            message = 'El retiro requiere un bimestre.';
      end if;
      new.withdrawn_at := now();
      new.withdrawn_by := auth.uid();
    else
      new.withdrawn_from_term := null;
      new.withdrawal_reason := null;
      new.withdrawn_at := null;
      new.withdrawn_by := null;
    end if;
  elsif old.status = 'retirado' then
    new.withdrawn_at := old.withdrawn_at;
    new.withdrawn_by := old.withdrawn_by;
  end if;

  return new;
end;
$$;

create trigger enrollments_protect_history
before update on public.enrollments
for each row execute function app_private.protect_enrollment_history();

create or replace function app_private.protect_group_area_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.group_id is distinct from new.group_id
     or old.catalog_area_id is distinct from new.catalog_area_id then
    raise exception
      using
        errcode = '23514',
        message = 'No se puede mover un área a otro grupo.';
  end if;
  return new;
end;
$$;

create trigger group_areas_protect_identity
before update on public.group_areas
for each row execute function app_private.protect_group_area_identity();

create or replace function app_private.protect_group_subject_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.group_id is distinct from new.group_id
     or old.group_area_id is distinct from new.group_area_id
     or old.catalog_subject_id is distinct from new.catalog_subject_id then
    raise exception
      using
        errcode = '23514',
        message = 'No se puede mover una asignatura a otra área o grupo.';
  end if;
  return new;
end;
$$;

create trigger group_subjects_protect_identity
before update on public.group_subjects
for each row execute function app_private.protect_group_subject_identity();

create or replace function app_private.protect_grade_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    old.group_id is distinct from new.group_id
    or old.enrollment_id is distinct from new.enrollment_id
    or old.group_subject_id is distinct from new.group_subject_id
    or old.term is distinct from new.term
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'No se puede mover una nota a otra celda o grupo.';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger grades_protect_identity
before insert or update on public.grades
for each row execute function app_private.protect_grade_identity();

create or replace function app_private.protect_recommendation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    old.group_id is distinct from new.group_id
    or old.enrollment_id is distinct from new.enrollment_id
    or old.term is distinct from new.term
  ) then
    raise exception
      using
        errcode = '23514',
        message = 'No se puede mover una recomendación a otro alumno o bimestre.';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger recommendations_protect_identity
before insert or update on public.recommendations
for each row execute function app_private.protect_recommendation_identity();

insert into public.academic_area_catalog (
  id, code, name, position, is_direct, included_in_final_by_default
)
values
  ('10000000-0000-0000-0000-000000000001', 'matematica', 'Matemática', 10, false, true),
  ('10000000-0000-0000-0000-000000000002', 'comunicacion', 'Comunicación Integral', 20, false, true),
  ('10000000-0000-0000-0000-000000000003', 'ciencia_tecnologia', 'Ciencia y Tecnología', 30, false, true),
  ('10000000-0000-0000-0000-000000000004', 'personal_social', 'Personal Social', 40, false, true),
  ('10000000-0000-0000-0000-000000000005', 'educacion_fisica', 'Educación Física', 50, true, true),
  ('10000000-0000-0000-0000-000000000006', 'arte', 'Educación por el Arte', 60, true, true),
  ('10000000-0000-0000-0000-000000000007', 'religion', 'Educación Religiosa', 70, true, true),
  ('10000000-0000-0000-0000-000000000008', 'ingles', 'Inglés', 80, true, true),
  ('10000000-0000-0000-0000-000000000009', 'computacion', 'Computación', 90, true, true),
  ('10000000-0000-0000-0000-000000000010', 'conducta', 'Conducta', 100, true, false);

insert into public.subject_catalog (id, area_id, code, name, position)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aritmetica', 'Aritmética', 10),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'algebra', 'Álgebra', 20),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'geometria', 'Geometría', 30),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'raz_matematico', 'Razonamiento Matemático', 40),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'gramatica', 'Gramática', 10),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'ortografia', 'Ortografía', 20),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'comprension_lectora', 'Comprensión Lectora', 30),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'raz_verbal', 'Razonamiento Verbal', 40),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'biologia', 'Biología', 10),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'fisica', 'Física', 20),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', 'quimica', 'Química', 30),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000004', 'historia', 'Historia', 10),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000004', 'geografia', 'Geografía', 20),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000005', 'educacion_fisica', 'Educación Física', 10),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000006', 'arte', 'Educación por el Arte', 10),
  ('20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000007', 'religion', 'Educación Religiosa', 10),
  ('20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000008', 'ingles', 'Inglés', 10),
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000009', 'computacion', 'Computación', 10),
  ('20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000010', 'conducta', 'Conducta', 10);

create or replace function app_private.is_active_user(
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
    from public.profiles
    where id = user_id
      and status = 'activo'
  );
$$;

create or replace function app_private.can_access_group(
  target_group_id uuid,
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.is_active_admin(user_id)
    or exists (
      select 1
      from public.academic_groups groups
      join public.profiles profiles on profiles.id = groups.teacher_id
      where groups.id = target_group_id
        and groups.active
        and groups.teacher_id = user_id
        and profiles.status = 'activo'
    );
$$;

create or replace function app_private.initialize_group_curriculum(
  target_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_areas (
    group_id,
    catalog_area_id,
    name,
    position,
    active,
    included_in_final,
    is_direct
  )
  select
    target_group_id,
    areas.id,
    areas.name,
    areas.position,
    true,
    areas.included_in_final_by_default,
    areas.is_direct
  from public.academic_area_catalog areas
  on conflict (group_id, catalog_area_id) do nothing;

  insert into public.group_subjects (
    group_id,
    group_area_id,
    catalog_subject_id,
    name,
    position,
    active
  )
  select
    target_group_id,
    group_areas.id,
    subjects.id,
    subjects.name,
    subjects.position,
    true
  from public.subject_catalog subjects
  join public.group_areas group_areas
    on group_areas.catalog_area_id = subjects.area_id
   and group_areas.group_id = target_group_id
  on conflict do nothing;
end;
$$;

create or replace function app_private.initialize_group_curriculum_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.initialize_group_curriculum(new.id);
  return new;
end;
$$;

create trigger academic_groups_initialize_curriculum
after insert on public.academic_groups
for each row execute function app_private.initialize_group_curriculum_trigger();

do $$
declare
  group_record record;
begin
  for group_record in select id from public.academic_groups loop
    perform app_private.initialize_group_curriculum(group_record.id);
  end loop;
end;
$$;

create or replace function public.enroll_student(
  target_group_id uuid,
  student_first_names text,
  student_last_names text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_student_id uuid;
  new_enrollment_id uuid;
  clean_first_names text := btrim(student_first_names);
  clean_last_names text := btrim(student_last_names);
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception
      using errcode = '42501', message = 'No tienes acceso a este grupo.';
  end if;

  if char_length(clean_first_names) not between 2 and 100
     or char_length(clean_last_names) not between 2 and 120 then
    raise exception
      using errcode = '22023', message = 'Revisa los nombres y apellidos.';
  end if;

  insert into public.students (first_names, last_names, created_by)
  values (clean_first_names, clean_last_names, auth.uid())
  returning id into new_student_id;

  insert into public.enrollments (
    group_id,
    student_id,
    created_by
  )
  values (
    target_group_id,
    new_student_id,
    auth.uid()
  )
  returning id into new_enrollment_id;

  return new_enrollment_id;
end;
$$;

alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.academic_area_catalog enable row level security;
alter table public.subject_catalog enable row level security;
alter table public.group_areas enable row level security;
alter table public.group_subjects enable row level security;
alter table public.grades enable row level security;
alter table public.recommendations enable row level security;

create policy "students_select_by_authorized_group"
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments enrollments
    where enrollments.student_id = students.id
      and app_private.can_access_group(enrollments.group_id)
  )
);

create policy "enrollments_select_authorized_group"
on public.enrollments
for select
to authenticated
using (app_private.can_access_group(group_id));

create policy "enrollments_update_authorized_group"
on public.enrollments
for update
to authenticated
using (app_private.can_access_group(group_id))
with check (app_private.can_access_group(group_id));

create policy "area_catalog_active_read"
on public.academic_area_catalog
for select
to authenticated
using (app_private.is_active_user());

create policy "subject_catalog_active_read"
on public.subject_catalog
for select
to authenticated
using (app_private.is_active_user());

create policy "group_areas_select_authorized_group"
on public.group_areas
for select
to authenticated
using (app_private.can_access_group(group_id));

create policy "group_areas_insert_authorized_group"
on public.group_areas
for insert
to authenticated
with check (app_private.can_access_group(group_id));

create policy "group_areas_update_authorized_group"
on public.group_areas
for update
to authenticated
using (app_private.can_access_group(group_id))
with check (app_private.can_access_group(group_id));

create policy "group_subjects_select_authorized_group"
on public.group_subjects
for select
to authenticated
using (app_private.can_access_group(group_id));

create policy "group_subjects_insert_authorized_group"
on public.group_subjects
for insert
to authenticated
with check (app_private.can_access_group(group_id));

create policy "group_subjects_update_authorized_group"
on public.group_subjects
for update
to authenticated
using (app_private.can_access_group(group_id))
with check (app_private.can_access_group(group_id));

create policy "grades_select_authorized_group"
on public.grades
for select
to authenticated
using (app_private.can_access_group(group_id));

create policy "grades_insert_authorized_group"
on public.grades
for insert
to authenticated
with check (app_private.can_access_group(group_id));

create policy "grades_update_authorized_group"
on public.grades
for update
to authenticated
using (app_private.can_access_group(group_id))
with check (app_private.can_access_group(group_id));

create policy "recommendations_select_authorized_group"
on public.recommendations
for select
to authenticated
using (app_private.can_access_group(group_id));

create policy "recommendations_insert_authorized_group"
on public.recommendations
for insert
to authenticated
with check (app_private.can_access_group(group_id));

create policy "recommendations_update_authorized_group"
on public.recommendations
for update
to authenticated
using (app_private.can_access_group(group_id))
with check (app_private.can_access_group(group_id));

revoke all on public.students from anon;
revoke all on public.enrollments from anon;
revoke all on public.academic_area_catalog from anon;
revoke all on public.subject_catalog from anon;
revoke all on public.group_areas from anon;
revoke all on public.group_subjects from anon;
revoke all on public.grades from anon;
revoke all on public.recommendations from anon;

grant select on public.students to authenticated;
grant select, update on public.enrollments to authenticated;
grant select on public.academic_area_catalog to authenticated;
grant select on public.subject_catalog to authenticated;
grant select, insert, update on public.group_areas to authenticated;
grant select, insert, update on public.group_subjects to authenticated;
grant select, insert, update on public.grades to authenticated;
grant select, insert, update on public.recommendations to authenticated;

revoke all on function app_private.is_active_user(uuid) from public;
revoke all on function app_private.can_access_group(uuid, uuid) from public;
revoke all on function public.enroll_student(uuid, text, text) from public;
grant execute on function app_private.is_active_user(uuid) to authenticated;
grant execute on function app_private.can_access_group(uuid, uuid) to authenticated;
grant execute on function public.enroll_student(uuid, text, text) to authenticated;

revoke all on function app_private.initialize_group_curriculum(uuid) from public;
revoke all on function app_private.initialize_group_curriculum_trigger() from public;
revoke all on function app_private.protect_enrollment_history() from public;
revoke all on function app_private.protect_group_area_identity() from public;
revoke all on function app_private.protect_group_subject_identity() from public;
revoke all on function app_private.protect_grade_identity() from public;
revoke all on function app_private.protect_recommendation_identity() from public;

comment on table public.students is
  'Identidad básica del alumno; la matrícula determina su grupo e historial.';
comment on table public.enrollments is
  'Relación histórica entre alumno y grupo académico.';
comment on table public.grades is
  'Fuente de verdad de notas; NULL significa nota no registrada y cero es válido.';
comment on table public.recommendations is
  'Recomendación de tutoría por matrícula y bimestre.';
