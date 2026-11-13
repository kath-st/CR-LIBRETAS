import { z } from "zod";

const dniSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$/, "Ingresa un DNI válido de 8 dígitos.");

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.");

export const loginSchema = z.object({
  dni: dniSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    nombres: z
      .string()
      .trim()
      .min(2, "Ingresa los nombres de la docente.")
      .max(80, "Los nombres son demasiado largos."),
    apellidos: z
      .string()
      .trim()
      .min(2, "Ingresa los apellidos de la docente.")
      .max(100, "Los apellidos son demasiado largos."),
    dni: dniSchema,
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export const passwordChangeSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmation"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

export function issuesByField(
  result: z.ZodSafeParseError<Record<string, unknown>>,
) {
  return Object.fromEntries(
    result.error.issues.map((issue) => [
      String(issue.path[0] ?? "form"),
      issue.message,
    ]),
  );
}
