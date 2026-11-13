-- CR Libretas — Importación transaccional de notas desde XLSX y CSV.

alter table public.group_backup_history
  drop constraint group_backup_history_reason_check;

alter table public.group_backup_history
  add constraint group_backup_history_reason_check
  check (reason in ('antes_de_restaurar', 'antes_de_importar_notas'));

create or replace function public.import_grades(
  import_document jsonb,
  import_policy text default 'update'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
  backup_count integer := 0;
  backup_group_id uuid;
  backup_payload jsonb;
  backup_document jsonb;
  backup_sha text;
  clean_first_names text;
  clean_last_names text;
  current_enrollment_id uuid;
  current_student_id uuid;
  enrollment_record record;
  grade_data jsonb;
  grade_group_id uuid;
  grade_subject_id uuid;
  grade_term smallint;
  grade_score smallint;
  grade_action text;
  grade_enrollment_id uuid;
  grade_student_key text;
  imported_students integer := 0;
  changed_rows integer;
  total_changes integer;
begin
  if import_policy not in ('fill_empty', 'update', 'replace_terms') then
    raise exception
      using errcode = '22023', message = 'La política de importación no es válida.';
  end if;

  if jsonb_typeof(import_document) is distinct from 'object'
     or jsonb_typeof(import_document -> 'grades') is distinct from 'array' then
    raise exception
      using errcode = '22023', message = 'El documento de importación no es válido.';
  end if;

  total_changes := jsonb_array_length(import_document -> 'grades');
  if total_changes < 1 or total_changes > 40000 then
    raise exception
      using errcode = '22023', message = 'La importación debe contener entre 1 y 40000 cambios.';
  end if;

  create temporary table if not exists pg_temp.grade_import_rows (
    sequence_number bigserial,
    group_id uuid not null,
    enrollment_id uuid,
    student_key text not null,
    first_names text not null,
    last_names text not null,
    group_subject_id uuid not null,
    term smallint not null,
    score smallint,
    action text not null,
    primary key (group_id, student_key, group_subject_id, term)
  ) on commit drop;

  create temporary table if not exists pg_temp.grade_import_student_map (
    group_id uuid not null,
    student_key text not null,
    enrollment_id uuid not null,
    first_names text not null,
    last_names text not null,
    primary key (group_id, student_key)
  ) on commit drop;

  create temporary table if not exists pg_temp.grade_import_scopes (
    group_id uuid not null,
    term smallint not null,
    primary key (group_id, term)
  ) on commit drop;

  truncate table
    pg_temp.grade_import_rows,
    pg_temp.grade_import_student_map,
    pg_temp.grade_import_scopes;

  for grade_data in
    select value from jsonb_array_elements(import_document -> 'grades')
  loop
    begin
      grade_group_id := (grade_data ->> 'group_id')::uuid;
      grade_subject_id := (grade_data ->> 'group_subject_id')::uuid;
      grade_term := (grade_data ->> 'term')::smallint;
      grade_action := grade_data ->> 'action';
      grade_student_key := btrim(coalesce(grade_data ->> 'student_key', ''));
      grade_enrollment_id := nullif(grade_data ->> 'enrollment_id', '')::uuid;
      grade_score := nullif(grade_data ->> 'score', '')::smallint;
    exception when others then
      raise exception
        using errcode = '22023', message = 'Una fila contiene identificadores o notas inválidas.';
    end;

    if not app_private.can_access_group(grade_group_id) then
      raise exception
        using errcode = '42501', message = 'No tienes acceso a uno de los grupos importados.';
    end if;
    if grade_term not between 1 and 4
       or grade_action not in ('set', 'clear')
       or (grade_action = 'set' and (grade_score is null or grade_score not between 0 and 20))
       or (grade_action = 'clear' and grade_score is not null) then
      raise exception
        using errcode = '22023', message = 'Una nota debe ser un entero de 0 a 20 o una instrucción BORRAR.';
    end if;
    if not exists (
      select 1
      from public.group_subjects subjects
      join public.group_areas areas
        on areas.id = subjects.group_area_id
       and areas.group_id = subjects.group_id
      where subjects.id = grade_subject_id
        and subjects.group_id = grade_group_id
        and subjects.active
        and areas.active
    ) then
      raise exception
        using errcode = '22023', message = 'Una asignatura no pertenece al grupo o está desactivada.';
    end if;

    clean_first_names := regexp_replace(btrim(coalesce(grade_data ->> 'first_names', '')), '\s+', ' ', 'g');
    clean_last_names := regexp_replace(btrim(coalesce(grade_data ->> 'last_names', '')), '\s+', ' ', 'g');
    if grade_enrollment_id is not null then
      select enrollments.status, enrollments.withdrawn_from_term
      into enrollment_record
      from public.enrollments enrollments
      where enrollments.id = grade_enrollment_id
        and enrollments.group_id = grade_group_id;
      if not found then
        raise exception
          using errcode = '22023', message = 'Una matrícula no pertenece al grupo importado.';
      end if;
      if enrollment_record.status = 'retirado'
         and enrollment_record.withdrawn_from_term is not null
         and grade_term > enrollment_record.withdrawn_from_term then
        raise exception
          using errcode = '23514', message = 'El alumno no participa después de su bimestre de retiro.';
      end if;
      grade_student_key := grade_enrollment_id::text;
    elsif char_length(clean_first_names) not between 2 and 100
       or char_length(clean_last_names) not between 2 and 120
       or grade_student_key = '' then
      raise exception
        using errcode = '22023', message = 'Un alumno nuevo contiene nombres o apellidos inválidos.';
    end if;

    begin
      insert into pg_temp.grade_import_rows (
        group_id,
        enrollment_id,
        student_key,
        first_names,
        last_names,
        group_subject_id,
        term,
        score,
        action
      )
      values (
        grade_group_id,
        grade_enrollment_id,
        grade_student_key,
        clean_first_names,
        clean_last_names,
        grade_subject_id,
        grade_term,
        grade_score,
        grade_action
      );
    exception when unique_violation then
      raise exception
        using errcode = '22023', message = 'La misma celda de nota aparece más de una vez.';
    end;

    insert into pg_temp.grade_import_scopes (group_id, term)
    values (grade_group_id, grade_term)
    on conflict do nothing;
  end loop;

  if exists (
    select 1
    from pg_temp.grade_import_rows first_row
    join pg_temp.grade_import_rows other_row
      on other_row.group_id = first_row.group_id
     and other_row.student_key = first_row.student_key
    where lower(first_row.first_names) <> lower(other_row.first_names)
       or lower(first_row.last_names) <> lower(other_row.last_names)
  ) then
    raise exception
      using errcode = '22023', message = 'Un alumno nuevo aparece con nombres diferentes.';
  end if;

  -- Serializa importaciones del mismo grupo. Además de mantener coherentes los
  -- reemplazos bimestrales, evita crear dos matrículas para el mismo alumno si
  -- dos archivos se confirman al mismo tiempo.
  perform groups.id
  from public.academic_groups groups
  join (
    select distinct rows.group_id
    from pg_temp.grade_import_rows rows
  ) affected_groups on affected_groups.group_id = groups.id
  order by groups.id
  for update of groups;

  -- Las operaciones que pueden cambiar o limpiar información guardan una
  -- fotografía inmutable del grupo dentro de la misma transacción.
  for backup_group_id in
    select distinct rows.group_id
    from pg_temp.grade_import_rows rows
    where import_policy in ('update', 'replace_terms')
       or rows.action = 'clear'
  loop
    backup_payload := app_private.build_group_backup_payload(backup_group_id);
    backup_sha := encode(
      extensions.digest(convert_to(backup_payload::text, 'UTF8'), 'sha256'),
      'hex'
    );
    backup_document := jsonb_build_object(
      'format', 'cr-libretas.group-backup',
      'version', 1,
      'exported_at', now(),
      'payload', backup_payload,
      'integrity', jsonb_build_object(
        'algorithm', 'sha256',
        'payload_sha256', backup_sha
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
      backup_group_id,
      'antes_de_importar_notas',
      1,
      backup_sha,
      backup_document,
      auth.uid()
    );
    backup_count := backup_count + 1;
  end loop;

  if import_policy = 'replace_terms' then
    update public.grades grades
    set score = null,
        updated_by = auth.uid()
    from pg_temp.grade_import_scopes scopes
    where grades.group_id = scopes.group_id
      and grades.term = scopes.term
      and grades.score is not null;
    get diagnostics changed_rows = row_count;
    affected := affected + changed_rows;
  end if;

  for grade_data in
    select to_jsonb(rows)
    from pg_temp.grade_import_rows rows
    order by rows.sequence_number
  loop
    grade_group_id := (grade_data ->> 'group_id')::uuid;
    grade_enrollment_id := nullif(grade_data ->> 'enrollment_id', '')::uuid;
    grade_student_key := grade_data ->> 'student_key';
    clean_first_names := grade_data ->> 'first_names';
    clean_last_names := grade_data ->> 'last_names';
    grade_subject_id := (grade_data ->> 'group_subject_id')::uuid;
    grade_term := (grade_data ->> 'term')::smallint;
    grade_score := nullif(grade_data ->> 'score', '')::smallint;
    grade_action := grade_data ->> 'action';

    if grade_enrollment_id is null then
      select student_map.enrollment_id
      into current_enrollment_id
      from pg_temp.grade_import_student_map student_map
      where student_map.group_id = grade_group_id
        and student_map.student_key = grade_student_key;

      if not found then
        select enrollments.id
        into current_enrollment_id
        from public.enrollments enrollments
        join public.students students on students.id = enrollments.student_id
        where enrollments.group_id = grade_group_id
          and lower(regexp_replace(btrim(students.first_names), '\s+', ' ', 'g')) = lower(clean_first_names)
          and lower(regexp_replace(btrim(students.last_names), '\s+', ' ', 'g')) = lower(clean_last_names)
        order by enrollments.created_at
        limit 1;

        if not found then
          insert into public.students (first_names, last_names, created_by)
          values (clean_first_names, clean_last_names, auth.uid())
          returning id into current_student_id;

          insert into public.enrollments (group_id, student_id, created_by)
          values (grade_group_id, current_student_id, auth.uid())
          returning id into current_enrollment_id;
          imported_students := imported_students + 1;
        end if;

        insert into pg_temp.grade_import_student_map (
          group_id,
          student_key,
          enrollment_id,
          first_names,
          last_names
        )
        values (
          grade_group_id,
          grade_student_key,
          current_enrollment_id,
          clean_first_names,
          clean_last_names
        );
      end if;
    else
      current_enrollment_id := grade_enrollment_id;
    end if;

    if grade_action = 'clear' then
      update public.grades grades
      set score = null,
          updated_by = auth.uid()
      where grades.enrollment_id = current_enrollment_id
        and grades.group_subject_id = grade_subject_id
        and grades.term = grade_term
        and grades.group_id = grade_group_id
        and grades.score is not null;
    elsif import_policy = 'fill_empty' then
      insert into public.grades (
        group_id,
        enrollment_id,
        group_subject_id,
        term,
        score,
        updated_by
      )
      values (
        grade_group_id,
        current_enrollment_id,
        grade_subject_id,
        grade_term,
        grade_score,
        auth.uid()
      )
      on conflict (enrollment_id, group_subject_id, term)
      do update set
        score = excluded.score,
        updated_by = auth.uid()
      where public.grades.score is null;
    else
      insert into public.grades (
        group_id,
        enrollment_id,
        group_subject_id,
        term,
        score,
        updated_by
      )
      values (
        grade_group_id,
        current_enrollment_id,
        grade_subject_id,
        grade_term,
        grade_score,
        auth.uid()
      )
      on conflict (enrollment_id, group_subject_id, term)
      do update set
        score = excluded.score,
        updated_by = auth.uid();
    end if;
    get diagnostics changed_rows = row_count;
    affected := affected + changed_rows;
  end loop;

  return jsonb_build_object(
    'requested_changes', total_changes,
    'affected_rows', affected,
    'students_created', imported_students,
    'backups_created', backup_count
  );
end;
$$;

revoke all on function public.import_grades(jsonb, text) from public;
grant execute on function public.import_grades(jsonb, text) to authenticated;

comment on function public.import_grades(jsonb, text) is
  'Importa notas de uno o varios grupos autorizados en una sola transacción y respalda los grupos antes de reemplazar información.';
