import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  backupAccessToken,
  backupError,
} from "@/features/backups/server";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = backupAccessToken(request);
  if (!accessToken) return backupError("La sesión no está disponible.", 401);

  const { groupId } = await context.params;
  const parsedGroup = z.string().uuid().safeParse(groupId);
  if (!parsedGroup.success) {
    return backupError("El identificador del grupo no es válido.", 400);
  }

  const client = createBearerClient(accessToken);
  const { data, error } = await client
    .from("group_backup_history")
    .select("id, reason, payload_sha256, created_at")
    .eq("group_id", parsedGroup.data)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return backupError(
      error.message || "No se pudo cargar el historial de respaldos.",
      error.code === "42501" ? 403 : 500,
    );
  }
  return NextResponse.json({ history: data ?? [] });
}
