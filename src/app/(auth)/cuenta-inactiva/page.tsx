import type { Metadata } from "next";
import { InactiveAccount } from "@/features/auth/InactiveAccount";

export const metadata: Metadata = {
  title: "Cuenta inactiva",
};

export default function InactiveAccountPage() {
  return <InactiveAccount />;
}
