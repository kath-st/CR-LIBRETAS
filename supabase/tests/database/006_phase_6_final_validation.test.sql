begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select results_eq(
  $$
    select count(*)
    from pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.institution_settings'::regclass,
      'public.academic_groups'::regclass,
      'public.students'::regclass,
      'public.enrollments'::regclass,
      'public.academic_area_catalog'::regclass,
      'public.subject_catalog'::regclass,
      'public.group_areas'::regclass,
      'public.group_subjects'::regclass,
      'public.grades'::regclass,
      'public.recommendations'::regclass,
      'public.report_card_generations'::regclass,
      'public.group_backup_history'::regclass
    )
      and relrowsecurity
  $$,
  $$ values (13::bigint) $$,
  'RLS está activo en todas las tablas públicas del MVP'
);

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
    '00000000-0000-0000-0000-000000000061',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '60000001@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"60000001","nombres":"Directora","apellidos":"Validación Final"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '60000002@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"60000002","nombres":"Docente A","apellidos":"Validación"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000063',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '60000003@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"60000003","nombres":"Docente B","apellidos":"Validación"}',
    now(),
    now()
  );

update public.profiles
set role = 'admin', status = 'activo'
where id = '00000000-0000-0000-0000-000000000061';

update public.profiles
set status = 'activo'
where id in (
  '00000000-0000-0000-0000-000000000062',
  '00000000-0000-0000-0000-000000000063'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000061',
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
    '60000000-0000-0000-0000-000000000001',
    2032,
    'primaria',
    5,
    'A',
    '2032 - Primaria - 5to - A',
    '00000000-0000-0000-0000-000000000062',
    '00000000-0000-0000-0000-000000000061'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    2032,
    'secundaria',
    1,
    'B',
    '2032 - Secundaria - 1ro - B',
    '00000000-0000-0000-0000-000000000063',
    '00000000-0000-0000-0000-000000000061'
  );

select results_eq(
  $$ select count(*) from public.academic_groups $$,
  $$ values (2::bigint) $$,
  'La administradora ve ambos grupos'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000062',
  true
);

select results_eq(
  $$ select count(*) from public.academic_groups $$,
  $$ values (1::bigint) $$,
  'La docente A solo ve su grupo'
);

select lives_ok(
  $$
    select public.enroll_student(
      '60000000-0000-0000-0000-000000000001',
      'Valery Beatriz',
      'Arquinigo Quispe'
    )
  $$,
  'La docente matricula en su propio grupo'
);

select throws_ok(
  $$
    select public.enroll_student(
      '60000000-0000-0000-0000-000000000002',
      'Alumno',
      'Grupo Ajeno'
    )
  $$,
  '42501',
  'No tienes acceso a este grupo.',
  'La docente no matricula en un grupo ajeno'
);

select lives_ok(
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
      enrollments.group_id,
      enrollments.id,
      subjects.id,
      1,
      14,
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments enrollments
    cross join lateral (
      select id
      from public.group_subjects
      where group_id = enrollments.group_id
      order by position, id
      limit 1
    ) subjects
    where enrollments.group_id =
      '60000000-0000-0000-0000-000000000001'
  $$,
  'Se guarda una nota anterior al retiro'
);

select lives_ok(
  $$
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
      'Recomendación histórica.',
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments
    where group_id = '60000000-0000-0000-0000-000000000001'
  $$,
  'Se guarda una recomendación anterior al retiro'
);

select lives_ok(
  $$
    update public.enrollments
    set status = 'retirado',
        withdrawn_from_term = 2,
        withdrawal_reason = 'Traslado'
    where group_id = '60000000-0000-0000-0000-000000000001'
  $$,
  'El retiro guarda su bimestre y motivo'
);

select ok(
  (
    select
      status = 'retirado'
      and withdrawn_from_term = 2
      and withdrawn_at is not null
      and withdrawn_by =
        '00000000-0000-0000-0000-000000000062'::uuid
    from public.enrollments
    where group_id = '60000000-0000-0000-0000-000000000001'
  ),
  'El retiro conserva autor y fecha'
);

select results_eq(
  $$ select count(*) from public.grades $$,
  $$ values (1::bigint) $$,
  'El retiro conserva las notas anteriores'
);

select results_eq(
  $$ select count(*) from public.recommendations $$,
  $$ values (1::bigint) $$,
  'El retiro conserva las recomendaciones anteriores'
);

select lives_ok(
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
      enrollments.group_id,
      enrollments.id,
      subjects.id,
      2,
      15,
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments enrollments
    cross join lateral (
      select id
      from public.group_subjects
      where group_id = enrollments.group_id
      order by position, id
      limit 1
    ) subjects
    where enrollments.group_id =
      '60000000-0000-0000-0000-000000000001'
  $$,
  'El bimestre de retiro todavía acepta nota'
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
      enrollments.group_id,
      enrollments.id,
      subjects.id,
      3,
      16,
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments enrollments
    cross join lateral (
      select id
      from public.group_subjects
      where group_id = enrollments.group_id
      order by position, id
      limit 1
    ) subjects
    where enrollments.group_id =
      '60000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'El alumno no participa después de su bimestre de retiro.',
  'No se aceptan notas posteriores al retiro'
);

select throws_ok(
  $$
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
      3,
      'No debe guardarse.',
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments
    where group_id = '60000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'El alumno no participa después de su bimestre de retiro.',
  'No se aceptan recomendaciones posteriores al retiro'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000063',
  true
);

select is_empty(
  $$ select id from public.enrollments $$,
  'La docente B no ve la matrícula de la docente A'
);

select is_empty(
  $$ select id from public.grades $$,
  'La docente B no ve las notas de la docente A'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000062',
  true
);

select lives_ok(
  $$
    update public.enrollments
    set status = 'activo'
    where group_id = '60000000-0000-0000-0000-000000000001'
  $$,
  'La reactivación limpia los datos de retiro'
);

select lives_ok(
  $$
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
      3,
      'Participa nuevamente.',
      '00000000-0000-0000-0000-000000000062'
    from public.enrollments
    where group_id = '60000000-0000-0000-0000-000000000001'
  $$,
  'La matrícula reactivada vuelve a aceptar información'
);

select * from finish();
rollback;
