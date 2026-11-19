import assert from "node:assert/strict";
import test from "node:test";
import { calculateStudentResult } from "../src/domain/academic/calculations.ts";
import { loadGroupGrades } from "../src/lib/supabase/group-grades.ts";

test("carga los cuatro bimestres de 25 alumnos después de la fila 1000", async () => {
  const grades = Array.from({ length: 25 * 18 * 4 }, (_, index) => ({
    enrollment_id: `student-${Math.floor(index / 72)}`,
    group_subject_id: `subject-${Math.floor(index / 4) % 18}`,
    score: Math.floor(index / 72) === 24 && index % 4 === 3 ? 20 : 10,
    term: (index % 4) + 1,
  }));
  const ranges = [];
  const client = {
    from(table) {
      assert.equal(table, "grades");
      return {
        select(columns) {
          assert.equal(columns, "enrollment_id, group_subject_id, term, score");
          return this;
        },
        eq(column, value) {
          assert.equal(column, "group_id");
          assert.equal(value, "group-1");
          return this;
        },
        order() {
          return this;
        },
        lte(column, value) {
          assert.equal(column, "term");
          this.throughTerm = value;
          return this;
        },
        async range(start, end) {
          ranges.push([start, end]);
          const filtered = this.throughTerm
            ? grades.filter((grade) => grade.term <= this.throughTerm)
            : grades;
          return { data: filtered.slice(start, end + 1), error: null };
        },
      };
    },
  };

  const result = await loadGroupGrades(client, "group-1");
  assert.equal(result.length, 1800);
  assert.equal(result.at(-1).enrollment_id, "student-24");
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499], [1500, 1999]]);
  const finalStudent = calculateStudentResult(
    [{ active: true, id: "area", includedInFinal: true }],
    Array.from({ length: 18 }, (_, index) => ({
      active: true,
      areaId: "area",
      id: `subject-${index}`,
    })),
    result
      .filter((grade) => grade.enrollment_id === "student-24")
      .map((grade) => ({
        score: grade.score,
        subjectId: grade.group_subject_id,
        term: grade.term,
      })),
  );
  assert.equal(finalStudent.finalVisible, 13);

  ranges.length = 0;
  const firstTerm = await loadGroupGrades(client, "group-1", 1);
  assert.equal(firstTerm.length, grades.filter((grade) => grade.term === 1).length);
  assert.equal(firstTerm.every((grade) => grade.term === 1), true);
});
