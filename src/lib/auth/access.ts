import { z } from "zod";

export const ACCESS_PROFILE_COLUMNS =
  "id, dni, nombres, apellidos, role, status, must_change_password";
export const ACCESS_PROFILE_STORAGE_KEY = "cr-libretas-access-profile";

export const accessProfileSchema = z.object({
  id: z.string().uuid(),
  dni: z.string().regex(/^\d{8}$/),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  role: z.enum(["admin", "docente"]),
  status: z.enum(["pendiente", "activo", "inactivo"]),
  must_change_password: z.boolean(),
});

export type AccessProfile = z.infer<typeof accessProfileSchema>;
export type AppRole = AccessProfile["role"];
export type ProfileStatus = AccessProfile["status"];

export function destinationFor(profile: AccessProfile | null): string {
  if (!profile) return "/login";
  if (profile.status === "pendiente") return "/cuenta-pendiente";
  if (profile.status === "inactivo") return "/cuenta-inactiva";
  if (profile.must_change_password) return "/cambiar-contrasena";

  switch (profile.role) {
    case "admin":
      return "/admin";
    case "docente":
      return "/grupos";
  }
}
