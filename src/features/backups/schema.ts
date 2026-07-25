import { z } from "zod";

// PostgreSQL acepta también UUID deterministas con versión 0. Los catálogos
// institucionales usan ese formato (10000000-0000-0000-...), por lo que aquí
// validamos la representación UUID completa sin imponer una versión RFC.
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
const nullableDate = z.string().datetime({ offset: true }).nullable();

const groupSchema = z.object({
  academic_year: z.number().int().min(2020).max(2100),
  active: z.boolean(),
  display_name: z.string().min(3).max(120),
  grade: z.number().int().min(1).max(6),
  id: uuid,
  level: z.enum(["inicial", "primaria", "secundaria"]),
  section: z.string().min(1).max(30),
  teacher_id: uuid,
});

export const backupDocumentSchema = z.object({
  exported_at: z.string().datetime({ offset: true }),
  format: z.literal("cr-libretas.group-backup"),
  integrity: z.object({
    algorithm: z.literal("sha256"),
    payload_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
  payload: z.object({
    areas: z
      .array(
        z.object({
          active: z.boolean(),
          catalog_area_id: uuid,
          id: uuid,
          included_in_final: z.boolean(),
          is_direct: z.boolean(),
          name: z.string().min(2).max(100),
          position: z.number().int().positive(),
        }),
      )
      .max(100),
    enrollments: z
      .array(
        z.object({
          id: uuid,
          status: z.enum(["activo", "retirado"]),
          student_id: uuid,
          withdrawal_reason: z.string().max(300).nullable(),
          withdrawn_at: nullableDate,
          withdrawn_from_term: z.number().int().min(1).max(4).nullable(),
        }),
      )
      .max(500),
    grades: z
      .array(
        z.object({
          enrollment_id: uuid,
          group_subject_id: uuid,
          score: z.number().int().min(0).max(20).nullable(),
          term: z.number().int().min(1).max(4),
        }),
      )
      .max(100000),
    group: groupSchema,
    institution: z
      .object({
        address: z.string(),
        motto: z.string(),
        name: z.string(),
        official_year_name: z.string(),
      })
      .nullable(),
    recommendations: z
      .array(
        z.object({
          enrollment_id: uuid,
          term: z.number().int().min(1).max(4),
          text: z.string().max(300),
        }),
      )
      .max(2000),
    results: z.object({
      final_averages: z.array(
        z.object({
          average: z.number(),
          enrollment_id: uuid,
        }),
      ),
      informative_only: z.literal(true),
    }),
    students: z
      .array(
        z.object({
          first_names: z.string().min(2).max(100),
          id: uuid,
          last_names: z.string().min(2).max(120),
        }),
      )
      .max(500),
    subjects: z
      .array(
        z.object({
          active: z.boolean(),
          catalog_subject_id: uuid.nullable(),
          group_area_id: uuid,
          id: uuid,
          name: z.string().min(2).max(100),
          position: z.number().int().positive(),
        }),
      )
      .max(500),
  }),
  version: z.literal(1),
});

export const backupSummarySchema = z.object({
  active_enrollments: z.number().int().nonnegative(),
  grades: z.number().int().nonnegative(),
  recommendations: z.number().int().nonnegative(),
  retired_enrollments: z.number().int().nonnegative(),
  source_group: groupSchema,
  students: z.number().int().nonnegative(),
  subjects: z.number().int().nonnegative(),
  valid: z.literal(true),
});

export type BackupDocument = z.infer<typeof backupDocumentSchema>;
export type BackupSummary = z.infer<typeof backupSummarySchema>;
