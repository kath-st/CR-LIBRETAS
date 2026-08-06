export const MAX_GRADE_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_GRADE_IMPORT_ROWS = 10_000;
export const MAX_GRADE_IMPORT_CHANGES = 40_000;

export type GradeImportChange = {
  action: "clear" | "set";
  score: number | null;
  term: 1 | 2 | 3 | 4;
};

export type ParsedGradeImportRow = {
  academicYear: number | null;
  area: string;
  enrollmentId: string;
  firstNames: string;
  grade: number | null;
  groupId: string;
  groupName: string;
  key: string;
  lastNames: string;
  level: string;
  parseErrors: string[];
  rowNumber: number;
  section: string;
  sheet: string;
  subject: string;
  subjectId: string;
  changes: GradeImportChange[];
};

type RowSource = {
  name: string;
  rows: unknown[][];
};

function cleanText(value: unknown) {
  return String(value ?? "").replaceAll(/\s+/g, " ").trim();
}

export function normalizeImportText(value: unknown) {
  return cleanText(value)
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeHeader(value: unknown) {
  return normalizeImportText(value)
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
}

function findColumn(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function integerFromText(value: unknown) {
  const match = cleanText(value).match(/\d+/);
  return match ? Number(match[0]) : null;
}

function splitCombinedName(value: unknown) {
  const clean = cleanText(value);
  if (!clean) return { firstNames: "", lastNames: "" };
  if (clean.includes(",")) {
    const [lastNames = "", ...firstParts] = clean.split(",");
    return {
      firstNames: cleanText(firstParts.join(" ")),
      lastNames: cleanText(lastNames),
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

function parseScore(
  value: unknown,
  term: 1 | 2 | 3 | 4,
): { change?: GradeImportChange; error?: string } {
  const clean = cleanText(value);
  if (!clean) return {};
  const normalized = normalizeImportText(clean);
  if (["borrar", "limpiar", "null"].includes(normalized)) {
    return { change: { action: "clear", score: null, term } };
  }
  if (!/^-?\d+(?:[.,]\d+)?$/.test(clean)) {
    return { error: `${term}B debe ser un entero de 0 a 20 o BORRAR.` };
  }
  const score = Number(clean.replace(",", "."));
  if (!Number.isInteger(score) || score < 0 || score > 20) {
    return { error: `${term}B debe ser un entero de 0 a 20 o BORRAR.` };
  }
  return { change: { action: "set", score, term } };
}

export function buildGradeImportRows(sources: RowSource[]) {
  const parsed: ParsedGradeImportRow[] = [];
  let changeCount = 0;

  for (const source of sources) {
    if (source.rows.length < 2) continue;
    const headers = (source.rows[0] ?? []).map(normalizeHeader);
    const columns = {
      academicYear: findColumn(headers, ["anio", "ano", "anio_academico"]),
      area: findColumn(headers, ["area", "area_academica"]),
      combinedName: findColumn(headers, [
        "apellidos_y_nombres",
        "alumno",
        "estudiante",
      ]),
      enrollmentId: findColumn(headers, ["matricula_id", "enrollment_id"]),
      firstNames: findColumn(headers, ["nombres", "nombre"]),
      grade: findColumn(headers, ["grado"]),
      groupId: findColumn(headers, ["grupo_id", "group_id"]),
      groupName: findColumn(headers, ["grupo", "nombre_grupo"]),
      lastNames: findColumn(headers, ["apellidos", "apellido"]),
      level: findColumn(headers, ["nivel"]),
      section: findColumn(headers, ["seccion"]),
      subject: findColumn(headers, [
        "asignatura",
        "curso",
        "materia",
        "asignatura_curso",
      ]),
      subjectId: findColumn(headers, ["asignatura_id", "subject_id"]),
      terms: ([1, 2, 3, 4] as const).map((term) =>
        findColumn(headers, [
          `${term}b`,
          `b${term}`,
          `bimestre_${term}`,
          `nota_${term}`,
          `nota${term}`,
        ]),
      ),
    };

    const hasSeparateNames = columns.firstNames >= 0 && columns.lastNames >= 0;
    if (!hasSeparateNames && columns.combinedName < 0 && columns.enrollmentId < 0) {
      throw new Error(
        `La hoja «${source.name}» necesita «apellidos» y «nombres», «apellidos_y_nombres» o «matricula_id».`,
      );
    }
    if (columns.subject < 0 && columns.subjectId < 0) {
      throw new Error(
        `La hoja «${source.name}» necesita la columna «asignatura» o «asignatura_id».`,
      );
    }
    if (columns.terms.every((index) => index < 0)) {
      throw new Error(
        `La hoja «${source.name}» necesita al menos una columna 1B, 2B, 3B o 4B.`,
      );
    }

    for (let index = 1; index < source.rows.length; index += 1) {
      const row = source.rows[index] ?? [];
      if (row.every((cell) => !cleanText(cell))) continue;
      const changes: GradeImportChange[] = [];
      const parseErrors: string[] = [];
      for (const term of [1, 2, 3, 4] as const) {
        const column = columns.terms[term - 1];
        if (column < 0) continue;
        const result = parseScore(row[column], term);
        if (result.error) parseErrors.push(result.error);
        if (result.change) changes.push(result.change);
      }

      // A generated template contains intentionally empty grade rows. They do
      // not represent an import instruction and should not become errors.
      if (!changes.length && !parseErrors.length) continue;

      const names = hasSeparateNames
        ? {
            firstNames: cleanText(row[columns.firstNames]),
            lastNames: cleanText(row[columns.lastNames]),
          }
        : splitCombinedName(row[columns.combinedName]);
      const enrollmentId = cleanText(row[columns.enrollmentId]);
      const subjectId = cleanText(row[columns.subjectId]);
      if (!enrollmentId) {
        if (names.firstNames.length < 2 || names.firstNames.length > 100) {
          parseErrors.push("Los nombres deben tener entre 2 y 100 caracteres.");
        }
        if (names.lastNames.length < 2 || names.lastNames.length > 120) {
          parseErrors.push("Los apellidos deben tener entre 2 y 120 caracteres.");
        }
      }
      if (!subjectId && !cleanText(row[columns.subject])) {
        parseErrors.push("Falta la asignatura.");
      }

      changeCount += changes.length;
      parsed.push({
        academicYear:
          columns.academicYear >= 0
            ? integerFromText(row[columns.academicYear])
            : null,
        area: cleanText(row[columns.area]),
        changes,
        enrollmentId,
        firstNames: names.firstNames,
        grade: columns.grade >= 0 ? integerFromText(row[columns.grade]) : null,
        groupId: cleanText(row[columns.groupId]),
        groupName: cleanText(row[columns.groupName]),
        key: `${source.name}:${index + 1}`,
        lastNames: names.lastNames,
        level: cleanText(row[columns.level]),
        parseErrors,
        rowNumber: index + 1,
        section: cleanText(row[columns.section]),
        sheet: source.name,
        subject: cleanText(row[columns.subject]),
        subjectId,
      });
    }
  }

  if (!parsed.length) {
    throw new Error("El archivo no contiene notas para importar.");
  }
  if (parsed.length > MAX_GRADE_IMPORT_ROWS) {
    throw new Error(`El archivo supera el límite de ${MAX_GRADE_IMPORT_ROWS} filas con notas.`);
  }
  if (changeCount > MAX_GRADE_IMPORT_CHANGES) {
    throw new Error(
      `El archivo supera el límite de ${MAX_GRADE_IMPORT_CHANGES} cambios de nota.`,
    );
  }
  return parsed;
}

export async function parseGradeImportFile(file: File) {
  if (file.size > MAX_GRADE_IMPORT_FILE_BYTES) {
    throw new Error("El archivo supera el límite de 10 MB.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  let sources: RowSource[];

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
    sources = [{ name: "CSV", rows: result.data }];
  } else if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    sources = workbook.SheetNames.filter(
      (name) => normalizeImportText(name) !== "instrucciones",
    ).map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      }),
    }));
  } else {
    throw new Error("Selecciona un archivo XLSX, XLS o CSV.");
  }

  return buildGradeImportRows(sources);
}
