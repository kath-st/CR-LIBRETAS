import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

type BrowserClient = ReturnType<typeof createBrowserClient>;
let browserClient: BrowserClient | null = null;

export function createClient() {
  if (browserClient) return browserClient;

  const { publicKey, url } = getSupabaseConfig();
  browserClient = createBrowserClient(url, publicKey);
  return browserClient;
}
