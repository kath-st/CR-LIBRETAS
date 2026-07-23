import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/features/auth/ChangePasswordForm";
import { destinationFor, getAccessProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Cambiar contraseña",
};

export default async function ChangePasswordPage() {
  const profile = await getAccessProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "activo" || !profile.must_change_password) {
    redirect(destinationFor(profile));
  }

  return <ChangePasswordForm />;
}

