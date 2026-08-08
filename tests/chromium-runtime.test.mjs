import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Chromium usa directorios escribibles y desactiva Crashpad al generar PDFs", async () => {
  const source = await readFile(
    new URL("src/lib/pdf/chromium.ts", root),
    "utf8",
  );

  assert.match(source, /--disable-crash-reporter/);
  assert.match(source, /--disable-breakpad/);
  assert.match(source, /--crash-dumps-dir=/);
  assert.match(source, /HOME:\s*homeDirectory/);
  assert.match(source, /XDG_CACHE_HOME:\s*cacheDirectory/);
  assert.match(source, /XDG_CONFIG_HOME:\s*configDirectory/);
  assert.match(source, /pathToFileURL\(htmlPath\)\.href/);
});

test("el usuario de producción tiene un HOME válido para Chromium", async () => {
  const dockerfile = await readFile(new URL("Dockerfile", root), "utf8");

  assert.match(
    dockerfile,
    /useradd[\s\S]*--create-home --home-dir \/home\/nextjs nextjs/,
  );
  assert.match(dockerfile, /ENV HOME=\/home\/nextjs/);
});
