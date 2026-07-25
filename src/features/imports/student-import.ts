export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 200;

export type ExistingStudent = {
  firstNames: string;
  lastNames: string;
};

export type ImportPreviewRow = {
  duplicate: boolean;
  error: string;
  firstNames: string;
  key: string;
  lastNames: string;
  rowNumber: number;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

export function normalizePersonName(value: unknown) {
  return String(value ?? "").replaceAll(/\s+/g, " ").trim();
}

export function comparableStudentName(
  firstNames: unknown,
  lastNames: unknown,
) {
  return `${normalizePersonName(lastNames)} ${normalizePersonName(firstNames)}`
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function splitCombinedName(value: unknown) {
  const clean = normalizePersonName(value);
  if (!clean) return { firstNames: "", lastNames: "" };

  if (clean.includes(",")) {
    const [lastNames = "", ...firstParts] = clean.split(",");
    return {
      firstNames: normalizePersonName(firstParts.join(" ")),
      lastNames: normalizePersonName(lastNames),
    };
  }

  const parts = clean.split(" ");
  if (parts.length < 2) return { firstNames: "", lastNames: clean };
  const lastNameParts = parts.length >= 3 ? 2 : 1;
  return {
    firstNames: parts.slice(lastNameParts).join(" "),
    lastNames: parts.slice(0, lastNameParts).join(" "),
  };
}

export function buildStudentImportPreview(
  rows: unknown[][],
  existingStudents: ExistingStudent[],
) {
  if (rows.length < 2) {
    throw new Error("El archivo debe contener una cabecera y al menos un alumno.");
  }

  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const lastNamesIndex = headers.indexOf("apellidos");
  const firstNamesIndex = headers.indexOf("nombres");
  const combinedIndex = headers.indexOf("apellidos_y_nombres");
  const hasSeparateColumns = lastNamesIndex >= 0 && firstNamesIndex >= 0;

  if (!hasSeparateColumns && combinedIndex < 0) {
    throw new Error(
      "Usa las columnas «apellidos» y «nombres», o «apellidos_y_nombres».",
    );
  }

  const knownNames = new Set(
    existingStudents.map((student) =>
      comparableStudentName(student.firstNames, student.lastNames),
    ),
  );
  const fileNames = new Set<string>();
  const preview: ImportPreviewRow[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const source = rows[index] ?? [];
    if (source.every((cell) => !normalizePersonName(cell))) continue;

    const values = hasSeparateColumns
      ? {
          firstNames: normalizePersonName(source[firstNamesIndex]),
          lastNames: normalizePersonName(source[lastNamesIndex]),
        }
      : splitCombinedName(source[combinedIndex]);
    const rowNumber = index + 1;
    let error = "";

    if (values.lastNames.length < 2 || values.lastNames.length > 120) {
      error = "Los apellidos deben tener entre 2 y 120 caracteres.";
    } else if (
      values.firstNames.length < 2 ||
      values.firstNames.length > 100
    ) {
      error = "Los nombres deben tener entre 2 y 100 caracteres.";
    }

    const comparable = comparableStudentName(
      values.firstNames,
      values.lastNames,
    );
    const duplicate = Boolean(
      !error && (knownNames.has(comparable) || fileNames.has(comparable)),
    );
    if (!error) fileNames.add(comparable);

    preview.push({
      duplicate,
      error,
      firstNames: values.firstNames,
      key: `${rowNumber}:${comparable}`,
      lastNames: values.lastNames,
      rowNumber,
    });
  }

  if (!preview.length) {
    throw new Error("El archivo no contiene alumnos.");
  }
  if (preview.length > MAX_IMPORT_ROWS) {
    throw new Error(`Solo se permiten ${MAX_IMPORT_ROWS} alumnos por archivo.`);
  }
  return preview;
}

export async function parseStudentFile(
  file: File,
  existingStudents: ExistingStudent[],
) {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("El archivo supera el límite de 5 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: unknown[][];

  if (extension === "csv") {
    const Papa = await import("papaparse");
    const result = Papa.parse<string[]>(await file.text(), {
      skipEmptyLines: "greedy",
    });
    if (result.errors.length) {
      throw new Error(
        `No se pudo leer el CSV: ${result.errors[0]?.message ?? "formato inválido"}.`,
      );
    }
    rows = result.data;
  } else if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("El libro no contiene hojas.");
    rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[firstSheetName],
      {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      },
    );
  } else {
    throw new Error("Selecciona un archivo XLSX, XLS o CSV.");
  }

  return buildStudentImportPreview(rows, existingStudents);
}
