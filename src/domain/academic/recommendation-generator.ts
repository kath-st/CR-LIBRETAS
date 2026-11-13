export const RECOMMENDATION_OBSERVATIONS = [
  {
    id: "responsable",
    label: "Responsable",
    tone: "fortaleza",
  },
  {
    id: "interes",
    label: "Demuestra interés",
    tone: "fortaleza",
  },
  {
    id: "participa",
    label: "Participa en clase",
    tone: "fortaleza",
  },
  {
    id: "cumple_tareas",
    label: "Cumple sus tareas",
    tone: "fortaleza",
  },
  {
    id: "progreso",
    label: "Ha mostrado progreso",
    tone: "fortaleza",
  },
  {
    id: "buena_conducta",
    label: "Mantiene buena conducta",
    tone: "fortaleza",
  },
  {
    id: "distraccion",
    label: "Se distrae con facilidad",
    tone: "mejora",
  },
  {
    id: "practica",
    label: "Debe practicar más",
    tone: "mejora",
  },
  {
    id: "tareas_pendientes",
    label: "Debe cumplir sus tareas",
    tone: "mejora",
  },
  {
    id: "participacion",
    label: "Necesita participar más",
    tone: "mejora",
  },
  {
    id: "responsabilidad",
    label: "Debe mejorar su responsabilidad",
    tone: "mejora",
  },
  {
    id: "apoyo_casa",
    label: "Requiere acompañamiento en casa",
    tone: "mejora",
  },
] as const;

export type RecommendationObservationId =
  (typeof RECOMMENDATION_OBSERVATIONS)[number]["id"];

export type RecommendationBand =
  | "excelente"
  | "bueno"
  | "proceso"
  | "refuerzo";

export type RecommendationInput = {
  firstName: string;
  observationIds: readonly RecommendationObservationId[];
  rank: number | null;
  termAverage: number;
  variantSeed: string;
};

const BASE_MESSAGES: Record<RecommendationBand, readonly string[]> = {
  excelente: [
    "{name}, te felicito por tus excelentes calificaciones. Demuestras dedicación y constancia en tus estudios.",
    "{name}, has alcanzado un excelente rendimiento gracias a tu esfuerzo y dedicación.",
    "{name}, tus excelentes resultados reflejan responsabilidad, capacidad y perseverancia.",
  ],
  bueno: [
    "{name}, has logrado un buen rendimiento. Continúa trabajando con responsabilidad para seguir avanzando.",
    "{name}, demuestras un buen desempeño y capacidad para continuar progresando.",
    "{name}, tus resultados son favorables. Mantén la constancia y el compromiso con tus aprendizajes.",
  ],
  proceso: [
    "{name}, demuestras capacidad para mejorar. Esfuérzate con mayor constancia para fortalecer tus calificaciones.",
    "{name}, puedes alcanzar mejores resultados si mantienes una práctica constante y mayor dedicación.",
    "{name}, continúa esforzándote para mejorar tus calificaciones y consolidar tus aprendizajes.",
  ],
  refuerzo: [
    "{name}, necesitas esforzarte para mejorar tus calificaciones. Con responsabilidad y práctica constante podrás avanzar.",
    "{name}, debes dedicar mayor esfuerzo a tus aprendizajes y cumplir responsablemente con tus actividades.",
    "{name}, puedes mejorar tus resultados con mayor dedicación, práctica y constancia.",
  ],
};

const CLOSINGS: Record<RecommendationBand, readonly string[]> = {
  excelente: [
    "¡Sigue así y alcanzarás muchas metas!",
    "Continúa así y lograrás grandes metas.",
  ],
  bueno: [
    "Confío en que continuarás progresando.",
    "Sigue esforzándote y alcanzarás nuevas metas.",
  ],
  proceso: [
    "Sé que puedes lograrlo.",
    "Confío en tu capacidad para seguir mejorando.",
  ],
  refuerzo: [
    "Sé que puedes lograrlo.",
    "Con esfuerzo y apoyo podrás progresar.",
  ],
};

const COMPACT_BASE_MESSAGES: Record<RecommendationBand, string> = {
  excelente: "{name}, te felicito por tus excelentes calificaciones.",
  bueno: "{name}, has logrado un buen rendimiento.",
  proceso: "{name}, esfuérzate para seguir mejorando tus calificaciones.",
  refuerzo: "{name}, necesitas mayor esfuerzo para mejorar tus calificaciones.",
};

const OBSERVATION_CLAUSES: Record<RecommendationObservationId, string> = {
  responsable: "continúa demostrando responsabilidad",
  interes: "mantén el interés que demuestras en clase",
  participa: "continúa participando activamente",
  cumple_tareas: "mantén el cumplimiento de tus tareas",
  progreso: "valora el progreso que vienes demostrando",
  buena_conducta: "conserva tu actitud respetuosa",
  distraccion: "evita distraerte y mantén la atención en clase",
  practica: "practica con mayor constancia",
  tareas_pendientes: "esfuérzate por cumplir oportunamente tus tareas",
  participacion: "anímate a participar con mayor frecuencia",
  responsabilidad: "demuestra mayor responsabilidad en tus actividades",
  apoyo_casa: "refuerza en casa los aprendizajes trabajados",
};

function seedNumber(value: string) {
  return [...value].reduce(
    (total, character, index) =>
      (total + character.charCodeAt(0) * (index + 1)) % 2147483647,
    0,
  );
}

function choose<T>(values: readonly T[], seed: number, offset = 0) {
  return values[(seed + offset) % values.length] as T;
}

function firstName(value: string) {
  const raw = value.trim().split(/\s+/)[0] ?? "";
  if (!raw) return "Estudiante";
  const lower = raw.toLocaleLowerCase("es-PE");
  return `${lower.charAt(0).toLocaleUpperCase("es-PE")}${lower.slice(1)}`;
}

function joinClauses(clauses: readonly string[]) {
  if (clauses.length === 1) return clauses[0];
  return `${clauses.slice(0, -1).join(", ")} y ${clauses.at(-1)}`;
}

export function recommendationBand(average: number): RecommendationBand {
  if (average >= 18) return "excelente";
  if (average >= 15) return "bueno";
  if (average >= 11) return "proceso";
  return "refuerzo";
}

export function generateRecommendation(input: RecommendationInput) {
  if (!Number.isFinite(input.termAverage)) {
    throw new RangeError("El promedio del bimestre no es válido.");
  }
  if (input.termAverage < 0 || input.termAverage > 20) {
    throw new RangeError("El promedio debe estar entre 0 y 20.");
  }
  if (input.observationIds.length > 3) {
    throw new RangeError("Selecciona como máximo tres observaciones.");
  }

  const band = recommendationBand(input.termAverage);
  const seed = seedNumber(input.variantSeed);
  const name = firstName(input.firstName);
  let baseMessage = choose(BASE_MESSAGES[band], seed).replace("{name}", name);
  let rankMessage = "";

  if (input.termAverage >= 15 && input.rank === 1) {
    rankMessage = "También destacas por alcanzar el primer puesto.";
  } else if (
    input.termAverage >= 15 &&
    input.rank !== null &&
    input.rank <= 3
  ) {
    rankMessage = "Tu esfuerzo te ubica entre los primeros puestos.";
  }

  const clauses = [
    ...new Set(input.observationIds.map((id) => OBSERVATION_CLAUSES[id])),
  ];
  const observationMessage = clauses.length
    ? `Además, ${joinClauses(clauses)}.`
    : "";
  let closingMessage = choose(CLOSINGS[band], seed, 3);
  const compose = () =>
    [baseMessage, rankMessage, observationMessage, closingMessage]
      .filter(Boolean)
      .join(" ");

  if (compose().length > 300) {
    baseMessage = COMPACT_BASE_MESSAGES[band].replace("{name}", name);
  }
  if (compose().length > 300) {
    closingMessage = "";
  }

  const result = compose();
  if (result.length > 300) {
    throw new RangeError("No se pudo generar un texto de hasta 300 caracteres.");
  }
  return result;
}
