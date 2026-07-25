-- CR Libretas — Fase 5
-- Importación masiva de alumnos y respaldos JSON transaccionales por grupo.

create table public.group_backup_history (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  reason text not null check (reason in ('antes_de_restaurar')),
  format_version smallint not null default 1 check (format_version = 1),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  document jsonb not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index group_backup_history_group_created_idx
  on public.group_backup_history (group_id, created_at desc);

create or replace function app_private.reject_backup_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    using
      errcode = '55000',
      message = 'El historial de respaldos es inmutable.';
end;
$$;

create trigger group_backup_history_is_immutable
before update or delete on public.group_backup_history
for each row execute function app_private.reject_backup_history_mutation();

alter table public.group_backup_history enable row level security;

create policy "backup_history_select_authorized_group"
on public.group_backup_history
for select
to authenticated
using (app_private.can_access_group(group_id));

revoke all on public.group_backup_history from anon;
grant select on public.group_backup_history to authenticated;

create or replace function public.import_students(
  target_group_id uuid,
  student_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_first_names text;
  clean_last_names text;
  imported jsonb := '[]'::jsonb;
  new_enrollment_id uuid;
  new_student_id uuid;
  row_data jsonb;
  row_number integer := 0;
  total_rows integer;
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception
      using errcode = '42501', message = 'No tienes acceso a este grupo.';
  end if;

  if jsonb_typeof(student_rows) is distinct from 'array' then
    raise exception
      using errcode = '22023', message = 'La importación debe ser una lista de alumnos.';
  end if;

  total_rows := jsonb_array_length(student_rows);
  if total_rows < 1 or total_rows > 200 then
    raise exception
      using errcode = '22023', message = 'La importación debe contener entre 1 y 200 alumnos.';
  end if;

  for row_data in select value from jsonb_array_elements(student_rows) loop
    row_number := row_number + 1;
    clean_first_names := regexp_replace(
      btrim(coalesce(row_data ->> 'first_names', '')),
      '\s+',
      ' ',
      'g'
    );
    clean_last_names := regexp_replace(
      btrim(coalesce(row_data ->> 'last_names', '')),
      '\s+',
      ' ',
      'g'
    );

    if char_length(clean_first_names) not between 2 and 100
       or char_length(clean_last_names) not between 2 and 120 then
      raise exception
        using
          errcode = '22023',
          message = format('La fila %s contiene nombres o apellidos inválidos.', row_number);
    end if;

    insert into public.students (first_names, last_names, created_by)
    values (clean_first_names, clean_last_names, auth.uid())
    returning id into new_student_id;

    insert into public.enrollments (group_id, student_id, created_by)
    values (target_group_id, new_student_id, auth.uid())
    returning id into new_enrollment_id;

    imported := imported || jsonb_build_array(
      jsonb_build_object(
        'enrollment_id', new_enrollment_id,
        'student_id', new_student_id,
        'first_names', clean_first_names,
        'last_names', clean_last_names
      )
    );
  end loop;

  return jsonb_build_object(
    'count', total_rows,
    'imported', imported
  );
end;
$$;

create or replace function app_private.build_group_backup_payload(
  target_group_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'institution',
      (
        select jsonb_build_object(
          'name', settings.name,
          'address', settings.address,
          'motto', settings.motto,
          'official_year_name', settings.official_year_name
        )
        from public.institution_settings settings
        where settings.id = 1
      ),
    'group',
      (
        select jsonb_build_object(
          'id', groups.id,
          'academic_year', groups.academic_year,
          'level', groups.level,
          'grade', groups.grade,
          'section', groups.section,
          'display_name', groups.display_name,
          'teacher_id', groups.teacher_id,
          'active', groups.active
        )
        from public.academic_groups groups
        where groups.id = target_group_id
      ),
    'students',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', students.id,
              'first_names', students.first_names,
              'last_names', students.last_names
            )
            order by students.last_names, students.first_names, students.id
          )
          from public.students students
          join public.enrollments enrollments
            on enrollments.student_id = students.id
          where enrollments.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'enrollments',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', enrollments.id,
              'student_id', enrollments.student_id,
              'status', enrollments.status,
              'withdrawn_from_term', enrollments.withdrawn_from_term,
              'withdrawal_reason', enrollments.withdrawal_reason,
              'withdrawn_at', enrollments.withdrawn_at
            )
            order by enrollments.created_at, enrollments.id
          )
          from public.enrollments enrollments
          where enrollments.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'areas',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', areas.id,
              'catalog_area_id', areas.catalog_area_id,
              'name', areas.name,
              'position', areas.position,
              'active', areas.active,
              'included_in_final', areas.included_in_final,
              'is_direct', areas.is_direct
            )
            order by areas.position, areas.id
          )
          from public.group_areas areas
          where areas.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'subjects',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', subjects.id,
              'group_area_id', subjects.group_area_id,
              'catalog_subject_id', subjects.catalog_subject_id,
              'name', subjects.name,
              'position', subjects.position,
              'active', subjects.active
            )
            order by subjects.group_area_id, subjects.position, subjects.id
          )
          from public.group_subjects subjects
          where subjects.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'grades',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'enrollment_id', grades.enrollment_id,
              'group_subject_id', grades.group_subject_id,
              'term', grades.term,
              'score', grades.score
            )
            order by grades.enrollment_id, grades.group_subject_id, grades.term
          )
          from public.grades grades
          where grades.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'recommendations',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'enrollment_id', recommendations.enrollment_id,
              'term', recommendations.term,
              'text', recommendations.text
            )
            order by recommendations.enrollment_id, recommendations.term
          )
          from public.recommendations recommendations
          where recommendations.group_id = target_group_id
        ),
        '[]'::jsonb
      ),
    'results',
      jsonb_build_object(
        'informative_only', true,
        'final_averages',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'enrollment_id', averages.enrollment_id,
                  'average', averages.average
                )
                order by averages.enrollment_id
              )
              from (
                select
                  grades.enrollment_id,
                  round(avg(grades.score)::numeric, 1) as average
                from public.grades grades
                join public.group_subjects subjects
                  on subjects.id = grades.group_subject_id
                 and subjects.group_id = grades.group_id
                join public.group_areas areas
                  on areas.id = subjects.group_area_id
                 and areas.group_id = subjects.group_id
                where grades.group_id = target_group_id
                  and grades.score is not null
                  and subjects.active
                  and areas.active
                  and areas.included_in_final
                group by grades.enrollment_id
              ) averages
            ),
            '[]'::jsonb
          )
      )
  );
$$;

create or replace function public.export_group_backup(
  target_group_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  backup_payload jsonb;
  payload_hash text;
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception
      using errcode = '42501', message = 'No tienes acceso a este grupo.';
  end if;

  backup_payload := app_private.build_group_backup_payload(target_group_id);
  if backup_payload -> 'group' = 'null'::jsonb then
    raise exception
      using errcode = 'P0002', message = 'El grupo no existe.';
  end if;

  payload_hash := encode(
    extensions.digest(convert_to(backup_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  return jsonb_build_object(
    'format', 'cr-libretas.group-backup',
    'version', 1,
    'exported_at', now(),
    'payload', backup_payload,
    'integrity', jsonb_build_object(
      'algorithm', 'sha256',
      'payload_sha256', payload_hash
    )
  );
end;
$$;

create or replace function public.validate_group_backup(
  backup_document jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  received_hash text;
begin
  if not app_private.is_active_user() then
    raise exception
      using errcode = '42501', message = 'La cuenta no está activa.';
  end if;

  if jsonb_typeof(backup_document) is distinct from 'object'
     or backup_document ->> 'format' is distinct from 'cr-libretas.group-backup'
     or backup_document ->> 'version' is distinct from '1'
     or jsonb_typeof(backup_document -> 'payload') is distinct from 'object'
     or jsonb_typeof(backup_document #> '{payload,students}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,enrollments}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,areas}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,subjects}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,grades}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,recommendations}') is distinct from 'array'
     or jsonb_typeof(backup_document #> '{payload,group}') is distinct from 'object' then
    raise exception
      using errcode = '22023', message = 'El archivo no es un respaldo válido de CR Libretas.';
  end if;

  expected_hash := encode(
    extensions.digest(
      convert_to((backup_document -> 'payload')::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  received_hash := lower(coalesce(backup_document #>> '{integrity,payload_sha256}', ''));

  if received_hash !~ '^[0-9a-f]{64}$'
     or received_hash is distinct from expected_hash then
    raise exception
      using errcode = '22023', message = 'El respaldo fue modificado o está dañado.';
  end if;

  return jsonb_build_object(
    'valid', true,
    'source_group', backup_document #> '{payload,group}',
    'students', jsonb_array_length(backup_document #> '{payload,students}'),
    'active_enrollments',
      (
        select count(*)
        from jsonb_array_elements(backup_document #> '{payload,enrollments}') item
        where item ->> 'status' = 'activo'
      ),
    'retired_enrollments',
      (
        select count(*)
        from jsonb_array_elements(backup_document #> '{payload,enrollments}') item
        where item ->> 'status' = 'retirado'
      ),
    'subjects', jsonb_array_length(backup_document #> '{payload,subjects}'),
    'grades', jsonb_array_length(backup_document #> '{payload,grades}'),
    'recommendations',
      jsonb_array_length(backup_document #> '{payload,recommendations}')
  );
end;
$$;

create or replace function public.restore_group_backup(
  target_group_id uuid,
  backup_document jsonb,
  restore_mode text,
  new_group jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  area_data jsonb;
  backup_payload jsonb;
  current_document jsonb;
  current_payload jsonb;
  current_sha text;
  destination_group_id uuid := target_group_id;
  enrollment_data jsonb;
  grade_data jsonb;
  recommendation_data jsonb;
  source_id uuid;
  subject_data jsonb;
  student_data jsonb;
  target_id uuid;
  target_teacher_id uuid;
begin
  if not app_private.can_access_group(target_group_id) then
    raise exception
      using errcode = '42501', message = 'No tienes acceso al grupo de destino.';
  end if;

  perform public.validate_group_backup(backup_document);
  backup_payload := backup_document -> 'payload';

  if restore_mode not in ('mismo', 'nuevo') then
    raise exception
      using errcode = '22023', message = 'Selecciona un modo de restauración válido.';
  end if;

  create temporary table if not exists pg_temp.phase5_student_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  create temporary table if not exists pg_temp.phase5_enrollment_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  create temporary table if not exists pg_temp.phase5_area_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  create temporary table if not exists pg_temp.phase5_subject_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;
  create temporary table if not exists pg_temp.phase5_old_students (
    id uuid primary key
  ) on commit drop;

  truncate table
    pg_temp.phase5_student_map,
    pg_temp.phase5_enrollment_map,
    pg_temp.phase5_area_map,
    pg_temp.phase5_subject_map,
    pg_temp.phase5_old_students;

  if restore_mode = 'nuevo' then
    if not app_private.is_active_admin() then
      raise exception
        using errcode = '42501', message = 'Solo administración puede crear una copia del grupo.';
    end if;

    if jsonb_typeof(new_group) is distinct from 'object' then
      raise exception
        using errcode = '22023', message = 'Completa los datos del nuevo grupo.';
    end if;

    select groups.teacher_id
    into target_teacher_id
    from public.academic_groups groups
    where groups.id = target_group_id;

    insert into public.academic_groups (
      academic_year,
      level,
      grade,
      section,
      display_name,
      teacher_id,
      active,
      created_by
    )
    values (
      (new_group ->> 'academic_year')::smallint,
      (new_group ->> 'level')::public.education_level,
      (new_group ->> 'grade')::smallint,
      regexp_replace(btrim(new_group ->> 'section'), '\s+', ' ', 'g'),
      regexp_replace(btrim(new_group ->> 'display_name'), '\s+', ' ', 'g'),
      target_teacher_id,
      true,
      auth.uid()
    )
    returning id into destination_group_id;
  else
    current_payload := app_private.build_group_backup_payload(target_group_id);
    current_sha := encode(
      extensions.digest(convert_to(current_payload::text, 'UTF8'), 'sha256'),
      'hex'
    );
    current_document := jsonb_build_object(
      'format', 'cr-libretas.group-backup',
      'version', 1,
      'exported_at', now(),
      'payload', current_payload,
      'integrity', jsonb_build_object(
        'algorithm', 'sha256',
        'payload_sha256', current_sha
      )
    );

    insert into public.group_backup_history (
      group_id,
      reason,
      format_version,
      payload_sha256,
      document,
      created_by
    )
    values (
      target_group_id,
      'antes_de_restaurar',
      1,
      current_sha,
      current_document,
      auth.uid()
    );
  end if;

  insert into pg_temp.phase5_old_students (id)
  select enrollments.student_id
  from public.enrollments enrollments
  where enrollments.group_id = destination_group_id
  on conflict do nothing;

  delete from public.recommendations
  where group_id = destination_group_id;
  delete from public.grades
  where group_id = destination_group_id;
  delete from public.enrollments
  where group_id = destination_group_id;
  delete from public.group_subjects
  where group_id = destination_group_id;
  delete from public.group_areas
  where group_id = destination_group_id;

  delete from public.students students
  using pg_temp.phase5_old_students old_students
  where students.id = old_students.id
    and not exists (
      select 1
      from public.enrollments enrollments
      where enrollments.student_id = students.id
    );

  for student_data in
    select value from jsonb_array_elements(backup_payload -> 'students')
  loop
    source_id := (student_data ->> 'id')::uuid;
    target_id := gen_random_uuid();
    insert into public.students (
      id,
      first_names,
      last_names,
      created_by
    )
    values (
      target_id,
      regexp_replace(btrim(student_data ->> 'first_names'), '\s+', ' ', 'g'),
      regexp_replace(btrim(student_data ->> 'last_names'), '\s+', ' ', 'g'),
      auth.uid()
    );
    insert into pg_temp.phase5_student_map values (source_id, target_id);
  end loop;

  for enrollment_data in
    select value from jsonb_array_elements(backup_payload -> 'enrollments')
  loop
    source_id := (enrollment_data ->> 'id')::uuid;
    target_id := gen_random_uuid();
    insert into public.enrollments (
      id,
      group_id,
      student_id,
      status,
      withdrawn_from_term,
      withdrawal_reason,
      withdrawn_at,
      withdrawn_by,
      created_by
    )
    select
      target_id,
      destination_group_id,
      student_map.target_id,
      (enrollment_data ->> 'status')::public.enrollment_status,
      nullif(enrollment_data ->> 'withdrawn_from_term', '')::smallint,
      nullif(enrollment_data ->> 'withdrawal_reason', ''),
      case
        when enrollment_data ->> 'status' = 'retirado'
          then coalesce(
            nullif(enrollment_data ->> 'withdrawn_at', '')::timestamptz,
            now()
          )
        else null
      end,
      case
        when enrollment_data ->> 'status' = 'retirado' then auth.uid()
        else null
      end,
      auth.uid()
    from pg_temp.phase5_student_map student_map
    where student_map.source_id = (enrollment_data ->> 'student_id')::uuid;

    if not found then
      raise exception
        using errcode = '22023', message = 'Una matrícula referencia un alumno inexistente.';
    end if;
    insert into pg_temp.phase5_enrollment_map values (source_id, target_id);
  end loop;

  for area_data in
    select value from jsonb_array_elements(backup_payload -> 'areas')
  loop
    source_id := (area_data ->> 'id')::uuid;
    target_id := gen_random_uuid();
    insert into public.group_areas (
      id,
      group_id,
      catalog_area_id,
      name,
      position,
      active,
      included_in_final,
      is_direct
    )
    values (
      target_id,
      destination_group_id,
      (area_data ->> 'catalog_area_id')::uuid,
      area_data ->> 'name',
      (area_data ->> 'position')::smallint,
      (area_data ->> 'active')::boolean,
      (area_data ->> 'included_in_final')::boolean,
      (area_data ->> 'is_direct')::boolean
    );
    insert into pg_temp.phase5_area_map values (source_id, target_id);
  end loop;

  for subject_data in
    select value from jsonb_array_elements(backup_payload -> 'subjects')
  loop
    source_id := (subject_data ->> 'id')::uuid;
    target_id := gen_random_uuid();
    insert into public.group_subjects (
      id,
      group_id,
      group_area_id,
      catalog_subject_id,
      name,
      position,
      active
    )
    select
      target_id,
      destination_group_id,
      area_map.target_id,
      nullif(subject_data ->> 'catalog_subject_id', '')::uuid,
      subject_data ->> 'name',
      (subject_data ->> 'position')::smallint,
      (subject_data ->> 'active')::boolean
    from pg_temp.phase5_area_map area_map
    where area_map.source_id = (subject_data ->> 'group_area_id')::uuid;

    if not found then
      raise exception
        using errcode = '22023', message = 'Una asignatura referencia un área inexistente.';
    end if;
    insert into pg_temp.phase5_subject_map values (source_id, target_id);
  end loop;

  for grade_data in
    select value from jsonb_array_elements(backup_payload -> 'grades')
  loop
    insert into public.grades (
      group_id,
      enrollment_id,
      group_subject_id,
      term,
      score,
      updated_by
    )
    select
      destination_group_id,
      enrollment_map.target_id,
      subject_map.target_id,
      (grade_data ->> 'term')::smallint,
      nullif(grade_data ->> 'score', '')::smallint,
      auth.uid()
    from pg_temp.phase5_enrollment_map enrollment_map
    cross join pg_temp.phase5_subject_map subject_map
    where enrollment_map.source_id =
      (grade_data ->> 'enrollment_id')::uuid
      and subject_map.source_id =
        (grade_data ->> 'group_subject_id')::uuid;

    if not found then
      raise exception
        using errcode = '22023', message = 'Una nota contiene referencias inexistentes.';
    end if;
  end loop;

  for recommendation_data in
    select value from jsonb_array_elements(backup_payload -> 'recommendations')
  loop
    insert into public.recommendations (
      group_id,
      enrollment_id,
      term,
      text,
      updated_by
    )
    select
      destination_group_id,
      enrollment_map.target_id,
      (recommendation_data ->> 'term')::smallint,
      coalesce(recommendation_data ->> 'text', ''),
      auth.uid()
    from pg_temp.phase5_enrollment_map enrollment_map
    where enrollment_map.source_id =
      (recommendation_data ->> 'enrollment_id')::uuid;

    if not found then
      raise exception
        using errcode = '22023', message = 'Una recomendación referencia una matrícula inexistente.';
    end if;
  end loop;

  return jsonb_build_object(
    'group_id', destination_group_id,
    'mode', restore_mode,
    'students', jsonb_array_length(backup_payload -> 'students'),
    'grades', jsonb_array_length(backup_payload -> 'grades'),
    'recommendations',
      jsonb_array_length(backup_payload -> 'recommendations')
  );
end;
$$;

revoke all on function app_private.reject_backup_history_mutation() from public;
revoke all on function app_private.build_group_backup_payload(uuid) from public;
revoke all on function public.import_students(uuid, jsonb) from public;
revoke all on function public.export_group_backup(uuid) from public;
revoke all on function public.validate_group_backup(jsonb) from public;
revoke all on function public.restore_group_backup(uuid, jsonb, text, jsonb)
  from public;

grant execute on function public.import_students(uuid, jsonb) to authenticated;
grant execute on function public.export_group_backup(uuid) to authenticated;
grant execute on function public.validate_group_backup(jsonb) to authenticated;
grant execute on function public.restore_group_backup(uuid, jsonb, text, jsonb)
  to authenticated;

comment on table public.group_backup_history is
  'Respaldos automáticos e inmutables creados antes de restaurar un grupo.';
comment on function public.import_students(uuid, jsonb) is
  'Importa hasta 200 alumnos y matrículas en una única transacción.';
comment on function public.restore_group_backup(uuid, jsonb, text, jsonb) is
  'Valida integridad y restaura un respaldo completo sin estados parciales.';
