import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const brandDirectory = path.join(root, "public", "brand");
const institutionalAssets = [
  "escudo.png",
  "firma-directora.png",
  "sello-institucional.png",
];

await mkdir(brandDirectory, { recursive: true });
await Promise.all(
  institutionalAssets.map((fileName) =>
    copyFile(
      path.join(root, "docs", "referencias-boleta", fileName),
      path.join(brandDirectory, fileName),
    ),
  ),
);

console.log("Escudo, sello y firma de la directora sincronizados.");
