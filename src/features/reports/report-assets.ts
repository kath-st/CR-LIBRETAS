import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReportAssets } from "./types";

let cachedAssets: Promise<ReportAssets> | null = null;

function imageData(file: Buffer) {
  return `data:image/png;base64,${file.toString("base64")}`;
}

export function loadReportAssets() {
  cachedAssets ??= (async () => {
    const brand = path.join(process.cwd(), "public", "brand");
    const [border, crest, directorSignature, seal, watermark] =
      await Promise.all([
      readFile(path.join(brand, "borde-de-la-libreta.png")),
      readFile(path.join(brand, "escudo.png")),
      readFile(path.join(brand, "firma-directora.png")),
      readFile(path.join(brand, "sello-institucional.png")),
      readFile(path.join(brand, "escudo-transparente-de-fondo.png")),
    ]);

    return {
      border: imageData(border),
      crest: imageData(crest),
      directorSignature: imageData(directorSignature),
      seal: imageData(seal),
      watermark: imageData(watermark),
    };
  })();

  return cachedAssets;
}
