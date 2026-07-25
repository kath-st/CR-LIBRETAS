export type Grade = number | null;

export type AcademicArea = {
  active: boolean;
  id: string;
  includedInFinal: boolean;
};

export type AcademicSubject = {
  active: boolean;
  areaId: string;
  id: string;
};

export type StudentGrade = {
  score: Grade;
  subjectId: string;
  term: 1 | 2 | 3 | 4;
};

export type StudentAcademicResult = {
  areaAverages: Record<string, number | null>;
  finalInternal: number | null;
  finalVisible: number | null;
  subjectAverages: Record<string, number | null>;
};

function assertGrade(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    throw new RangeError("Las notas deben ser enteros entre 0 y 20.");
  }
}

export function averageRecorded(values: readonly Grade[]): number | null {
  const recorded = values.filter((value): value is number => value !== null);
  recorded.forEach(assertGrade);
  if (recorded.length === 0) return null;
  return recorded.reduce((sum, value) => sum + value, 0) / recorded.length;
}

export function visibleInteger(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

export function averageAvailable(
  values: readonly (number | null)[],
): number | null {
  const available = values.filter((value): value is number => value !== null);
  if (available.length === 0) return null;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

export function finalVisible(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export function denseRanks(
  results: readonly { id: string; score: number }[],
): Record<string, number> {
  const uniqueScores = [...new Set(results.map(({ score }) => score))].sort(
    (a, b) => b - a,
  );

  return Object.fromEntries(
    results.map(({ id, score }) => [id, uniqueScores.indexOf(score) + 1]),
  );
}

export function calculateStudentResult(
  areas: readonly AcademicArea[],
  subjects: readonly AcademicSubject[],
  grades: readonly StudentGrade[],
): StudentAcademicResult {
  const activeAreas = areas.filter((area) => area.active);
  const activeAreaIds = new Set(activeAreas.map((area) => area.id));
  const activeSubjects = subjects.filter(
    (subject) => subject.active && activeAreaIds.has(subject.areaId),
  );

  const subjectAverages = Object.fromEntries(
    activeSubjects.map((subject) => [
      subject.id,
      averageRecorded(
        ([1, 2, 3, 4] as const).map(
          (term) =>
            grades.find(
              (grade) =>
                grade.subjectId === subject.id && grade.term === term,
            )?.score ?? null,
        ),
      ),
    ]),
  );

  const areaAverages = Object.fromEntries(
    activeAreas.map((area) => [
      area.id,
      averageAvailable(
        activeSubjects
          .filter((subject) => subject.areaId === area.id)
          .map((subject) => subjectAverages[subject.id] ?? null),
      ),
    ]),
  );

  const finalInternal = averageAvailable(
    activeAreas
      .filter((area) => area.includedInFinal)
      .map((area) => areaAverages[area.id] ?? null),
  );

  return {
    areaAverages,
    finalInternal,
    finalVisible: finalVisible(finalInternal),
    subjectAverages,
  };
}

export function calculateTermAverage(
  term: 1 | 2 | 3 | 4,
  areas: readonly AcademicArea[],
  subjects: readonly AcademicSubject[],
  grades: readonly StudentGrade[],
): number | null {
  const activeAreas = areas.filter(
    (area) => area.active && area.includedInFinal,
  );
  const activeSubjects = subjects.filter((subject) => subject.active);

  return averageAvailable(
    activeAreas.map((area) =>
      averageAvailable(
        activeSubjects
          .filter((subject) => subject.areaId === area.id)
          .map(
            (subject) =>
              grades.find(
                (grade) =>
                  grade.subjectId === subject.id && grade.term === term,
              )?.score ?? null,
          ),
      ),
    ),
  );
}
