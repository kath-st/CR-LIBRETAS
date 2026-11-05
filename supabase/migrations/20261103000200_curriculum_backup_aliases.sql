-- Los respaldos nuevos incluyen equivalencias; los antiguos sin ellas siguen siendo válidos.
do $migration$
declare
  builder text;
  restorer text;
begin
  builder := pg_get_functiondef(
    'app_private.build_group_backup_payload(uuid)'::regprocedure
  );
  if position('''name'', areas.name,' in builder) = 0
     or position('''name'', subjects.name,' in builder) = 0 then
    raise exception 'No se encontró la estructura esperada del exportador de respaldos.';
  end if;
  builder := replace(builder,
    '''name'', areas.name,',
    '''name'', areas.name, ''name_aliases'', areas.name_aliases,');
  builder := replace(builder,
    '''name'', subjects.name,',
    '''name'', subjects.name, ''name_aliases'', subjects.name_aliases,');
  execute builder;

  restorer := pg_get_functiondef(
    'public.restore_group_backup(uuid,jsonb,text,jsonb)'::regprocedure
  );
  if position(E'      catalog_area_id,\n      name,\n' in restorer) = 0
     or position(E'      catalog_subject_id,\n      name,\n' in restorer) = 0
     or position('area_data ->> ''name'',' in restorer) = 0
     or position('subject_data ->> ''name'',' in restorer) = 0 then
    raise exception 'No se encontró la estructura esperada del restaurador de respaldos.';
  end if;
  restorer := replace(restorer,
    E'      catalog_area_id,\n      name,\n',
    E'      catalog_area_id,\n      name,\n      name_aliases,\n');
  restorer := replace(restorer,
    E'      catalog_subject_id,\n      name,\n',
    E'      catalog_subject_id,\n      name,\n      name_aliases,\n');
  restorer := replace(restorer,
    'area_data ->> ''name'',',
    E'area_data ->> ''name'',\n      array(select jsonb_array_elements_text(area_data -> ''name_aliases'')),');
  restorer := replace(restorer,
    'subject_data ->> ''name'',',
    E'subject_data ->> ''name'',\n      array(select jsonb_array_elements_text(subject_data -> ''name_aliases'')),');
  execute restorer;
end;
$migration$;
