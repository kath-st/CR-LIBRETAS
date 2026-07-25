import type { NextRequest } from "next/server";
import { z } from "zod";
import { backupDocumentSchema } from "@/features/backups/schema";
import {
  backupAccessToken,
  backupError,
  backupFileName,
  jsonDownload,
} from "@/features/backups/server";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ backupId: string; groupId: string }> },
) {
  const accessToken = backupAccessToken(request);
  if (!accessToken) return backupError("La sesión no está disponible.", 401);

  const { backupId, groupId } = await context.params;
  if (
    !z.string().uuid().safeParse(groupId).success ||
    !z.string().uuid().safeParse(backupId).success
  ) {
    return backupError("El identificador del respaldo no es válido.", 400);
  }

  const client = createBearerClient(accessToken);
  const { data, error } = await client
    .from("group_backup_history")
    .select("document, created_at")
    .eq("id", backupId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error || !data) {
    return backupError(
      error?.message || "El respaldo no existe o no está disponible.",
      error?.code === "42501" ? 403 : 404,
    );
  }

  const document = backupDocumentSchema.safeParse(data.document);
  if (!document.success) {
    return backupError("El respaldo histórico está incompleto.", 500);
  }
  return jsonDownload(
    document.data,
    backupFileName(
      document.data.payload.group.academic_year,
      document.data.payload.group.display_name,
      "-automatico",
    ),
  );
}
