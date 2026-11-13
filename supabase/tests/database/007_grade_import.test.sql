begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000071',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '70000001@usuarios.cristoredentor.edu.pe', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"70000001","nombres":"Docente","apellidos":"Importadora"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000072',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '70000002@usuarios.cristoredentor.edu.pe', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"70000002","nombres":"Docente","apellidos":"Ajena"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000073',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    '70000003@usuarios.cristoredentor.edu.pe', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"70000003","nombres":"Directora","apellidos":"Importaciones"}',
    now(), now()
  );

update public.profiles
set status = 'activo'
where id in (
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000072',
  '00000000-0000-0000-0000-000000000073'
);

update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000073';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000073',
  true
);

insert into public.academic_groups (
  id, academic_year, level, grade, section, display_name, teacher_id, created_by
)
values (
  '70000000-0000-4000-8000-000000000001',
  2033,
  'primaria',
  3,
  'Única',
  '2033 - Primaria - 3ro - Única',
  '00000000-0000-0000-0000-000000000071',
  '00000000-0000-0000-0000-000000000073'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000071',
  true
);

select has_function(
  'public',
  'import_grades',
  array['jsonb', 'text'],
  'Existe la importación transaccional de notas'
);

select lives_ok(
  format(
    $sql$
      select public.import_grades(
        jsonb_build_object(
          'grades', jsonb_build_array(
            jsonb_build_object(
              'group_id', %L,
              'enrollment_id', null,
              'student_key', 'nuevo:perez-ana',
              'first_names', 'Ana',
              'last_names', 'Pérez Soto',
              'group_subject_id', %L,
              'term', 1,
              'score', 0,
              'action', 'set'
            ),
            jsonb_build_object(
              'group_id', %L,
              'enrollment_id', null,
              'student_key', 'nuevo:perez-ana',
              'first_names', 'Ana',
              'last_names', 'Pérez Soto',
              'group_subject_id', %L,
              'term', 2,
              'score', 18,
              'action', 'set'
            )
          )
        ),
        'update'
      )
    $sql$,
    '70000000-0000-4000-8000-000000000001',
    (select id from public.group_subjects where group_id = '70000000-0000-4000-8000-000000000001' and name = 'Aritmética'),
    '70000000-0000-4000-8000-000000000001',
    (select id from public.group_subjects where group_id = '70000000-0000-4000-8000-000000000001' and name = 'Aritmética')
  ),
  'La importación crea el alumno y registra varias notas'
);

select results_eq(
  $$ select count(*) from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001' $$,
  $$ values (1::bigint) $$,
  'El alumno nuevo se matricula una sola vez'
);

select results_eq(
  $$ select array_agg(score order by term) from public.grades where group_id = '70000000-0000-4000-8000-000000000001' $$,
  $$ values (array[0::smallint, 18::smallint]) $$,
  'Cero y las demás notas se conservan correctamente'
);

select results_eq(
  $$ select count(*) from public.group_backup_history where reason = 'antes_de_importar_notas' $$,
  $$ values (1::bigint) $$,
  'La actualización crea un respaldo previo inmutable'
);

select lives_ok(
  format(
    $sql$
      select public.import_grades(
        jsonb_build_object('grades', jsonb_build_array(jsonb_build_object(
          'group_id', %L,
          'enrollment_id', %L,
          'student_key', %L,
          'first_names', 'Ana',
          'last_names', 'Pérez Soto',
          'group_subject_id', %L,
          'term', 2,
          'score', 20,
          'action', 'set'
        ))),
        'fill_empty'
      )
    $sql$,
    '70000000-0000-4000-8000-000000000001',
    (select id from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001'),
    (select id from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001'),
    (select id from public.group_subjects where group_id = '70000000-0000-4000-8000-000000000001' and name = 'Aritmética')
  ),
  'Completar vacíos no falla frente a una celda ocupada'
);

select results_eq(
  $$ select score from public.grades where group_id = '70000000-0000-4000-8000-000000000001' and term = 2 $$,
  $$ values (18::smallint) $$,
  'Completar vacíos no sobrescribe la nota existente'
);

select throws_ok(
  format(
    $sql$
      select public.import_grades(
        jsonb_build_object('grades', jsonb_build_array(jsonb_build_object(
          'group_id', %L,
          'enrollment_id', %L,
          'student_key', %L,
          'first_names', 'Ana',
          'last_names', 'Pérez Soto',
          'group_subject_id', %L,
          'term', 3,
          'score', 21,
          'action', 'set'
        ))),
        'update'
      )
    $sql$,
    '70000000-0000-4000-8000-000000000001',
    (select id from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001'),
    (select id from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001'),
    (select id from public.group_subjects where group_id = '70000000-0000-4000-8000-000000000001' and name = 'Aritmética')
  ),
  '22023',
  'Una nota debe ser un entero de 0 a 20 o una instrucción BORRAR.',
  'Una nota fuera de rango cancela el lote'
);

create temporary table grade_import_test_ids as
select
  (select id from public.enrollments where group_id = '70000000-0000-4000-8000-000000000001') as enrollment_id,
  (select id from public.group_subjects where group_id = '70000000-0000-4000-8000-000000000001' and name = 'Aritmética') as subject_id;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000072',
  true
);

select throws_ok(
  format(
    $sql$
      select public.import_grades(
        jsonb_build_object('grades', jsonb_build_array(jsonb_build_object(
          'group_id', %L,
          'enrollment_id', %L,
          'student_key', %L,
          'first_names', 'Ana',
          'last_names', 'Pérez Soto',
          'group_subject_id', %L,
          'term', 3,
          'score', 15,
          'action', 'set'
        ))),
        'update'
      )
    $sql$,
    '70000000-0000-4000-8000-000000000001',
    (select enrollment_id from pg_temp.grade_import_test_ids),
    (select enrollment_id from pg_temp.grade_import_test_ids),
    (select subject_id from pg_temp.grade_import_test_ids)
  ),
  '42501',
  'No tienes acceso a uno de los grupos importados.',
  'Una docente no puede importar notas a un grupo ajeno'
);

select results_eq(
  $$ select count(*) from public.grades where group_id = '70000000-0000-4000-8000-000000000001' $$,
  $$ values (0::bigint) $$,
  'RLS oculta las notas del grupo ajeno'
);

select * from finish();
rollback;
