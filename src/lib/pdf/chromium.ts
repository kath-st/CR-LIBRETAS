import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const DEFAULT_EXECUTABLES =
  process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        path.join(
          process.env.LOCALAPPDATA ?? "",
          "Microsoft",
          "Edge",
          "Application",
          "msedge.exe",
        ),
      ]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : [
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
        ];

async function executablePath() {
  const candidates = [
    process.env.CHROMIUM_EXECUTABLE_PATH,
    ...DEFAULT_EXECUTABLES,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continúa con la siguiente instalación conocida.
    }
  }
  throw new Error(
    "No se encontró Chromium. Configura CHROMIUM_EXECUTABLE_PATH con la ruta de Edge, Chrome o Chromium.",
  );
}

export async function generatePdfFromHtml(html: string) {
  const jobId = randomUUID();
  const jobDirectory = path.join(os.tmpdir(), "cr-libretas-pdf", jobId);
  const profileDirectory = path.join(jobDirectory, "browser-profile");
  const homeDirectory = path.join(jobDirectory, "home");
  const cacheDirectory = path.join(homeDirectory, ".cache");
  const configDirectory = path.join(homeDirectory, ".config");
  const crashDirectory = path.join(jobDirectory, "crash-dumps");
  const htmlPath = path.join(jobDirectory, "boletas.html");
  const pdfPath = path.join(jobDirectory, "boletas.pdf");

  await Promise.all(
    [
      profileDirectory,
      homeDirectory,
      cacheDirectory,
      configDirectory,
      crashDirectory,
    ].map((directory) => mkdir(directory, { recursive: true })),
  );
  try {
    await writeFile(htmlPath, html, "utf8");
    const executable = await executablePath();
    await run(
      executable,
      [
        "--headless=new",
        "--disable-extensions",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-crash-reporter",
        "--disable-breakpad",
        "--no-sandbox",
        "--noerrdialogs",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=2500",
        `--crash-dumps-dir=${crashDirectory}`,
        `--user-data-dir=${profileDirectory}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ],
      {
        env: {
          ...process.env,
          HOME: homeDirectory,
          TMPDIR: jobDirectory,
          XDG_CACHE_HOME: cacheDirectory,
          XDG_CONFIG_HOME: configDirectory,
        },
        maxBuffer: 2 * 1024 * 1024,
        timeout: 90_000,
        windowsHide: true,
      },
    );
    return await readFile(pdfPath);
  } finally {
    await rm(jobDirectory, { force: true, recursive: true }).catch(() => {});
  }
}
