import "server-only";

import type { NextRequest } from "next/server";
import { createBearerClient } from "@/lib/supabase/server";

export function requestAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function canAccessGroup(accessToken: string, groupId: string) {
  if (!accessToken) return false;
  const client = createBearerClient(accessToken);
  const { data, error } = await client
    .from("academic_groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();
  return !error && Boolean(data);
}

export function safePdfFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 170);
}
