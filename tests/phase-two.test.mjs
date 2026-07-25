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
    "src/app/api/admin/teachers/[id]/route.ts",
    "src/features/admin/AdminOverview.tsx",
    "src/features/admin/TeachersAdmin.tsx",
    "src/features/admin/GroupsAdmin.tsx",
    "src/features/auth/PendingAccount.tsx",
    "src/features/auth/useAccessProfileMonitor.ts",
    "src/features/groups/MyGroups.tsx",
    "src/components/dashboard/DashboardSessionBoundary.tsx",
    "src/lib/supabase/admin.ts",
    "supabase/migrations/20260723000200_phase_2_auth_admin.sql",
    "supabase/tests/database/002_phase_2_auth_admin.test.sql",
  ];

  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("el panel carga datos en el navegador sin bloquear la navegación", async () => {
  const [overview, teachers, groups, myGroups, boundary, adminPage] =
    await Promise.all([
      readFile(new URL("src/features/admin/AdminOverview.tsx", root), "utf8"),
      readFile(new URL("src/features/admin/TeachersAdmin.tsx", root), "utf8"),
      readFile(new URL("src/features/admin/GroupsAdmin.tsx", root), "utf8"),
      readFile(new URL("src/features/groups/MyGroups.tsx", root), "utf8"),
      readFile(
        new URL(
          "src/components/dashboard/DashboardSessionBoundary.tsx",
          root,
        ),
        "utf8",
      ),
      readFile(new URL("src/app/(dashboard)/admin/page.tsx", root), "utf8"),
    ]);

  for (const clientView of [overview, teachers, groups, myGroups, boundary]) {
    assert.match(clientView, /"use client"/);
    assert.match(clientView, /createClient/);
  }
  assert.doesNotMatch(adminPage, /createDataClient/);
  assert.doesNotMatch(adminPage, /requireAdmin/);
});

test("registro y login convierten el DNI sin mostrar el email interno", async () => {
  const [identity, login, register, monitor] = await Promise.all([
    readFile(new URL("src/lib/auth/identity.ts", root), "utf8"),
    readFile(new URL("src/features/auth/LoginForm.tsx", root), "utf8"),
    readFile(new URL("src/features/auth/RegisterForm.tsx", root), "utf8"),
    readFile(
      new URL("src/features/auth/useAccessProfileMonitor.ts", root),
      "utf8",
    ),
  ]);

  assert.match(identity, /usuarios\.cristoredentor\.edu\.pe/);
  assert.match(identity, /auth\.cristoredentor\.local/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /internalEmailsForDni/);
  assert.match(login, /\.eq\("id", signedInUserId\)/);
  assert.match(login, /window\.location\.href = destination/);
  assert.match(monitor, /auth\.getSession/);
  assert.match(monitor, /\.eq\("id", session\.user\.id\)/);
  assert.match(register, /auth\.signUp/);
  assert.match(register, /dniToInternalEmail/);
  assert.doesNotMatch(login, /label="Email"/);
  assert.doesNotMatch(register, /label="Email"/);
});

test("las mutaciones usan RLS y reservan la clave privada para el API autenticado", async () => {
  const [teachers, groups, api, adminClient] = await Promise.all([
    readFile(new URL("src/features/admin/TeachersAdmin.tsx", root), "utf8"),
    readFile(new URL("src/features/admin/GroupsAdmin.tsx", root), "utf8"),
    readFile(
      new URL("src/app/api/admin/teachers/[id]/route.ts", root),
      "utf8",
    ),
    readFile(new URL("src/lib/supabase/admin.ts", root), "utf8"),
  ]);

  assert.match(teachers, /\.from\("profiles"\)/);
  assert.match(teachers, /\.update\(\{ status: nextStatus \}\)/);
  assert.match(groups, /\.from\("academic_groups"\)/);
  assert.match(api, /authorization/);
  assert.match(api, /isActiveAdmin/);
  assert.match(api, /updateUserById/);
  assert.doesNotMatch(teachers, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(groups, /SUPABASE_SECRET_KEY/);
  assert.match(adminClient, /import "server-only"/);
  assert.match(adminClient, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(adminClient, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("la cuenta pendiente detecta la aprobación sin recargar manualmente", async () => {
  const [pending, monitor] = await Promise.all([
    readFile(new URL("src/features/auth/PendingAccount.tsx", root), "utf8"),
    readFile(
      new URL("src/features/auth/useAccessProfileMonitor.ts", root),
      "utf8",
    ),
  ]);

  assert.match(pending, /useAccessProfileMonitor/);
  assert.match(pending, /destinationFor\(profile\)/);
  assert.match(monitor, /setInterval\(checkProfile, intervalMs\)/);
  assert.match(monitor, /\.eq\("id", session\.user\.id\)/);
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
