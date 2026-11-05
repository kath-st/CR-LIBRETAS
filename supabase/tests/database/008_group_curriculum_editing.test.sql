begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(21);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '30000081@usuarios.cristoredentor.edu.pe', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"dni":"30000081","nombres":"Directora","apellidos":"Malla"}', now(), now()),
  ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '30000082@usuarios.cristoredentor.edu.pe', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"dni":"30000082","nombres":"Docente","apellidos":"Uno"}', now(), now()),
  ('00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', '30000083@usuarios.cristoredentor.edu.pe', '', now(),
   '{"provider":"email","providers":["email"]}',
   '{"dni":"30000083","nombres":"Docente","apellidos":"Dos"}', now(), now());

update public.profiles set role = 'admin', status = 'activo'
where id = '00000000-0000-0000-0000-000000000081';
update public.profiles set status = 'activo'
where id in ('00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000083');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', true);

insert into public.academic_groups (
  id, academic_year, level, grade, section, display_name, teacher_id, created_by
)
values
  ('30000000-0000-0000-0000-000000000081', 2030, 'primaria', 4, 'A', '2030 - 4A',
   '00000000-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000081'),
  ('30000000-0000-0000-0000-000000000082', 2030, 'primaria', 4, 'B', '2030 - 4B',
   '00000000-0000-0000-0000-000000000083', '00000000-0000-0000-0000-000000000081');

select results_eq(
  $$ select count(*) from public.group_areas where group_id = '30000000-0000-0000-0000-000000000081' $$,
  $$ values (10::bigint) $$,
  'Se conserva la malla inicial de diez áreas'
);
select results_eq(
  $$ select count(*) from public.group_subjects where group_id = '30000000-0000-0000-0000-000000000082' $$,
  $$ values (19::bigint) $$,
  'Otro grupo conserva sus diecinueve asignaturas iniciales'
);

insert into public.group_subjects (group_id, group_area_id, name, position)
select '30000000-0000-0000-0000-000000000081', area.id, 'Entrenamiento', 20
from public.group_areas area
where area.group_id = '30000000-0000-0000-0000-000000000081'
  and area.catalog_area_id = '10000000-0000-0000-0000-000000000005';
select results_eq(
  $$ select count(*) from public.group_subjects subject
     join public.group_areas area on area.id = subject.group_area_id
     where area.group_id = '30000000-0000-0000-0000-000000000081'
       and area.catalog_area_id = '10000000-0000-0000-0000-000000000005' $$,
  $$ values (2::bigint) $$,
  'También se puede agregar una asignatura a un área de nota directa'
);

insert into public.group_areas (id, group_id, name, position, included_in_final)
values ('40000000-0000-0000-0000-000000000081', '30000000-0000-0000-0000-000000000081',
  'Talleres', 110, true);
insert into public.group_subjects (id, group_id, group_area_id, name, position)
values ('50000000-0000-0000-0000-000000000081', '30000000-0000-0000-0000-000000000081',
  '40000000-0000-0000-0000-000000000081', 'Robótica', 10);

select results_eq(
  $$ select count(*) from public.group_areas where group_id = '30000000-0000-0000-0000-000000000082' and name = 'Talleres' $$,
  $$ values (0::bigint) $$,
  'El área nueva no aparece en otro grupo'
);
select results_eq(
  $$ select count(*) from public.academic_area_catalog $$,
  $$ values (10::bigint) $$,
  'El catálogo predeterminado permanece intacto'
);

update public.group_areas set name = 'Laboratorios'
where id = '40000000-0000-0000-0000-000000000081';
update public.group_subjects set name = 'Tecnología aplicada'
where id = '50000000-0000-0000-0000-000000000081';

select results_eq(
  $$ select name_aliases from public.group_areas where id = '40000000-0000-0000-0000-000000000081' $$,
  $$ values (array['Talleres']::text[]) $$,
  'El área recuerda el nombre anterior'
);
select results_eq(
  $$ select name_aliases from public.group_subjects where id = '50000000-0000-0000-0000-000000000081' $$,
  $$ values (array['Robótica']::text[]) $$,
  'La asignatura recuerda el nombre anterior'
);

update public.group_subjects set name_aliases = array['nombre inventado']
where id = '50000000-0000-0000-0000-000000000081';
select results_eq(
  $$ select name_aliases from public.group_subjects where id = '50000000-0000-0000-0000-000000000081' $$,
  $$ values (array['Robótica']::text[]) $$,
  'El cliente no puede alterar las equivalencias'
);

select lives_ok(
  $$ select public.delete_group_subject('30000000-0000-0000-0000-000000000081', '50000000-0000-0000-0000-000000000081') $$,
  'Se puede eliminar una asignatura sin dependencias'
);
select lives_ok(
  $$ select public.delete_group_area('30000000-0000-0000-0000-000000000081', '40000000-0000-0000-0000-000000000081') $$,
  'Se puede eliminar un área sin dependencias'
);

create temporary table curriculum_enrollment (id uuid);
insert into curriculum_enrollment
select public.enroll_student('30000000-0000-0000-0000-000000000081', 'Alumna', 'De Prueba');

insert into public.grades (group_id, enrollment_id, group_subject_id, term, score, updated_by)
select '30000000-0000-0000-0000-000000000081', enrollment.id, subject.id, 1, 17,
  '00000000-0000-0000-0000-000000000081'
from curriculum_enrollment enrollment
cross join public.group_subjects subject
where subject.group_id = '30000000-0000-0000-0000-000000000081'
  and subject.catalog_subject_id = '20000000-0000-0000-0000-000000000001';

update public.group_subjects set name = 'Aritmética renovada'
where group_id = '30000000-0000-0000-0000-000000000081'
  and catalog_subject_id = '20000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select score from public.grades where group_id = '30000000-0000-0000-0000-000000000081' $$,
  $$ values (17::smallint) $$,
  'Renombrar una asignatura conserva su nota'
);
select results_eq(
  $$ select name from public.group_subjects where group_id = '30000000-0000-0000-0000-000000000082' and catalog_subject_id = '20000000-0000-0000-0000-000000000001' $$,
  $$ values ('Aritmética'::text) $$,
  'Renombrar en un grupo no cambia el otro'
);

select lives_ok(
  format(
    $sql$select public.import_grades(
      jsonb_build_object('grades', jsonb_build_array(jsonb_build_object(
        'group_id', %L,
        'enrollment_id', %L,
        'student_key', %L,
        'first_names', 'Alumna',
        'last_names', 'De Prueba',
        'group_subject_id', %L,
        'term', 2,
        'score', 18,
        'action', 'set'
      ))), 'update'
    )$sql$,
    '30000000-0000-0000-0000-000000000081',
    (select id from curriculum_enrollment),
    (select id from curriculum_enrollment),
    (select id from public.group_subjects
      where group_id = '30000000-0000-0000-0000-000000000081'
        and catalog_subject_id = '20000000-0000-0000-0000-000000000001')
  ),
  'La carga masiva usa el mismo ID tras renombrar'
);
select results_eq(
  $$ select score from public.grades
     where group_id = '30000000-0000-0000-0000-000000000081' and term = 2 $$,
  $$ values (18::smallint) $$,
  'La carga masiva guarda la nota en la asignatura original'
);

select throws_ok(
  $$ select public.delete_group_subject('30000000-0000-0000-0000-000000000081', id) from public.group_subjects where group_id = '30000000-0000-0000-0000-000000000081' and catalog_subject_id = '20000000-0000-0000-0000-000000000001' $$,
  '23503', 'La asignatura tiene notas o boletas históricas. Desactívala para conservarlas.',
  'No se borra una asignatura con notas'
);
select throws_ok(
  $$ select public.delete_group_area('30000000-0000-0000-0000-000000000081', id) from public.group_areas where group_id = '30000000-0000-0000-0000-000000000081' and catalog_area_id = '10000000-0000-0000-0000-000000000001' $$,
  '23503', 'El área o sus asignaturas tienen notas o boletas históricas. Desactívala para conservarlas.',
  'No se borra un área que contiene notas'
);

insert into public.group_subjects (id, group_id, group_area_id, name, position)
select '50000000-0000-0000-0000-000000000082',
  '30000000-0000-0000-0000-000000000081', area.id, 'Taller histórico', 90
from public.group_areas area
where area.group_id = '30000000-0000-0000-0000-000000000081'
  and area.catalog_area_id = '10000000-0000-0000-0000-000000000001';

reset role;
insert into public.report_card_generations (
  group_id, scope, student_count, storage_path, file_name,
  content_sha256, byte_size, snapshot, generated_by
)
select '30000000-0000-0000-0000-000000000081', 'individual', 1,
  '2030/boleta-historica.pdf', 'boleta-historica.pdf', repeat('a', 64), 1,
  jsonb_build_object('cards', jsonb_build_array(jsonb_build_object(
    'areas', jsonb_build_array(jsonb_build_object(
      'id', area.id, 'subjects', jsonb_build_array(jsonb_build_object(
        'id', '50000000-0000-0000-0000-000000000082'
      ))
    ))
  ))),
  '00000000-0000-0000-0000-000000000081'
from public.group_areas area
where area.group_id = '30000000-0000-0000-0000-000000000081'
  and area.catalog_area_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
select throws_ok(
  $$ select public.delete_group_subject('30000000-0000-0000-0000-000000000081', '50000000-0000-0000-0000-000000000082') $$,
  '23503', 'La asignatura tiene notas o boletas históricas. Desactívala para conservarlas.',
  'Una boleta histórica protege la asignatura aunque aún no tenga notas'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000082', true);
select throws_ok(
  $$ select public.delete_group_area('30000000-0000-0000-0000-000000000082', '40000000-0000-0000-0000-000000000099') $$,
  '42501', 'No tienes acceso a este grupo.',
  'Una docente no elimina áreas de otro grupo'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000081', true);
create temporary table curriculum_backup_document as
select public.export_group_backup('30000000-0000-0000-0000-000000000081') as document;
select results_eq(
  $$ select count(*) from curriculum_backup_document backup,
       jsonb_array_elements(backup.document #> '{payload,subjects}') subject
     where subject->>'name' = 'Aritmética renovada'
       and subject->'name_aliases' @> '["Aritmética"]'::jsonb $$,
  $$ values (1::bigint) $$,
  'El respaldo exporta los nombres anteriores'
);
select lives_ok(
  $$ select public.restore_group_backup('30000000-0000-0000-0000-000000000081', document, 'mismo')
     from curriculum_backup_document $$,
  'La restauración acepta la nueva malla y su historial de nombres'
);
select results_eq(
  $$ select name_aliases from public.group_subjects
     where group_id = '30000000-0000-0000-0000-000000000081'
       and name = 'Aritmética renovada' $$,
  $$ values (array['Aritmética']::text[]) $$,
  'La restauración conserva equivalencias para plantillas antiguas'
);

select * from finish();
rollback;
