import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildStudentImportPreview,
  comparableStudentName,
} from "../src/features/imports/student-import.ts";
import { backupDocumentSchema } from "../src/features/backups/schema.ts";

const root = new URL("../", import.meta.url);

test("la Fase 5 incluye rutas, interfaz, migración y pruebas SQL", async () => {
  const required = [
    "src/app/(dashboard)/grupos/[groupId]/respaldos/page.tsx",
    "src/app/api/groups/[groupId]/students/import/route.ts",
    "src/app/api/groups/[groupId]/backup/route.ts",
    "src/app/api/groups/[groupId]/backup/preview/route.ts",
    "src/app/api/groups/[groupId]/backup/restore/route.ts",
    "src/features/imports/StudentImport.tsx",
    "src/features/backups/BackupCenter.tsx",
    "supabase/migrations/20260724000100_phase_5_import_backups.sql",
    "supabase/tests/database/005_phase_5_import_backups.test.sql",
  ];
  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("la vista previa acepta columnas separadas y detecta duplicados", () => {
  const preview = buildStudentImportPreview(
    [
      ["apellidos", "nombres"],
      ["Sánchez Torres", "María"],
      ["Quispe León", "Valery"],
      ["Quispe León", "Valery"],
    ],
    [{ firstNames: "Maria", lastNames: "Sanchez Torres" }],
  );

  assert.equal(preview.length, 3);
  assert.equal(preview[0].duplicate, true);
  assert.equal(preview[1].duplicate, false);
  assert.equal(preview[2].duplicate, true);
  assert.equal(
    comparableStudentName("María", "Sánchez Torres"),
    "sanchez torres maria",
  );
});

test("la columna combinada admite coma y señala filas inválidas", () => {
  const preview = buildStudentImportPreview(
    [
      ["APELLIDOS Y NOMBRES"],
      ["Arquinigo Quispe, Valery Beatriz"],
      ["SinNombre"],
    ],
    [],
  );

  assert.deepEqual(
    {
      firstNames: preview[0].firstNames,
      lastNames: preview[0].lastNames,
    },
    { firstNames: "Valery Beatriz", lastNames: "Arquinigo Quispe" },
  );
  assert.match(preview[1].error, /nombres/i);
});

test("el respaldo acepta los UUID deterministas de los catálogos", () => {
  const document = {
    exported_at: "2026-07-24T12:00:00+00:00",
    format: "cr-libretas.group-backup",
    integrity: {
      algorithm: "sha256",
      payload_sha256: "a".repeat(64),
    },
    payload: {
      areas: [
        {
          active: true,
          catalog_area_id: "10000000-0000-0000-0000-000000000001",
          id: "50000000-0000-4000-8000-000000000001",
          included_in_final: true,
          is_direct: false,
          name: "Matemática",
          position: 10,
        },
      ],
      enrollments: [],
      grades: [],
      group: {
        academic_year: 2026,
        active: true,
        display_name: "2026 - Primaria - 6to",
        grade: 6,
        id: "50000000-0000-4000-8000-000000000002",
        level: "primaria",
        section: "Única",
        teacher_id: "50000000-0000-4000-8000-000000000003",
      },
      institution: null,
      recommendations: [],
      results: {
        final_averages: [],
        informative_only: true,
      },
      students: [],
      subjects: [
        {
          active: true,
          catalog_subject_id: "20000000-0000-0000-0000-000000000001",
          group_area_id: "50000000-0000-4000-8000-000000000001",
          id: "50000000-0000-4000-8000-000000000004",
          name: "Aritmética",
          position: 10,
        },
      ],
    },
    version: 1,
  };

  assert.equal(backupDocumentSchema.safeParse(document).success, true);
});

test("la migración exige hash, transacción e historial inmutable", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260724000100_phase_5_import_backups.sql",
      root,
    ),
    "utf8",
  );

  assert.match(sql, /create table public\.group_backup_history/i);
  assert.match(sql, /El historial de respaldos es inmutable/i);
  assert.match(sql, /extensions\.digest/i);
  assert.match(sql, /create or replace function public\.import_students/i);
  assert.match(sql, /create or replace function public\.restore_group_backup/i);
  assert.match(sql, /antes_de_restaurar/i);
  assert.match(sql, /app_private\.can_access_group/i);
});
