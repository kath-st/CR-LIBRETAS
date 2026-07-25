import "server-only";

import {
  calculateStudentResult,
  calculateTermAverage,
  denseRanks,
  visibleInteger,
  type StudentGrade,
} from "@/domain/academic/calculations";
import { bearerSubject, isBearerAuthError } from "@/lib/auth/bearer";
import { createBearerClient } from "@/lib/supabase/server";
import {
  REPORT_TERMS,
  type ReportBatchSnapshot,
  type ReportCard,
  type ReportTerm,
} from "./types";

type GroupRow = {
  academic_year: number;
  grade: number;
  id: string;
  level: "inicial" | "primaria" | "secundaria";
  section: string;
  teacher_id: string;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  students: { first_names: string; last_names: string };
};

type AreaRow = {
  id: string;
  included_in_final: boolean;
  is_direct: boolean;
  name: string;
  position: number;
};

type SubjectRow = {
  group_area_id: string;
  id: string;
  name: string;
  position: number;
};

type GradeRow = {
  enrollment_id: string;
  group_subject_id: string;
  score: number | null;
  term: ReportTerm;
};

type RecommendationRow = {
  enrollment_id: string;
  term: ReportTerm;
  text: string;
};

export class ReportDataError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function studentName(enrollment: EnrollmentRow) {
  return `${enrollment.students.last_names} ${enrollment.students.first_names}`
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("es");
}

function errorMessage(
  label: string,
  result: { error: { message: string } | null },
) {
  return result.error ? `${label}: ${result.error.message}` : "";
}

export async function loadReportSnapshot(
  accessToken: string,
  groupId: string,
  requestedEnrollmentIds?: readonly string[],
) {
  const supabase = createBearerClient(accessToken);
  const userId = bearerSubject(accessToken);
  if (!userId) {
    throw new ReportDataError("La sesión expiró. Vuelve a iniciar sesión.", 401);
  }
  const groupResult = await supabase
    .from("academic_groups")
    .select("id, academic_year, level, grade, section, teacher_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupResult.error) {
    if (isBearerAuthError(groupResult.error)) {
      throw new ReportDataError(
        "La sesión expiró. Vuelve a iniciar sesión.",
        401,
      );
    }
    throw new ReportDataError(
      "No se pudo comprobar el acceso al grupo. Inténtalo nuevamente.",
      502,
    );
  }
  if (!groupResult.data) {
    throw new ReportDataError(
      "No tienes acceso a este grupo o el grupo no existe.",
      403,
    );
  }

  const group = groupResult.data as GroupRow;
  const [
    institutionResult,
    teacherResult,
    enrollmentResult,
    areaResult,
    subjectResult,
    gradeResult,
    recommendationResult,
  ] = await Promise.all([
    supabase
      .from("institution_settings")
      .select("name, address, motto, official_year_name")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("nombres, apellidos")
      .eq("id", group.teacher_id)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select(
        "id, student_id, students!inner(first_names, last_names)",
      )
      .eq("group_id", groupId)
      .eq("status", "activo"),
    supabase
      .from("group_areas")
      .select(
        "id, name, position, included_in_final, is_direct",
      )
      .eq("group_id", groupId)
      .eq("active", true)
      .order("position"),
    supabase
      .from("group_subjects")
      .select("id, group_area_id, name, position")
      .eq("group_id", groupId)
      .eq("active", true)
      .order("position"),
    supabase
      .from("grades")
      .select("enrollment_id, group_subject_id, term, score")
      .eq("group_id", groupId),
    supabase
      .from("recommendations")
      .select("enrollment_id, term, text")
      .eq("group_id", groupId),
  ]);

  const firstError = [
    errorMessage("Institución", institutionResult),
    errorMessage("Docente", teacherResult),
    errorMessage("Matrículas", enrollmentResult),
    errorMessage("Áreas", areaResult),
    errorMessage("Asignaturas", subjectResult),
    errorMessage("Notas", gradeResult),
    errorMessage("Recomendaciones", recommendationResult),
  ].find(Boolean);
  if (firstError) throw new ReportDataError(firstError, 502);
  if (!institutionResult.data) {
    throw new ReportDataError(
      "Falta la configuración institucional. Aplica la migración de datos institucionales.",
      422,
    );
  }
  if (!teacherResult.data) {
    throw new ReportDataError(
      "No se encontró el perfil de la docente responsable del grupo.",
      422,
    );
  }

  const enrollments = ((enrollmentResult.data ?? []) as unknown as EnrollmentRow[])
    .sort((a, b) => studentName(a).localeCompare(studentName(b), "es"));
  const areas = (areaResult.data ?? []) as AreaRow[];
  const subjects = (subjectResult.data ?? []) as SubjectRow[];
  const grades = (gradeResult.data ?? []) as GradeRow[];
  const recommendations =
    (recommendationResult.data ?? []) as RecommendationRow[];

  if (!enrollments.length) {
    throw new ReportDataError(
      "El grupo no tiene alumnos activos para generar boletas.",
      422,
    );
  }
  if (!areas.length || !subjects.length) {
    throw new ReportDataError(
      "Activa al menos un área y una asignatura en la malla.",
      422,
    );
  }

  const requested = requestedEnrollmentIds?.length
    ? new Set(requestedEnrollmentIds)
    : null;
  const selected = requested
    ? enrollments.filter((enrollment) => requested.has(enrollment.id))
    : enrollments;
  if (!selected.length || (requested && selected.length !== requested.size)) {
    throw new ReportDataError(
      "La selección contiene una matrícula inactiva o ajena al grupo.",
      422,
    );
  }

  const calculationAreas = areas.map((area) => ({
    active: true,
    id: area.id,
    includedInFinal: area.included_in_final,
  }));
  const calculationSubjects = subjects.map((subject) => ({
    active: true,
    areaId: subject.group_area_id,
    id: subject.id,
  }));
  const gradesByEnrollment = new Map<string, StudentGrade[]>();
  for (const enrollment of enrollments) gradesByEnrollment.set(enrollment.id, []);
  for (const grade of grades) {
    gradesByEnrollment.get(grade.enrollment_id)?.push({
      score: grade.score,
      subjectId: grade.group_subject_id,
      term: grade.term,
    });
  }

  const results = new Map(
    enrollments.map((enrollment) => [
      enrollment.id,
      calculateStudentResult(
        calculationAreas,
        calculationSubjects,
        gradesByEnrollment.get(enrollment.id) ?? [],
      ),
    ]),
  );
  const termAverages = new Map<
    string,
    [number | null, number | null, number | null, number | null]
  >(
    enrollments.map((enrollment) => [
      enrollment.id,
      REPORT_TERMS.map((term) =>
        calculateTermAverage(
          term,
          calculationAreas,
          calculationSubjects,
          gradesByEnrollment.get(enrollment.id) ?? [],
        ),
      ) as [number | null, number | null, number | null, number | null],
    ]),
  );
  const ranks = REPORT_TERMS.map((term, index) =>
    denseRanks(
      enrollments.flatMap((enrollment) => {
        const score = termAverages.get(enrollment.id)?.[index] ?? null;
        return score === null ? [] : [{ id: enrollment.id, score }];
      }),
    ),
  );

  const cards: ReportCard[] = selected.map((enrollment) => {
    const result = results.get(enrollment.id);
    if (!result) throw new ReportDataError("No se pudo calcular la boleta.", 500);
    const recommendation =
      recommendations
        .filter(
          (row) =>
            row.enrollment_id === enrollment.id && row.text.trim().length > 0,
        )
        .sort((a, b) => b.term - a.term)[0]?.text.trim() ?? "";

    return {
      areas: areas.map((area) => ({
        average: visibleInteger(result.areaAverages[area.id] ?? null),
        id: area.id,
        isDirect: area.is_direct,
        name: area.name,
        subjects: subjects
          .filter((subject) => subject.group_area_id === area.id)
          .map((subject) => ({
            average: visibleInteger(
              result.subjectAverages[subject.id] ?? null,
            ),
            grades: REPORT_TERMS.map(
              (term) =>
                grades.find(
                  (grade) =>
                    grade.enrollment_id === enrollment.id &&
                    grade.group_subject_id === subject.id &&
                    grade.term === term,
                )?.score ?? null,
            ) as [number | null, number | null, number | null, number | null],
            id: subject.id,
            name: subject.name,
          })),
      })),
      enrollmentId: enrollment.id,
      finalAverage: result.finalVisible,
      recommendation,
      studentId: enrollment.student_id,
      studentName: studentName(enrollment),
      termRanks: REPORT_TERMS.map(
        (_, index) => ranks[index]?.[enrollment.id] ?? null,
      ) as [number | null, number | null, number | null, number | null],
    };
  });

  const snapshot: ReportBatchSnapshot = {
    cards,
    generatedAt: new Date().toISOString(),
    group: {
      academicYear: group.academic_year,
      grade: group.grade,
      id: group.id,
      level: group.level,
      section: group.section,
      teacherName:
        `${teacherResult.data.nombres} ${teacherResult.data.apellidos}`
          .replace(/\s+/g, " ")
          .trim()
          .toLocaleUpperCase("es"),
    },
    institution: {
      address: institutionResult.data.address,
      motto: institutionResult.data.motto,
      name: institutionResult.data.name,
      officialYearName: institutionResult.data.official_year_name,
    },
    version: 1,
  };

  return { snapshot, userId };
}
