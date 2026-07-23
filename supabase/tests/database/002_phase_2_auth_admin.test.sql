begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

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
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '20000001@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"20000001","nombres":"Directora","apellidos":"Fase Dos"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '20000002@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"20000002","nombres":"Docente","apellidos":"Pendiente"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '20000003@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"20000003","nombres":"Docente","apellidos":"Activa"}',
    now(),
    now()
  );

update public.profiles
set role = 'admin', status = 'activo'
where id = '00000000-0000-0000-0000-000000000011';

update public.profiles
set status = 'activo', must_change_password = true
where id = '00000000-0000-0000-0000-000000000013';

update auth.users
set encrypted_password = 'contraseña-cambiada'
where id = '00000000-0000-0000-0000-000000000013';

select results_eq(
  $$
    select status::text
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000012'
  $$,
  $$ values ('pendiente'::text) $$,
  'Una cuenta nueva queda pendiente'
);

select ok(
  (
    select approved_at is not null
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000013'
  ),
  'La aprobación guarda su fecha'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  true
);

select lives_ok(
  $$
    insert into public.academic_groups (
      academic_year,
      level,
      grade,
      section,
      display_name,
      teacher_id,
      created_by
    )
    values (
      2028,
      'primaria',
      2,
      'Única',
      '2028 - Primaria - 2do - Única',
      '00000000-0000-0000-0000-000000000013',
      '00000000-0000-0000-0000-000000000011'
    )
  $$,
  'La administradora puede asignar un grupo a una docente activa'
);

select throws_ok(
  $$
    insert into public.academic_groups (
      academic_year,
      level,
      grade,
      section,
      display_name,
      teacher_id,
      created_by
    )
    values (
      2028,
      'primaria',
      3,
      'Única',
      '2028 - Primaria - 3ro - Única',
      '00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000011'
    )
  $$,
  '23514',
  'El grupo debe asignarse a una docente activa.',
  'No se puede asignar un grupo a una cuenta pendiente'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000013',
  true
);

select results_eq(
  $$ select count(*) from public.academic_groups $$,
  $$ values (1::bigint) $$,
  'La docente activa ve solamente su grupo'
);

select is_empty(
  $$
    update public.profiles
    set role = 'admin'
    where id = '00000000-0000-0000-0000-000000000013'
    returning id
  $$,
  'Una docente no puede cambiar su propio rol'
);

select results_eq(
  $$
    select must_change_password
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000013'
  $$,
  $$ values (false) $$,
  'El cambio en Supabase Auth desactiva la marca de contraseña temporal'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000011',
  true
);

update public.profiles
set status = 'inactivo'
where id = '00000000-0000-0000-0000-000000000013';

select ok(
  (
    select deactivated_at is not null
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000013'
  ),
  'La desactivación guarda su fecha'
);

select ok(
  (
    select must_change_password = false
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000012'
  ),
  'El cambio de contraseña no altera otras cuentas'
);

select * from finish();
rollback;
