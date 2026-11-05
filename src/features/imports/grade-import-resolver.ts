import { normalizeImportText, type ParsedGradeImportRow } from "./grade-import.ts";

export type NamedImportSubject = {
  id: string;
  name: string;
  name_aliases: string[];
  group_areas: {
    name: string;
    name_aliases: string[];
  };
};

export function importRowMatchesGroup(
  row: Pick<ParsedGradeImportRow,
    "groupId" | "groupName" | "academicYear" | "level" | "grade" | "section">,
  group: {
    id: string;
    display_name: string;
    academic_year: number;
    level: string;
    grade: number;
    section: string;
  },
) {
  return !(
    (row.groupId && row.groupId !== group.id) ||
    (row.groupName && normalizeImportText(row.groupName) !== normalizeImportText(group.display_name)) ||
    (row.academicYear && row.academicYear !== group.academic_year) ||
    (row.level && normalizeImportText(row.level) !== normalizeImportText(group.level)) ||
    (row.grade && row.grade !== group.grade) ||
    (row.section && normalizeImportText(row.section) !== normalizeImportText(group.section))
  );
}

function matchesName(current: string, aliases: string[], requested: string) {
  const expected = normalizeImportText(requested);
  return [current, ...aliases].some(
    (name) => normalizeImportText(name) === expected,
  );
}

export function importSubjectLabelsMatch(
  subject: NamedImportSubject,
  subjectName: string,
  areaName: string,
) {
  return (
    (!subjectName || matchesName(subject.name, subject.name_aliases, subjectName)) &&
    (!areaName ||
      matchesName(subject.group_areas.name, subject.group_areas.name_aliases, areaName))
  );
}

export function resolveImportSubjectByName<T extends NamedImportSubject>(
  subjects: T[],
  subjectName: string,
  areaName: string,
): { subject?: T; error?: string } {
  const matches = subjects.filter(
    (subject) =>
      matchesName(subject.name, subject.name_aliases, subjectName) &&
      importSubjectLabelsMatch(subject, subjectName, areaName),
  );

  if (matches.length > 1) {
    return {
      error:
        "La asignatura es ambigua por nombres actuales o anteriores; usa asignatura_id de una plantilla nueva.",
    };
  }
  if (!matches.length) {
    return {
      error:
        "La asignatura o el área no existe en la malla del grupo; revisa el nombre o usa asignatura_id.",
    };
  }
  return { subject: matches[0] };
}
