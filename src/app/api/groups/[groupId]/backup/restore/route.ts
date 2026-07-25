import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { backupDocumentSchema } from "@/features/backups/schema";
import {
  backupAccessToken,
  backupError,
} from "@/features/backups/server";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sameGroupSchema = z.object({
  backup: backupDocumentSchema,
  confirmation: z.literal("RESTAURAR"),
  mode: z.literal("mismo"),
});

const newGroupSchema = z.object({
  backup: backupDocumentSchema,
  confirmation: z.literal("CREAR COPIA"),
  mode: z.literal("nuevo"),
  newGroup: z.object({
    academicYear: z.number().int().min(2020).max(2100),
    displayName: z.string().trim().min(3).max(120),
    grade: z.number().int().min(1).max(6),
    level: z.enum(["inicial", "primaria", "secundaria"]),
    section: z.string().trim().min(1).max(30),
  }),
});

const bodySchema = z.discriminatedUnion("mode", [
  sameGroupSchema,
  newGroupSchema,
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = backupAccessToken(request);
  if (!accessToken) return backupError("La sesión no está disponible.", 401);

  const { groupId } = await context.params;
  const parsedGroup = z.string().uuid().safeParse(groupId);
  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedGroup.success || !parsedBody.success) {
    return backupError(
      "La confirmación o los datos de restauración no son válidos.",
      400,
    );
  }

  const newGroup =
    parsedBody.data.mode === "nuevo"
      ? {
          academic_year: parsedBody.data.newGroup.academicYear,
          display_name: parsedBody.data.newGroup.displayName,
          grade: parsedBody.data.newGroup.grade,
          level: parsedBody.data.newGroup.level,
          section: parsedBody.data.newGroup.section,
        }
      : null;

  const client = createBearerClient(accessToken);
  const { data, error } = await client.rpc("restore_group_backup", {
    backup_document: parsedBody.data.backup,
    new_group: newGroup,
    restore_mode: parsedBody.data.mode,
    target_group_id: parsedGroup.data,
  });
  if (error) {
    return backupError(
      error.message || "No se pudo restaurar el respaldo.",
      error.code === "42501" ? 403 : 400,
    );
  }

  return NextResponse.json(data);
}
