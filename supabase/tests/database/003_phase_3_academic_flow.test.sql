begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '30000001@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"30000001","nombres":"Directora","apellidos":"Fase Tres"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '30000002@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"30000002","nombres":"Docente","apellidos":"Grupo Uno"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '30000003@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"30000003","nombres":"Docente","apellidos":"Grupo Dos"}',
    now(),
    now()
  );

update public.profiles
set role = 'admin', status = 'activo'
where id = '00000000-0000-0000-0000-000000000021';

update public.profiles
set status = 'activo'
where id in (
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000023'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000021',
  true
);

insert into public.academic_groups (
  id,
  academic_year,
  level,
  grade,
  section,
  display_name,
  teacher_id,
  created_by
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    2029,
    'primaria',
    4,
    'Única',
    '2029 - Primaria - 4to - Única',
    '00000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000021'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    2029,
    'secundaria',
    2,
    'Única',
    '2029 - Secundaria - 2do - Única',
    '00000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000021'
  );

create temporary table phase3_foreign_subject (id uuid primary key);
insert into phase3_foreign_subject
select id
from public.group_subjects
where group_id = '30000000-0000-0000-0000-000000000002'
order by position, id
limit 1;

select results_eq(
  $$
    select count(*)
    from public.group_areas
    where group_id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$ values (10::bigint) $$,
  'Un grupo nuevo recibe las diez áreas iniciales'
);

select results_eq(
  $$
    select count(*)
    from public.group_subjects
    where group_id = '30000000-0000-0000-0000-000000000001'
  $$,
  $$ values (19::bigint) $$,
  'Un grupo nuevo recibe las diecinueve asignaturas iniciales'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000022',
  true
);

select lives_ok(
  $$
    select public.enroll_student(
      '30000000-0000-0000-0000-000000000001',
      'Valery Beatriz',
      'Arquinigo Quispe'
    )
  $$,
  'La docente matricula un alumno en su grupo'
);

select results_eq(
  $$ select count(*) from public.enrollments $$,
  $$ values (1::bigint) $$,
  'La docente ve solamente la matrícula de su grupo'
);

select throws_ok(
  $$
    select public.enroll_student(
      '30000000-0000-0000-0000-000000000002',
      'Alumno',
      'Grupo Ajeno'
    )
  $$,
  '42501',
  'No tienes acceso a este grupo.',
  'La docente no matricula alumnos en un grupo ajeno'
);

insert into public.grades (
  group_id,
  enrollment_id,
  group_subject_id,
  term,
  score,
  updated_by
)
select
  '30000000-0000-0000-0000-000000000001',
  enrollments.id,
  subjects.id,
  1,
  0,
  '00000000-0000-0000-0000-000000000022'
from public.enrollments enrollments
cross join lateral (
  select id
  from public.group_subjects
  where group_id = '30000000-0000-0000-0000-000000000001'
  order by position
  limit 1
) subjects
where enrollments.group_id = '30000000-0000-0000-0000-000000000001';

select results_eq(
  $$ select score from public.grades where term = 1 $$,
  $$ values (0::smallint) $$,
  'Cero se conserva como nota válida'
);

insert into public.grades (
  group_id,
  enrollment_id,
  group_subject_id,
  term,
  score,
  updated_by
)
select
  '30000000-0000-0000-0000-000000000001',
  enrollment_id,
  group_subject_id,
  2,
  null,
  '00000000-0000-0000-0000-000000000022'
from public.grades
where term = 1;

select ok(
  (select score is null from public.grades where term = 2),
  'NULL se conserva como nota no registrada'
);

select throws_ok(
  $$
    insert into public.grades (
      group_id,
      enrollment_id,
      group_subject_id,
      term,
      score,
      updated_by
    )
    select
      '30000000-0000-0000-0000-000000000001',
      enrollments.id,
      subjects.id,
      3,
      15,
      '00000000-0000-0000-0000-000000000022'
    from public.enrollments enrollments
    cross join phase3_foreign_subject subjects
    where enrollments.group_id = '30000000-0000-0000-0000-000000000001'
  $$,
  '23503',
  'insert or update on table "grades" violates foreign key constraint "grades_subject_group_fk"',
  'La base impide mezclar matrícula y malla de grupos distintos'
);

insert into public.recommendations (
  group_id,
  enrollment_id,
  term,
  text,
  updated_by
)
select
  group_id,
  id,
  1,
  'Continúa participando con responsabilidad.',
  '00000000-0000-0000-0000-000000000022'
from public.enrollments;

select results_eq(
  $$ select count(*) from public.recommendations $$,
  $$ values (1::bigint) $$,
  'La recomendación se guarda por matrícula y bimestre'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000023',
  true
);

select is_empty(
  $$ select id from public.enrollments $$,
  'La segunda docente no puede ver matrículas del primer grupo'
);

select is_empty(
  $$
    update public.enrollments
    set status = 'retirado',
        withdrawn_from_term = 2,
        withdrawn_at = now(),
        withdrawn_by = '00000000-0000-0000-0000-000000000023'
    where group_id = '30000000-0000-0000-0000-000000000001'
    returning id
  $$,
  'La segunda docente no puede retirar una matrícula ajena'
);

select * from finish();
rollback;
