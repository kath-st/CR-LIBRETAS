import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { publicKey, url } = getSupabaseConfig();
  return createBrowserClient(url, publicKey);
}
