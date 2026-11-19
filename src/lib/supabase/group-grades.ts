import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupGrade = {
  enrollment_id: string;
  group_subject_id: string;
  score: number | null;
  term: 1 | 2 | 3 | 4;
};

const PAGE_SIZE = 500;

export async function loadGroupGrades(
  client: SupabaseClient,
  groupId: string,
  throughTerm?: 1 | 2 | 3 | 4,
): Promise<GroupGrade[]> {
  const grades: GroupGrade[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client
      .from("grades")
      .select("enrollment_id, group_subject_id, term, score")
      .eq("group_id", groupId)
      .order("enrollment_id")
      .order("group_subject_id")
      .order("term");
    if (throughTerm !== undefined) query = query.lte("term", throughTerm);

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as GroupGrade[];
    grades.push(...page);
    if (page.length < PAGE_SIZE) return grades;
  }
}
