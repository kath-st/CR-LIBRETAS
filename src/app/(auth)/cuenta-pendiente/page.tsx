import type { Metadata } from "next";
import { PendingAccount } from "@/features/auth/PendingAccount";

export const metadata: Metadata = {
  title: "Cuenta pendiente",
};

export default function PendingAccountPage() {
  return <PendingAccount />;
}
