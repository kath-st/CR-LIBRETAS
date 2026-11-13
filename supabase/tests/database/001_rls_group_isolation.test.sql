begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS está activo en profiles'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.academic_groups'::regclass),
  'RLS está activo en academic_groups'
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
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '10000001@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"10000001","nombres":"Directora","apellidos":"Prueba"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '10000002@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"10000002","nombres":"Docente A","apellidos":"Prueba"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '10000003@auth.cristoredentor.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"dni":"10000003","nombres":"Docente B","apellidos":"Prueba"}',
    now(),
    now()
  );

update public.profiles
set status = 'activo',
    role = case
      when id = '00000000-0000-0000-0000-000000000001' then 'admin'::public.app_role
      else 'docente'::public.app_role
    end;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
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
    '10000000-0000-0000-0000-000000000001',
    2026,
    'primaria',
    5,
    'Única',
    '2026 - Primaria - 5to - Única',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    2026,
    'secundaria',
    1,
    'Única',
    '2026 - Secundaria - 1ro - Única',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001'
  );

select results_eq(
  $$ select count(*) from public.academic_groups $$,
  $$ values (2::bigint) $$,
  'La administradora ve todos los grupos'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$ select count(*) from public.academic_groups $$,
  $$ values (1::bigint) $$,
  'La docente A solo ve un grupo'
);

select results_eq(
  $$
    select count(*)
    from public.academic_groups
    where id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$ values (0::bigint) $$,
  'La docente A no ve el grupo de la docente B'
);

select results_eq(
  $$
    update public.academic_groups
    set display_name = 'Cambio no autorizado'
    where id = '10000000-0000-0000-0000-000000000002'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'La docente A no modifica el grupo de la docente B'
);

select throws_ok(
  $$
    insert into public.academic_groups (
      academic_year, level, grade, section, display_name, teacher_id
    )
    values (
      2027, 'primaria', 1, 'Única', 'Grupo no autorizado',
      '00000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'Una docente no puede crear grupos'
);

select * from finish();
rollback;
