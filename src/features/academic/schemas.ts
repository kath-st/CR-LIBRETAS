import { z } from "zod";

export const studentSchema = z.object({
  firstNames: z
    .string()
    .trim()
    .min(2, "Ingresa los nombres.")
    .max(100, "Los nombres son demasiado largos."),
  lastNames: z
    .string()
    .trim()
    .min(2, "Ingresa los apellidos.")
    .max(120, "Los apellidos son demasiado largos."),
});

export const customSubjectSchema = z.object({
  areaId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Ingresa el nombre de la asignatura.")
    .max(100, "El nombre es demasiado largo."),
  position: z.coerce.number().int().min(1).max(999),
});

export const gradeInputSchema = z.union([
  z.literal(""),
  z.coerce.number().int().min(0).max(20),
]);

export const recommendationSchema = z.object({
  enrollmentId: z.string().uuid(),
  term: z.coerce.number().int().min(1).max(4),
  text: z.string().max(300, "La recomendación admite hasta 300 caracteres."),
});
