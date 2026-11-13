import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("el ejemplo de entorno no contiene valores ni service_role", async () => {
  const example = await readFile(new URL(".env.example", root), "utf8");
  assert.doesNotMatch(example, /SUPABASE_SERVICE_ROLE_KEY\s*=/);
  assert.match(example, /NEXT_PUBLIC_SUPABASE_URL=\s*$/m);
  assert.match(example, /NEXT_PUBLIC_SUPABASE_ANON_KEY=\s*$/m);
  assert.match(example, /SUPABASE_SECRET_KEY=\s*$/m);
  assert.doesNotMatch(example, /NEXT_PUBLIC_SUPABASE_SECRET_KEY/);
});

test("git ignora archivos de entorno reales y conserva el ejemplo", async () => {
  const gitignore = await readFile(new URL(".gitignore", root), "utf8");
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
