import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadReportAssets } from "@/features/reports/report-assets";
import { requestAccessToken, safePdfFileName } from "@/features/reports/report-api";
import {
  loadReportSnapshot,
  ReportDataError,
} from "@/features/reports/report-data";
import { buildReportHtml } from "@/features/reports/report-template";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBearerClient } from "@/lib/supabase/server";
import { isBearerAuthError } from "@/lib/auth/bearer";
import { generatePdfFromHtml } from "@/lib/pdf/chromium";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("scope", [
  z.object({
    enrollmentIds: z.array(z.string().uuid()).length(1),
    scope: z.literal("individual"),
  }),
  z.object({
    enrollmentIds: z.array(z.string().uuid()).min(1).max(200),
    scope: z.literal("seleccion"),
  }),
  z.object({
    scope: z.literal("grupo"),
  }),
]);

function jsonError(
  message: string,
  status: number,
  options: { code?: string; requestId?: string } = {},
) {
  return NextResponse.json(
    {
      error: options.code ?? "REPORT_CARDS_REQUEST_FAILED",
      message,
      requestId: options.requestId,
    },
    { status },
  );
}

function isExternalDependencyError(error: {
  details?: string;
  message?: string;
}) {
  return `${error.message ?? ""} ${error.details ?? ""}`
    .toLowerCase()
    .includes("fetch failed");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const accessToken = requestAccessToken(request);
  const { groupId } = await context.params;
  console.info(
    `[report-cards] start ${JSON.stringify({
      groupId,
      hasAuthorizationHeader: Boolean(accessToken),
      requestId,
    })}`,
  );

  if (!z.string().uuid().safeParse(groupId).success) {
    return jsonError("El identificador del grupo no es válido.", 400, {
      code: "INVALID_GROUP_ID",
      requestId,
    });
  }
  if (!accessToken) {
    return jsonError("La sesión no está disponible.", 401, {
      code: "MISSING_ACCESS_TOKEN",
      requestId,
    });
  }

  const client = createBearerClient(accessToken);
  const groupResult = await client
    .from("academic_groups")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupResult.error) {
    if (isBearerAuthError(groupResult.error)) {
      return jsonError(
        "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
        401,
        { code: "INVALID_ACCESS_TOKEN", requestId },
      );
    }
    console.error(
      `[report-cards] query failed ${JSON.stringify({
        code: groupResult.error.code,
        details: groupResult.error.details,
        durationMs: Date.now() - startedAt,
        groupId,
        hint: groupResult.error.hint,
        message: groupResult.error.message,
        requestId,
        step: "group-access",
      })}`,
    );
    const dependencyFailed = isExternalDependencyError(groupResult.error);
    return jsonError(
      dependencyFailed
        ? "El servidor local no pudo conectarse con Supabase."
        : "Ocurrió un error interno al comprobar el acceso al grupo.",
      dependencyFailed ? 502 : 500,
      {
        code: dependencyFailed
          ? "SUPABASE_UNREACHABLE"
          : "GROUP_ACCESS_CHECK_FAILED",
        requestId,
      },
    );
  }
  if (!groupResult.data) {
    return jsonError("No tienes acceso a este grupo.", 403, {
      code: "GROUP_ACCESS_DENIED",
      requestId,
    });
  }

  const [studentResult, historyResult] = await Promise.all([
    client
      .from("enrollments")
      .select(
        "id, student_id, students!inner(first_names, last_names)",
      )
      .eq("group_id", groupId)
      .eq("status", "activo"),
    client
      .from("report_card_generations")
      .select(
        "id, scope, student_count, file_name, byte_size, content_sha256, created_at",
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (studentResult.error) {
    console.error(
      `[report-cards] query failed ${JSON.stringify({
        code: studentResult.error.code,
        details: studentResult.error.details,
        durationMs: Date.now() - startedAt,
        groupId,
        hint: studentResult.error.hint,
        message: studentResult.error.message,
        requestId,
        step: "students",
      })}`,
    );
    const dependencyFailed = isExternalDependencyError(studentResult.error);
    return jsonError(
      dependencyFailed
        ? "El servidor local no pudo conectarse con Supabase."
        : "Ocurrió un error interno al cargar los alumnos.",
      dependencyFailed ? 502 : 500,
      {
        code: dependencyFailed
          ? "SUPABASE_UNREACHABLE"
          : "STUDENTS_QUERY_FAILED",
        requestId,
      },
    );
  }
  if (historyResult.error) {
    console.error(
      `[report-cards] query failed ${JSON.stringify({
        code: historyResult.error.code,
        details: historyResult.error.details,
        durationMs: Date.now() - startedAt,
        groupId,
        hint: historyResult.error.hint,
        message: historyResult.error.message,
        requestId,
        step: "history",
      })}`,
    );
    const dependencyFailed = isExternalDependencyError(historyResult.error);
    return jsonError(
      dependencyFailed
        ? "El servidor local no pudo conectarse con Supabase."
        : "No se pudo cargar el historial. Verifica la migración de Fase 4.",
      dependencyFailed ? 502 : 500,
      {
        code: dependencyFailed
          ? "SUPABASE_UNREACHABLE"
          : "HISTORY_QUERY_FAILED",
        requestId,
      },
    );
  }

  const students = (studentResult.data ?? [])
    .map((row: Record<string, unknown>) => {
      const student = row.students as {
        first_names: string;
        last_names: string;
      };
      return {
        enrollmentId: String(row.id),
        name: `${student.last_names} ${student.first_names}`
          .replace(/\s+/g, " ")
          .trim(),
        studentId: String(row.student_id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  console.info(
    `[report-cards] complete ${JSON.stringify({
      durationMs: Date.now() - startedAt,
      historyCount: historyResult.data?.length ?? 0,
      requestId,
      studentCount: students.length,
    })}`,
  );
  return NextResponse.json({
    history: historyResult.data ?? [],
    requestId,
    students,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  const accessToken = requestAccessToken(request);
  if (!accessToken) return jsonError("La sesión no es válida.", 401);

  let uploadedPath = "";
  try {
    const { groupId } = await context.params;
    const parsedGroup = z.string().uuid().safeParse(groupId);
    const parsedBody = bodySchema.safeParse(await request.json());
    if (!parsedGroup.success || !parsedBody.success) {
      return jsonError("La selección para el PDF no es válida.", 400);
    }

    const enrollmentIds =
      parsedBody.data.scope === "grupo"
        ? undefined
        : [...new Set(parsedBody.data.enrollmentIds)];
    const [{ snapshot, userId }, assets] = await Promise.all([
      loadReportSnapshot(accessToken, parsedGroup.data, enrollmentIds),
      loadReportAssets(),
    ]);
    const html = buildReportHtml(snapshot, assets);
    const pdf = await generatePdfFromHtml(html);
    const generationId = randomUUID();
    const hash = createHash("sha256").update(pdf).digest("hex");
    const studentSuffix =
      snapshot.cards.length === 1
        ? `-${snapshot.cards[0]?.studentName ?? "alumno"}`
        : `-${snapshot.cards.length}-alumnos`;
    const fileName = `${safePdfFileName(
      `boleta-${snapshot.group.academicYear}${studentSuffix}`,
    )}.pdf`;
    uploadedPath = `${parsedGroup.data}/${snapshot.group.academicYear}/${generationId}.pdf`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("report-cards")
      .upload(uploadedPath, pdf, {
        cacheControl: "31536000",
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) {
      throw new ReportDataError(
        "No se pudo guardar el PDF privado. Verifica la migración de Fase 4.",
        502,
      );
    }

    const { error: recordError } = await admin
      .from("report_card_generations")
      .insert({
        byte_size: pdf.byteLength,
        content_sha256: hash,
        file_name: fileName,
        generated_by: userId,
        group_id: parsedGroup.data,
        id: generationId,
        scope: parsedBody.data.scope,
        snapshot,
        storage_bucket: "report-cards",
        storage_path: uploadedPath,
        student_count: snapshot.cards.length,
      });
    if (recordError) {
      await admin.storage.from("report-cards").remove([uploadedPath]);
      uploadedPath = "";
      throw new ReportDataError(
        "El PDF se creó, pero no se pudo registrar en el historial.",
        502,
      );
    }

    return NextResponse.json({
      createdAt: snapshot.generatedAt,
      fileName,
      generationId,
      pages: snapshot.cards.length,
    });
  } catch (cause) {
    const status = cause instanceof ReportDataError ? cause.status : 500;
    return jsonError(
      cause instanceof Error ? cause.message : "No se pudo generar el PDF.",
      status,
    );
  }
}
