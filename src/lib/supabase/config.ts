const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseConfig() {
  if (!url || !publicKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y la clave pública de Supabase en .env.local.",
    );
  }

  return { publicKey, url };
}

export function hasSupabaseConfig() {
  return Boolean(url && publicKey);
}
