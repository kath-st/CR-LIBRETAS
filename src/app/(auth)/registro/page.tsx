import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta docente",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
