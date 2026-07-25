-- CR Libretas — Fase 6
-- La regla de retiro se aplica también en PostgreSQL, no solo en la interfaz.

create or replace function app_private.enforce_enrollment_term_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enrollment_record record;
begin
  select
    enrollments.status,
    enrollments.withdrawn_from_term
  into enrollment_record
  from public.enrollments enrollments
  where enrollments.id = new.enrollment_id
    and enrollments.group_id = new.group_id;

  if found
     and enrollment_record.status = 'retirado'
     and enrollment_record.withdrawn_from_term is not null
     and new.term > enrollment_record.withdrawn_from_term then
    raise exception
      using
        errcode = '23514',
        message = 'El alumno no participa después de su bimestre de retiro.';
  end if;

  return new;
end;
$$;

create trigger grades_enforce_enrollment_term
before insert or update on public.grades
for each row execute function app_private.enforce_enrollment_term_participation();

create trigger recommendations_enforce_enrollment_term
before insert or update on public.recommendations
for each row execute function app_private.enforce_enrollment_term_participation();

revoke all on function app_private.enforce_enrollment_term_participation()
  from public;

comment on function app_private.enforce_enrollment_term_participation() is
  'Impide notas y recomendaciones posteriores al bimestre de retiro.';
