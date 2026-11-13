-- CR Libretas — Fase 4
-- Historial privado e inmutable de boletas PDF.

create type public.report_card_scope as enum (
  'individual',
  'seleccion',
  'grupo'
);

create table public.report_card_generations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.academic_groups (id),
  scope public.report_card_scope not null,
  student_count smallint not null check (student_count between 1 and 200),
  storage_bucket text not null default 'report-cards'
    check (storage_bucket = 'report-cards'),
  storage_path text not null unique
    check (char_length(storage_path) between 10 and 500),
  file_name text not null
    check (char_length(file_name) between 5 and 180),
  content_sha256 text not null
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  generated_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index report_card_generations_group_created_idx
  on public.report_card_generations (group_id, created_at desc);

create or replace function app_private.prevent_report_card_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    using
      errcode = '55000',
      message = 'Las boletas generadas son inmutables.';
end;
$$;

create trigger report_card_generations_are_immutable
before update or delete on public.report_card_generations
for each row execute function app_private.prevent_report_card_mutation();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'report-cards',
  'report-cards',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app_private.prevent_stored_report_card_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.bucket_id = 'report-cards'
     and exists (
       select 1
       from public.report_card_generations generations
       where generations.storage_bucket = old.bucket_id
         and generations.storage_path = old.name
     ) then
    raise exception
      using
        errcode = '55000',
        message = 'El archivo de una boleta registrada no puede modificarse ni eliminarse.';
  end if;
  return old;
end;
$$;

create trigger stored_report_cards_are_immutable
before update or delete on storage.objects
for each row execute function app_private.prevent_stored_report_card_mutation();

alter table public.report_card_generations enable row level security;

create policy "report_card_generations_select_authorized_group"
on public.report_card_generations
for select
to authenticated
using (app_private.can_access_group(group_id));

revoke all on public.report_card_generations from anon;
revoke all on public.report_card_generations from authenticated;
grant select on public.report_card_generations to authenticated;

revoke all on function app_private.prevent_report_card_mutation() from public;
revoke all on function app_private.prevent_stored_report_card_mutation() from public;

comment on table public.report_card_generations is
  'Registro inmutable del PDF y de la instantánea académica usada para generarlo.';
comment on column public.report_card_generations.snapshot is
  'Fuente histórica de la boleta: nunca se recalcula leyendo el PDF.';
