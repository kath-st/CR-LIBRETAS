import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("la Fase 2 incluye todas sus rutas y acciones", async () => {
  const required = [
    "src/app/(dashboard)/admin/page.tsx",
    "src/app/(dashboard)/admin/docentes/page.tsx",
    "src/app/(dashboard)/admin/grupos/page.tsx",
    "src/app/(dashboard)/grupos/page.tsx",
    "src/app/(auth)/cambiar-contrasena/page.tsx",
    "src/app/(auth)/cuenta-inactiva/page.tsx",
    "src/features/admin/teacher-actions.ts",
    "src/features/admin/group-actions.ts",
    "src/lib/auth/session.ts",
    "src/lib/supabase/admin.ts",
    "supabase/migrations/20260723000200_phase_2_auth_admin.sql",
    "supabase/tests/database/002_phase_2_auth_admin.test.sql",
  ];

  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("registro y login convierten el DNI sin mostrar el email interno", async () => {
  const [identity, login, register] = await Promise.all([
    readFile(new URL("src/lib/auth/identity.ts", root), "utf8"),
    readFile(new URL("src/features/auth/LoginForm.tsx", root), "utf8"),
    readFile(new URL("src/features/auth/RegisterForm.tsx", root), "utf8"),
  ]);

  assert.match(identity, /auth\.cristoredentor\.local/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /dniToInternalEmail/);
  assert.match(register, /auth\.signUp/);
  assert.match(register, /dniToInternalEmail/);
  assert.doesNotMatch(login, /label="Email"/);
  assert.doesNotMatch(register, /label="Email"/);
});

test("las acciones administrativas validan rol y mantienen la clave privada en servidor", async () => {
  const [teachers, groups, adminClient] = await Promise.all([
    readFile(new URL("src/features/admin/teacher-actions.ts", root), "utf8"),
    readFile(new URL("src/features/admin/group-actions.ts", root), "utf8"),
    readFile(new URL("src/lib/supabase/admin.ts", root), "utf8"),
  ]);

  assert.match(teachers, /requireAdmin/);
  assert.match(teachers, /updateUserById/);
  assert.doesNotMatch(teachers, /deleteUser/);
  assert.match(groups, /requireAdmin/);
  assert.match(adminClient, /import "server-only"/);
  assert.match(adminClient, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(adminClient, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("la migración obliga docentes activas y enlaza el cambio de contraseña con Auth", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260723000200_phase_2_auth_admin.sql",
      root,
    ),
    "utf8",
  );

  assert.match(sql, /validate_group_teacher/i);
  assert.match(sql, /role = 'docente'/i);
  assert.match(sql, /status = 'activo'/i);
  assert.match(sql, /after update of encrypted_password on auth\.users/i);
  assert.match(sql, /must_change_password = false/i);
});

