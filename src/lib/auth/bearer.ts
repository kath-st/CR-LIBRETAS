import "server-only";

import { Buffer } from "node:buffer";

type SupabaseQueryError = {
  code?: string;
  message?: string;
};

export function bearerSubject(accessToken: string) {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return "";
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof claims.sub === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        claims.sub,
      )
      ? claims.sub
      : "";
  } catch {
    return "";
  }
}

export function isBearerAuthError(error: SupabaseQueryError | null) {
  const description = `${error?.code ?? ""} ${error?.message ?? ""}`
    .toLowerCase()
    .trim();
  return (
    description.includes("jwt") ||
    description.includes("token") ||
    description.includes("pgrst301")
  );
}
