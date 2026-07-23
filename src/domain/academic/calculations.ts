export type Grade = number | null;

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
