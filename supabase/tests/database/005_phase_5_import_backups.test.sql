begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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
    '00000000-0000-0000-0000-000000000051',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '50000001@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"50000001","nombres":"Directora","apellidos":"Fase Cinco"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000052',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '50000002@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"50000002","nombres":"Docente","apellidos":"Respaldo"}',
    now(),
    now()
  );

update public.profiles
set role = 'admin', status = 'activo'
where id = '00000000-0000-0000-0000-000000000051';

update public.profiles
set status = 'activo'
where id = '00000000-0000-0000-0000-000000000052';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000051',
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
values (
  '50000000-0000-0000-0000-000000000001',
  2031,
  'primaria',
  5,
  'Única',
  '2031 - Primaria - 5to - Única',
  '00000000-0000-0000-0000-000000000052',
  '00000000-0000-0000-0000-000000000051'
);

select has_table(
  'public',
  'group_backup_history',
  'Existe el historial automático de respaldos'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000052',
  true
);

select lives_ok(
  $$
    select public.import_students(
      '50000000-0000-0000-0000-000000000001',
      '[
        {"first_names":"María","last_names":"Sánchez Torres"},
        {"first_names":"Valery","last_names":"Quispe León"}
      ]'::jsonb
    )
  $$,
  'La docente importa varios alumnos en una operación'
);

select results_eq(
  $$ select count(*) from public.enrollments $$,
  $$ values (2::bigint) $$,
  'La importación crea dos matrículas'
);

select throws_ok(
  $$
    select public.import_students(
      '50000000-0000-0000-0000-000000000001',
      '[
        {"first_names":"Alumno","last_names":"Correcto"},
        {"first_names":"X","last_names":"Inválido"}
      ]'::jsonb
    )
  $$,
  '22023',
  'La fila 2 contiene nombres o apellidos inválidos.',
  'Una fila inválida cancela el lote completo'
);

select results_eq(
  $$ select count(*) from public.enrollments $$,
  $$ values (2::bigint) $$,
  'El lote fallido no deja matrículas parciales'
);

create temporary table phase5_test_backup (document jsonb);
insert into phase5_test_backup
select public.export_group_backup(
  '50000000-0000-0000-0000-000000000001'
);

select ok(
  (
    select (public.validate_group_backup(document) ->> 'valid')::boolean
    from phase5_test_backup
  ),
  'El respaldo exportado supera la validación de integridad'
);

select throws_ok(
  $$
    select public.validate_group_backup(
      jsonb_set(
        (select document from phase5_test_backup),
        '{payload,group,display_name}',
        '"ALTERADO"'::jsonb
      )
    )
  $$,
  '22023',
  'El respaldo fue modificado o está dañado.',
  'Un cambio en el contenido invalida el SHA-256'
);

select lives_ok(
  $$
    select public.import_students(
      '50000000-0000-0000-0000-000000000001',
      '[{"first_names":"Alumno","last_names":"Temporal"}]'::jsonb
    )
  $$,
  'Se agrega un estado posterior al respaldo'
);

select results_eq(
  $$ select count(*) from public.enrollments $$,
  $$ values (3::bigint) $$,
  'El grupo contiene el alumno posterior'
);

select lives_ok(
  $$
    select public.restore_group_backup(
      '50000000-0000-0000-0000-000000000001',
      (select document from phase5_test_backup),
      'mismo',
      null
    )
  $$,
  'La restauración completa se ejecuta en una transacción'
);

select results_eq(
  $$ select count(*) from public.enrollments $$,
  $$ values (2::bigint) $$,
  'La restauración vuelve exactamente a las dos matrículas'
);

select results_eq(
  $$ select count(*) from public.group_backup_history $$,
  $$ values (1::bigint) $$,
  'Se conserva el respaldo automático del estado reemplazado'
);

set local role postgres;

select throws_ok(
  $$
    update public.group_backup_history
    set payload_sha256 = repeat('b', 64)
  $$,
  '55000',
  'El historial de respaldos es inmutable.',
  'El respaldo automático no puede modificarse'
);

select * from finish();
rollback;
