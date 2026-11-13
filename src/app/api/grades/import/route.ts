import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  resolveGradeImport,
  type GradeImportPolicy,
  type GradeImportScope,
} from "@/features/imports/grade-import-server";
import { requestAccessToken } from "@/features/reports/report-api";
import { isBearerAuthError } from "@/lib/auth/bearer";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const changeSchema = z
  .object({
    action: z.enum(["clear", "set"]),
    score: z.number().int().min(0).max(20).nullable(),
    term: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .refine(
    (change) =>
      (change.action === "clear" && change.score === null) ||
      (change.action === "set" && change.score !== null),
  );

const rowSchema = z.object({
  academicYear: z.number().int().nullable(),
  area: z.string().max(100),
  changes: z.array(changeSchema).max(4),
  enrollmentId: z.string().max(60),
  firstNames: z.string().max(100),
  grade: z.number().int().nullable(),
  groupId: z.string().max(60),
  groupName: z.string().max(120),
  key: z.string().min(1).max(200),
  lastNames: z.string().max(120),
  level: z.string().max(30),
  parseErrors: z.array(z.string().max(200)).max(8),
  rowNumber: z.number().int().min(2).max(100_000),
  section: z.string().max(30),
  sheet: z.string().min(1).max(100),
  subject: z.string().max(100),
  subjectId: z.string().max(60),
});

const bodySchema = z.object({
  createMissingStudents: z.boolean(),
  currentGroupId: z.string().uuid().optional(),
  mode: z.enum(["commit", "preview"]),
  policy: z.enum(["fill_empty", "replace_terms", "update"]),
  rows: z.array(rowSchema).min(1).max(10_000),
  scope: z.enum(["current", "multiple"]),
});

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: "GRADE_IMPORT_FAILED", message },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  if (!accessToken) return errorResponse("La sesión no está disponible.", 401);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return errorResponse("El archivo contiene filas con un formato inválido.", 400);
  }
  if (body.data.scope === "current" && !body.data.currentGroupId) {
    return errorResponse("Selecciona el grupo que recibirá las notas.", 400);
  }

  const client = createBearerClient(accessToken);
  try {
    const preview = await resolveGradeImport(client, {
      createMissingStudents: body.data.createMissingStudents,
      currentGroupId: body.data.currentGroupId,
      policy: body.data.policy as GradeImportPolicy,
      rows: body.data.rows,
      scope: body.data.scope as GradeImportScope,
    });

    if (body.data.mode === "preview") {
      return NextResponse.json({ rows: preview.rows, summary: preview.summary });
    }
    if (preview.summary.errors) {
      return errorResponse(
        `La selección contiene ${preview.summary.errors} fila(s) con error. Actualiza la vista previa.`,
        400,
      );
    }

    const { data, error } = await client.rpc("import_grades", {
      import_document: preview.document,
      import_policy: body.data.policy,
    });
    if (error) {
      return errorResponse(
        error.message || "No se pudo aplicar la importación.",
        error.code === "42501" || isBearerAuthError(error) ? 403 : 400,
      );
    }
    return NextResponse.json({ result: data, summary: preview.summary });
  } catch (cause) {
    console.error("[grades/import] No se pudo procesar la importación", cause);
    return errorResponse(
      cause instanceof Error ? cause.message : "No se pudo procesar la importación.",
      400,
    );
  }
}
