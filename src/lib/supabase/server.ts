import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

type NetworkCause = {
  address?: unknown;
  cause?: unknown;
  code?: unknown;
  errno?: unknown;
  errors?: unknown;
  hostname?: unknown;
  message?: unknown;
  name?: unknown;
  port?: unknown;
  syscall?: unknown;
};

function safeNetworkCause(value: unknown): Record<string, unknown> | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return null;
  }

  const cause = value as NetworkCause;
  const details: Record<string, unknown> = {};
  for (const key of [
    "name",
    "message",
    "code",
    "errno",
    "syscall",
    "hostname",
    "address",
    "port",
  ] as const) {
    const entry = cause[key];
    if (typeof entry === "string" || typeof entry === "number") {
      details[key] = entry;
    }
  }
  if (Array.isArray(cause.errors)) {
    details.errors = cause.errors
      .map(safeNetworkCause)
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  }
  const nested = safeNetworkCause(cause.cause);
  if (nested) details.cause = nested;
  return details;
}

export function createBearerClient(accessToken: string) {
  const { publicKey, url } = getSupabaseConfig();

  return createSupabaseClient(url, publicKey, {
    accessToken: async () => accessToken,
    global: {
      fetch: async (input, init) => {
        try {
          return await fetch(input, init);
        } catch (cause) {
          const target =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          console.error(
            `[supabase/server] fetch failed ${JSON.stringify({
              cause: safeNetworkCause(cause),
              hostname: new URL(target).hostname,
            })}`,
          );
          throw cause;
        }
      },
    },
  });
}
