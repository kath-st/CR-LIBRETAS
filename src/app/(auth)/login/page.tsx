import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { destinationFor, getAccessProfile } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage() {
  const profile = await getAccessProfile();
  if (profile) redirect(destinationFor(profile));
  return <LoginForm />;
}
