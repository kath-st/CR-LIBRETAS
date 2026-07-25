begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

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
    '00000000-0000-0000-0000-000000000041',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '40000001@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"40000001","nombres":"Docente","apellidos":"Boleta Uno"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000042',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '40000002@usuarios.cristoredentor.edu.pe',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"40000002","nombres":"Docente","apellidos":"Boleta Dos"}',
    now(),
    now()
  );

update public.profiles
set status = 'activo'
where id in (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000042'
);

insert into public.academic_groups (
  id,
  academic_year,
  level,
  grade,
  section,
  display_name,
  teacher_id
)
values (
  '40000000-0000-0000-0000-000000000001',
  2030,
  'primaria',
  6,
  'Única',
  '2030 - Primaria - 6to - Única',
  '00000000-0000-0000-0000-000000000041'
);

insert into public.report_card_generations (
  id,
  group_id,
  scope,
  student_count,
  storage_path,
  file_name,
  content_sha256,
  byte_size,
  snapshot,
  generated_by
)
values (
  '40000000-0000-0000-0000-000000000010',
  '40000000-0000-0000-0000-000000000001',
  'individual',
  1,
  '40000000-0000-0000-0000-000000000001/2030/boleta.pdf',
  'boleta.pdf',
  repeat('a', 64),
  1000,
  '{"version":1,"cards":[]}'::jsonb,
  '00000000-0000-0000-0000-000000000041'
);

select has_table(
  'public',
  'report_card_generations',
  'Existe el historial de boletas'
);

select is(
  (select public from storage.buckets where id = 'report-cards'),
  false,
  'El bucket de boletas es privado'
);

select throws_ok(
  $$
    update public.report_card_generations
    set file_name = 'modificada.pdf'
    where id = '40000000-0000-0000-0000-000000000010'
  $$,
  '55000',
  'Las boletas generadas son inmutables.',
  'Una generación no puede modificarse'
);

select throws_ok(
  $$
    delete from public.report_card_generations
    where id = '40000000-0000-0000-0000-000000000010'
  $$,
  '55000',
  'Las boletas generadas son inmutables.',
  'Una generación no puede eliminarse'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000041',
  true
);

select results_eq(
  $$ select count(*) from public.report_card_generations $$,
  $$ values (1::bigint) $$,
  'La docente asignada ve el historial de su grupo'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000042',
  true
);

select is_empty(
  $$ select id from public.report_card_generations $$,
  'Otra docente no ve el historial ajeno'
);

select * from finish();
rollback;
