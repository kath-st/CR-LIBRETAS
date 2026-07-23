import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { destinationFor, getAccessProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Crear cuenta docente",
};

export default async function RegisterPage() {
  const profile = await getAccessProfile();
  if (profile) redirect(destinationFor(profile));
  return <RegisterForm />;
}
