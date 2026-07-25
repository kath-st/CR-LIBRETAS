import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  backupDocumentSchema,
  backupSummarySchema,
} from "@/features/backups/schema";
import {
  backupAccessToken,
  backupError,
} from "@/features/backups/server";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  backup: backupDocumentSchema,
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = backupAccessToken(request);
  if (!accessToken) return backupError("La sesión no está disponible.", 401);

  const { groupId } = await context.params;
  if (!z.string().uuid().safeParse(groupId).success) {
    return backupError("El identificador del grupo no es válido.", 400);
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return backupError(
      "El archivo no tiene la estructura de un respaldo de CR Libretas.",
      400,
    );
  }

  const client = createBearerClient(accessToken);
  const { data, error } = await client.rpc("validate_group_backup", {
    backup_document: body.data.backup,
  });
  if (error) {
    return backupError(
      error.message || "El respaldo no superó la validación de integridad.",
      error.code === "42501" ? 403 : 400,
    );
  }

  const summary = backupSummarySchema.safeParse(data);
  if (!summary.success) {
    return backupError(
      "No se pudo interpretar el resumen del respaldo.",
      500,
    );
  }
  return NextResponse.json({ summary: summary.data });
}
