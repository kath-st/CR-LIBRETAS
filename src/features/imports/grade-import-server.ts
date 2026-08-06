import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeImportText,
  type GradeImportChange,
  type ParsedGradeImportRow,
} from "./grade-import";

export type GradeImportPolicy = "fill_empty" | "replace_terms" | "update";
export type GradeImportScope = "current" | "multiple";

type AcademicGroup = {
  academic_year: number;
  display_name: string;
  grade: number;
  id: string;
  level: "primaria" | "secundaria";
  section: string;
};

type Enrollment = {
  group_id: string;
  id: string;
  status: "activo" | "retirado";
  withdrawn_from_term: number | null;
  students: { first_names: string; last_names: string };
};

type Subject = {
  active: boolean;
  group_id: string;
  id: string;
  name: string;
  group_areas: { active: boolean; name: string };
};

type StoredGrade = {
  enrollment_id: string;
  group_id: string;
  group_subject_id: string;
  score: number | null;
  term: number;
};

export type GradeImportPreviewRow = {
  changes: string;
  error: string;
  group: string;
  key: string;
  newStudent: boolean;
  overwriteCount: number;
  rowNumber: number;
  sheet: string;
  skippedCount: number;
  student: string;
  subject: string;
  warning: string;
};

export type GradeImportPreview = {
  document: {
    grades: Array<{
      action: GradeImportChange["action"];
      enrollment_id: string | null;
      first_names: string;
      group_id: string;
      group_subject_id: string;
      last_names: string;
      score: number | null;
      student_key: string;
      term: number;
    }>;
  };
  rows: GradeImportPreviewRow[];
  summary: {
    clears: number;
    errors: number;
    gradeChanges: number;
    groups: number;
    newStudents: number;
    overwrites: number;
    rows: number;
    skipped: number;
    valid: number;
  };
};

function personKey(firstNames: string, lastNames: string) {
  return normalizeImportText(`${lastNames} ${firstNames}`);
}

function groupCompositeKey(
  academicYear: number,
  level: string,
  grade: number,
  section: string,
) {
  return `${academicYear}:${normalizeImportText(level)}:${grade}:${normalizeImportText(section)}`;
}

function gradeCellKey(enrollmentOrStudentKey: string, subjectId: string, term: number) {
  return `${enrollmentOrStudentKey}:${subjectId}:${term}`;
}

function groupForRow(
  row: ParsedGradeImportRow,
  scope: GradeImportScope,
  currentGroup: AcademicGroup | undefined,
  groups: AcademicGroup[],
) {
  if (scope === "current") return currentGroup;
  if (row.groupId) return groups.find((group) => group.id === row.groupId);
  if (row.groupName) {
    const matches = groups.filter(
      (group) => normalizeImportText(group.display_name) === normalizeImportText(row.groupName),
    );
    return matches.length === 1 ? matches[0] : undefined;
  }
  if (row.academicYear && row.level && row.grade && row.section) {
    const key = groupCompositeKey(
      row.academicYear,
      row.level,
      row.grade,
      row.section,
    );
    return groups.find(
      (group) =>
        groupCompositeKey(
          group.academic_year,
          group.level,
          group.grade,
          group.section,
        ) === key,
    );
  }
  return undefined;
}

async function loadStoredGrades(client: SupabaseClient, groupIds: string[]) {
  const rows: StoredGrade[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const result = await client
      .from("grades")
      .select("group_id, enrollment_id, group_subject_id, term, score")
      .in("group_id", groupIds)
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as StoredGrade[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export async function resolveGradeImport(
  client: SupabaseClient,
  input: {
    createMissingStudents: boolean;
    currentGroupId?: string;
    policy: GradeImportPolicy;
    rows: ParsedGradeImportRow[];
    scope: GradeImportScope;
  },
): Promise<GradeImportPreview> {
  const groupResult = await client
    .from("academic_groups")
    .select("id, academic_year, level, grade, section, display_name")
    .eq("active", true)
    .order("academic_year")
    .order("level")
    .order("grade");
  if (groupResult.error) throw new Error(groupResult.error.message);
  const groups = (groupResult.data ?? []) as AcademicGroup[];
  const currentGroup = groups.find((group) => group.id === input.currentGroupId);
  if (input.scope === "current" && !currentGroup) {
    throw new Error("No tienes acceso al grupo seleccionado.");
  }
  if (!groups.length) throw new Error("No tienes grupos activos disponibles.");

  const groupIds = groups.map((group) => group.id);
  const [enrollmentResult, subjectResult, grades] = await Promise.all([
    client
      .from("enrollments")
      .select(
        "id, group_id, status, withdrawn_from_term, students!inner(first_names, last_names)",
      )
      .in("group_id", groupIds),
    client
      .from("group_subjects")
      .select("id, group_id, name, active, group_areas!inner(name, active)")
      .in("group_id", groupIds),
    loadStoredGrades(client, groupIds),
  ]);
  const queryError = enrollmentResult.error ?? subjectResult.error;
  if (queryError) throw new Error(queryError.message);
  const enrollments = (enrollmentResult.data ?? []) as unknown as Enrollment[];
  const subjects = (subjectResult.data ?? []) as unknown as Subject[];
  const storedGrades = new Map(
    grades.map((grade) => [
      gradeCellKey(grade.enrollment_id, grade.group_subject_id, grade.term),
      grade.score,
    ]),
  );

  const previews: GradeImportPreviewRow[] = [];
  const documentGrades: GradeImportPreview["document"]["grades"] = [];
  const usedCells = new Map<string, number>();
  const resolvedGroups = new Set<string>();
  const newStudents = new Set<string>();
  let clears = 0;
  let overwrites = 0;
  let skipped = 0;

  for (const source of input.rows) {
    const errors = [...source.parseErrors];
    const warnings: string[] = [];
    const group = groupForRow(source, input.scope, currentGroup, groups);
    if (!group) {
      errors.push(
        input.scope === "multiple"
          ? "No se pudo identificar un grupo autorizado. Usa grupo_id, grupo o año/nivel/grado/sección."
          : "No se pudo abrir el grupo seleccionado.",
      );
    }

    let enrollment: Enrollment | undefined;
    let studentKey = "";
    let newStudent = false;
    if (group) {
      const groupEnrollments = enrollments.filter(
        (item) => item.group_id === group.id,
      );
      if (source.enrollmentId) {
        enrollment = groupEnrollments.find(
          (item) => item.id === source.enrollmentId,
        );
        if (!enrollment) errors.push("La matrícula no pertenece al grupo indicado.");
      } else {
        const key = personKey(source.firstNames, source.lastNames);
        const matches = groupEnrollments.filter(
          (item) =>
            personKey(item.students.first_names, item.students.last_names) === key,
        );
        if (matches.length > 1) {
          errors.push("Hay más de un alumno con ese nombre; usa una plantilla con matricula_id.");
        } else if (matches.length === 1) {
          enrollment = matches[0];
        } else if (input.createMissingStudents && !source.parseErrors.length) {
          newStudent = true;
          studentKey = `${group.id}:${key}`;
          newStudents.add(studentKey);
        } else {
          errors.push("El alumno no está matriculado en el grupo.");
        }
      }
      if (enrollment) studentKey = enrollment.id;
    }

    let subject: Subject | undefined;
    if (group) {
      const groupSubjects = subjects.filter((item) => item.group_id === group.id);
      if (source.subjectId) {
        subject = groupSubjects.find((item) => item.id === source.subjectId);
        if (!subject) errors.push("La asignatura no pertenece al grupo indicado.");
      } else {
        let matches = groupSubjects.filter(
          (item) => normalizeImportText(item.name) === normalizeImportText(source.subject),
        );
        if (source.area) {
          matches = matches.filter(
            (item) =>
              normalizeImportText(item.group_areas.name) === normalizeImportText(source.area),
          );
        }
        if (matches.length > 1) {
          errors.push("La asignatura es ambigua; agrega el área o usa asignatura_id.");
        } else if (!matches.length) {
          errors.push("La asignatura no existe en la malla del grupo.");
        } else {
          subject = matches[0];
        }
      }
      if (subject && (!subject.active || !subject.group_areas.active)) {
        errors.push("La asignatura o su área está desactivada.");
      }
    }

    let overwriteCount = 0;
    let skippedCount = 0;
    if (group && subject && studentKey) {
      for (const change of source.changes) {
        if (
          enrollment?.status === "retirado" &&
          enrollment.withdrawn_from_term &&
          change.term > enrollment.withdrawn_from_term
        ) {
          errors.push(
            `No se puede registrar ${change.term}B después del bimestre de retiro.`,
          );
        }
        const cell = gradeCellKey(studentKey, subject.id, change.term);
        const previousIndex = usedCells.get(cell);
        if (previousIndex !== undefined) {
          errors.push("La misma celda de nota aparece más de una vez en el archivo.");
          const previous = previews[previousIndex];
          if (previous && !previous.error) {
            previous.error = "La misma celda de nota aparece más de una vez en el archivo.";
          }
        } else {
          usedCells.set(cell, previews.length);
        }

        const existing = enrollment
          ? storedGrades.get(gradeCellKey(enrollment.id, subject.id, change.term))
          : undefined;
        if (change.action === "clear") clears += 1;
        if (
          input.policy === "fill_empty" &&
          change.action === "set" &&
          existing !== undefined &&
          existing !== null
        ) {
          skippedCount += 1;
          skipped += 1;
        } else if (
          enrollment &&
          existing !== undefined &&
          existing !== null &&
          existing !== change.score
        ) {
          overwriteCount += 1;
          overwrites += 1;
        }

        documentGrades.push({
          action: change.action,
          enrollment_id: enrollment?.id ?? null,
          first_names: source.firstNames,
          group_id: group.id,
          group_subject_id: subject.id,
          last_names: source.lastNames,
          score: change.score,
          student_key: studentKey,
          term: change.term,
        });
      }
      resolvedGroups.add(group.id);
    }
    if (newStudent) warnings.push("Se creará y matriculará este alumno.");
    if (overwriteCount) warnings.push(`${overwriteCount} nota(s) existente(s) cambiarán.`);
    if (skippedCount) warnings.push(`${skippedCount} nota(s) ocupada(s) se conservarán.`);

    previews.push({
      changes: source.changes
        .map((change) =>
          `${change.term}B: ${change.action === "clear" ? "BORRAR" : change.score}`,
        )
        .join(" · "),
      error: errors.join(" "),
      group: group?.display_name ?? (source.groupName || "Sin identificar"),
      key: source.key,
      newStudent,
      overwriteCount,
      rowNumber: source.rowNumber,
      sheet: source.sheet,
      skippedCount,
      student: enrollment
        ? `${enrollment.students.last_names}, ${enrollment.students.first_names}`
        : `${source.lastNames}, ${source.firstNames}`,
      subject: subject
        ? `${subject.group_areas.name} · ${subject.name}`
        : source.subject || "Sin identificar",
      warning: warnings.join(" "),
    });
  }

  const errorCount = previews.filter((row) => row.error).length;
  return {
    document: { grades: documentGrades },
    rows: previews,
    summary: {
      clears,
      errors: errorCount,
      gradeChanges: documentGrades.length,
      groups: resolvedGroups.size,
      newStudents: newStudents.size,
      overwrites,
      rows: previews.length,
      skipped,
      valid: previews.length - errorCount,
    },
  };
}
