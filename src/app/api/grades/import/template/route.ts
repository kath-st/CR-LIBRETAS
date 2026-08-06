import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requestAccessToken, safePdfFileName } from "@/features/reports/report-api";
import { createBearerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Group = {
  academic_year: number;
  display_name: string;
  grade: number;
  id: string;
  level: string;
  section: string;
};

type Enrollment = {
  group_id: string;
  id: string;
  students: { first_names: string; last_names: string };
};

type Subject = {
  group_area_id: string;
  group_id: string;
  id: string;
  name: string;
};

type Area = { group_id: string; id: string; name: string };
type Grade = {
  enrollment_id: string;
  group_subject_id: string;
  score: number | null;
  term: number;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: "GRADE_TEMPLATE_FAILED", message },
    { status },
  );
}

function cellKey(enrollmentId: string, subjectId: string, term: number) {
  return `${enrollmentId}:${subjectId}:${term}`;
}

async function loadGrades(
  client: ReturnType<typeof createBearerClient>,
  groupIds: string[],
) {
  const rows: Grade[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client
      .from("grades")
      .select("enrollment_id, group_subject_id, term, score")
      .in("group_id", groupIds)
      .range(offset, offset + 999);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as Grade[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const accessToken = requestAccessToken(request);
  if (!accessToken) return errorResponse("La sesión no está disponible.", 401);
  const groupId = request.nextUrl.searchParams.get("groupId") ?? "";
  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "current";
  if (scope === "current" && !groupId) {
    return errorResponse("Selecciona un grupo para generar la plantilla.", 400);
  }

  const client = createBearerClient(accessToken);
  try {
    let groupQuery = client
      .from("academic_groups")
      .select("id, academic_year, level, grade, section, display_name")
      .eq("active", true)
      .order("academic_year")
      .order("level")
      .order("grade");
    if (scope === "current") groupQuery = groupQuery.eq("id", groupId);
    const groupResult = await groupQuery;
    if (groupResult.error) throw new Error(groupResult.error.message);
    const groups = (groupResult.data ?? []) as Group[];
    if (!groups.length) {
      return errorResponse("No hay grupos autorizados para crear la plantilla.", 404);
    }

    const groupIds = groups.map((group) => group.id);
    const [enrollmentResult, areaResult, subjectResult, grades] =
      await Promise.all([
        client
          .from("enrollments")
          .select("id, group_id, students!inner(first_names, last_names)")
          .in("group_id", groupIds)
          .eq("status", "activo"),
        client
          .from("group_areas")
          .select("id, group_id, name")
          .in("group_id", groupIds)
          .eq("active", true),
        client
          .from("group_subjects")
          .select("id, group_id, group_area_id, name")
          .in("group_id", groupIds)
          .eq("active", true),
        loadGrades(client, groupIds),
      ]);
    const queryError =
      enrollmentResult.error ?? areaResult.error ?? subjectResult.error;
    if (queryError) throw new Error(queryError.message);

    const enrollments = (enrollmentResult.data ?? []) as unknown as Enrollment[];
    const areas = (areaResult.data ?? []) as Area[];
    const subjects = (subjectResult.data ?? []) as Subject[];
    const areaById = new Map(areas.map((area) => [area.id, area]));
    const gradeByCell = new Map(
      grades.map((grade) => [
        cellKey(grade.enrollment_id, grade.group_subject_id, grade.term),
        grade.score,
      ]),
    );
    const rows = groups.flatMap((group) => {
      const groupEnrollments = enrollments
        .filter((enrollment) => enrollment.group_id === group.id)
        .sort((a, b) =>
          `${a.students.last_names} ${a.students.first_names}`.localeCompare(
            `${b.students.last_names} ${b.students.first_names}`,
            "es",
          ),
        );
      const groupSubjects = subjects.filter(
        (subject) =>
          subject.group_id === group.id && areaById.has(subject.group_area_id),
      );
      return groupEnrollments.flatMap((enrollment) =>
        groupSubjects.map((subject) => ({
          anio: group.academic_year,
          nivel: group.level,
          grado: group.grade,
          seccion: group.section,
          grupo: group.display_name,
          apellidos: enrollment.students.last_names,
          nombres: enrollment.students.first_names,
          area: areaById.get(subject.group_area_id)?.name ?? "",
          asignatura: subject.name,
          "1B": gradeByCell.get(cellKey(enrollment.id, subject.id, 1)) ?? "",
          "2B": gradeByCell.get(cellKey(enrollment.id, subject.id, 2)) ?? "",
          "3B": gradeByCell.get(cellKey(enrollment.id, subject.id, 3)) ?? "",
          "4B": gradeByCell.get(cellKey(enrollment.id, subject.id, 4)) ?? "",
          grupo_id: group.id,
          matricula_id: enrollment.id,
          asignatura_id: subject.id,
        })),
      );
    });
    if (!rows.length) {
      return errorResponse(
        "Los grupos necesitan alumnos y asignaturas activas antes de crear la plantilla.",
        400,
      );
    }

    const workbook = XLSX.utils.book_new();
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Plantilla de importación de notas — CR Libretas"],
      ["Cada fila corresponde a una asignatura de un alumno."],
      ["Usa enteros de 0 a 20. Deja una celda vacía para no modificarla."],
      ["Escribe BORRAR para limpiar una nota existente de forma explícita."],
      ["No cambies las columnas grupo_id, matricula_id ni asignatura_id."],
      ["Puedes conservar en un mismo archivo todos los grupos autorizados."],
    ]);
    instructionSheet["!cols"] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instrucciones");
    const gradeSheet = XLSX.utils.json_to_sheet(rows);
    gradeSheet["!cols"] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
      { wch: 34 },
      { wch: 24 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 6 },
      { wch: 38 },
      { wch: 38 },
      { wch: 38 },
    ];
    gradeSheet["!autofilter"] = { ref: gradeSheet["!ref"] ?? "A1:P1" };
    XLSX.utils.book_append_sheet(workbook, gradeSheet, "Notas");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const suffix =
      scope === "current" ? groups[0]?.display_name ?? "grupo" : "varios-grupos";
    const fileName = `${safePdfFileName(`plantilla-notas-${suffix}`)}.xlsx`;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("[grades/import/template] No se pudo crear la plantilla", cause);
    return errorResponse(
      cause instanceof Error ? cause.message : "No se pudo crear la plantilla.",
      500,
    );
  }
}
