-- CR Libretas — Fase 6
-- Corrige la colisión entre la variable local target_id y las columnas
-- target_id de las tablas temporales usadas durante una restauración.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.restore_group_backup(uuid,jsonb,text,jsonb)'::regprocedure
  )
  into function_definition;

  function_definition := replace(
    function_definition,
    '  target_id uuid;',
    '  restored_target_id uuid;'
  );
  function_definition := replace(
    function_definition,
    '    target_id := gen_random_uuid();',
    '    restored_target_id := gen_random_uuid();'
  );
  function_definition := replace(
    function_definition,
    E'      target_id,\n',
    E'      restored_target_id,\n'
  );
  function_definition := replace(
    function_definition,
    'values (source_id, target_id);',
    'values (source_id, restored_target_id);'
  );

  if position('restored_target_id uuid' in function_definition) = 0
     or position(
       E'\n    target_id := gen_random_uuid();'
       in function_definition
     ) > 0
     or position('values (source_id, target_id)' in function_definition) > 0 then
    raise exception
      using
        errcode = 'P0001',
        message = 'No se pudo preparar la corrección de restore_group_backup.';
  end if;

  execute function_definition;
end;
$migration$;

comment on function public.restore_group_backup(uuid, jsonb, text, jsonb) is
  'Restaura respaldos de forma transaccional sin colisiones de variables.';
