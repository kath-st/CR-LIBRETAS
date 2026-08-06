import {
  calculateTermAverage,
  denseRanks,
  finalVisible,
  type AcademicArea,
  type AcademicSubject,
  type StudentGrade,
} from "./calculations.ts";

export type MeritEnrollment = {
  firstNames: string;
  id: string;
  lastNames: string;
  status: "activo" | "retirado";
  withdrawnFromTerm: number | null;
};

export type MeritRankingEntry = {
  average: number | null;
  averageVisible: number | null;
  complete: boolean;
  firstNames: string;
  id: string;
  lastNames: string;
  missingGrades: number;
  rank: number | null;
  recordedGrades: number;
  status: MeritEnrollment["status"];
  withdrawnFromTerm: number | null;
};

export type MeritRanking = {
  completeStudents: number;
  entries: MeritRankingEntry[];
  excludedStudents: number;
  expectedGrades: number;
  rankedStudents: number;
};

export function eligibleForTerm(
  enrollment: Pick<MeritEnrollment, "status" | "withdrawnFromTerm">,
  term: number,
) {
  return (
    enrollment.status === "activo" ||
    enrollment.withdrawnFromTerm === null ||
    term <= enrollment.withdrawnFromTerm
  );
}

function studentName(entry: Pick<MeritRankingEntry, "firstNames" | "lastNames">) {
  return `${entry.lastNames} ${entry.firstNames}`;
}

export function buildMeritRanking(
  term: 1 | 2 | 3 | 4,
  enrollments: readonly MeritEnrollment[],
  areas: readonly AcademicArea[],
  subjects: readonly AcademicSubject[],
  grades: readonly (StudentGrade & { enrollmentId: string })[],
): MeritRanking {
  const includedAreaIds = new Set(
    areas
      .filter((area) => area.active && area.includedInFinal)
      .map((area) => area.id),
  );
  const expectedSubjectIds = new Set(
    subjects
      .filter(
        (subject) =>
          subject.active && includedAreaIds.has(subject.areaId),
      )
      .map((subject) => subject.id),
  );
  const eligible = enrollments.filter((enrollment) =>
    eligibleForTerm(enrollment, term),
  );
  const averages = eligible.map((enrollment) => {
    const studentGrades = grades.filter(
      (grade) => grade.enrollmentId === enrollment.id,
    );
    return {
      id: enrollment.id,
      score: calculateTermAverage(term, areas, subjects, studentGrades),
    };
  });
  const rankedAverages = averages.filter(
    (item): item is { id: string; score: number } => item.score !== null,
  );
  const ranks = denseRanks(rankedAverages);

  const entries = eligible
    .map((enrollment): MeritRankingEntry => {
      const average =
        averages.find((item) => item.id === enrollment.id)?.score ?? null;
      const recordedGrades = grades.filter(
        (grade) =>
          grade.enrollmentId === enrollment.id &&
          grade.term === term &&
          grade.score !== null &&
          expectedSubjectIds.has(grade.subjectId),
      ).length;
      const missingGrades = Math.max(
        0,
        expectedSubjectIds.size - recordedGrades,
      );
      return {
        average,
        averageVisible: finalVisible(average),
        complete:
          expectedSubjectIds.size > 0 &&
          recordedGrades === expectedSubjectIds.size,
        firstNames: enrollment.firstNames,
        id: enrollment.id,
        lastNames: enrollment.lastNames,
        missingGrades,
        rank: ranks[enrollment.id] ?? null,
        recordedGrades,
        status: enrollment.status,
        withdrawnFromTerm: enrollment.withdrawnFromTerm,
      };
    })
    .sort((left, right) => {
      if (left.average !== null && right.average !== null) {
        return (
          right.average - left.average ||
          studentName(left).localeCompare(studentName(right), "es")
        );
      }
      if (left.average !== null) return -1;
      if (right.average !== null) return 1;
      return studentName(left).localeCompare(studentName(right), "es");
    });

  return {
    completeStudents: entries.filter((entry) => entry.complete).length,
    entries,
    excludedStudents: enrollments.length - eligible.length,
    expectedGrades: expectedSubjectIds.size,
    rankedStudents: rankedAverages.length,
  };
}
