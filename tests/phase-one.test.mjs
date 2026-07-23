import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("existen las rutas y componentes requeridos", async () => {
  const required = [
    "src/app/(auth)/login/page.tsx",
    "src/app/(auth)/registro/page.tsx",
    "src/app/(auth)/cuenta-pendiente/page.tsx",
    "src/app/fase-0/boleta-prueba/page.tsx",
    "src/components/ui/Button.tsx",
    "src/components/ui/TextField.tsx",
    "src/components/ui/Card.tsx",
    "src/components/ui/Alert.tsx",
    "src/components/ui/Spinner.tsx",
    "src/components/ui/Modal.tsx",
    "src/lib/supabase/client.ts",
    "src/lib/supabase/server.ts",
    "supabase/migrations/20260723000100_phase_1_foundation.sql",
  ];

  await Promise.all(required.map((file) => access(new URL(file, root))));
});

test("la aplicación está en español y resuelve el acceso desde la sesión", async () => {
  const [layout, page] = await Promise.all([
    readFile(new URL("src/app/layout.tsx", root), "utf8"),
    readFile(new URL("src/app/page.tsx", root), "utf8"),
  ]);
  assert.match(layout, /<html lang="es">/);
  assert.match(page, /getAccessProfile/);
  assert.match(page, /redirect\(destinationFor\(profile\)\)/);
});

test("la migración activa RLS y define aislamiento por docente", async () => {
  const sql = await readFile(
    new URL(
      "supabase/migrations/20260723000100_phase_1_foundation.sql",
      root,
    ),
    "utf8",
  );
  assert.match(sql, /alter table public\.profiles enable row level security/i);
  assert.match(
    sql,
    /alter table public\.academic_groups enable row level security/i,
  );
  assert.match(sql, /teacher_id = auth\.uid\(\)/i);
  assert.match(sql, /app_private\.is_active_admin/i);
});

test("la boleta declara tamaño A4 y datos ficticios", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("src/app/fase-0/boleta-prueba/page.tsx", root), "utf8"),
    readFile(
      new URL("src/app/fase-0/boleta-prueba/page.module.css", root),
      "utf8",
    ),
  ]);
  assert.match(page, /ARQUINIGO QUISPE VALERY BEATRIZ/);
  assert.match(css, /width:\s*210mm/);
  assert.match(css, /height:\s*297mm/);
  assert.match(css, /size:\s*A4 portrait/);
});
