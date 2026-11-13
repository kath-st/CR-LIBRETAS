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
  const { data, error } = await client.rpc("export_group_backup", {
    target_group_id: parsedGroup.data,
  });
  if (error) {
    return backupError(
      error.message || "No se pudo generar el respaldo.",
      error.code === "42501" ? 403 : 500,
    );
  }

  const document = backupDocumentSchema.safeParse(data);
  if (!document.success) {
    console.error("[backup/export] Respaldo generado con forma inválida", {
      issues: document.error.issues,
    });
    return backupError(
      "Supabase devolvió un respaldo incompleto. Verifica la migración de Fase 5.",
      500,
    );
  }

  return jsonDownload(
    document.data,
    backupFileName(
      document.data.payload.group.academic_year,
      document.data.payload.group.display_name,
    ),
  );
}
