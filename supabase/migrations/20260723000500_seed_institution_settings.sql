-- CR Libretas — Datos institucionales requeridos por las boletas.
-- La migración solo crea la fila ausente y conserva cualquier personalización.

insert into public.institution_settings (
  id,
  name,
  address,
  motto,
  official_year_name
)
values (
  1,
  'I.E.P. Cristo Redentor de Nocheto',
  'MZ J – LT 8 PSJ Rasuñiti, Santa Anita',
  'Dios, amor, disciplina',
  'Año de la recuperación y consolidación de la economía peruana'
)
on conflict (id) do nothing;
