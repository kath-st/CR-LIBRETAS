import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "docente";
export type ProfileStatus = "pendiente" | "activo" | "inactivo";

export type AccessProfile = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  role: AppRole;
  status: ProfileStatus;
  must_change_password: boolean;
};

export async function getAccessProfile(): Promise<AccessProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, dni, nombres, apellidos, role, status, must_change_password",
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as AccessProfile;
}

export function destinationFor(profile: AccessProfile | null) {
  if (!profile) return "/login";
  if (profile.status === "pendiente") return "/cuenta-pendiente";
  if (profile.status === "inactivo") return "/cuenta-inactiva";
  if (profile.must_change_password) return "/cambiar-contrasena";
  return profile.role === "admin" ? "/admin" : "/grupos";
}

export async function requireActiveUser() {
  const profile = await getAccessProfile();

  if (!profile || profile.status !== "activo" || profile.must_change_password) {
    redirect(destinationFor(profile));
  }

  return profile;
}

export async function requireAdmin() {
  const profile = await requireActiveUser();
  if (profile.role !== "admin") redirect("/grupos");
  return profile;
}

