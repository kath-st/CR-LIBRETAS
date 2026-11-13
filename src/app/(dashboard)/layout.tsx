import type { ReactNode } from "react";
import { DashboardSessionBoundary } from "@/components/dashboard/DashboardSessionBoundary";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardSessionBoundary>{children}</DashboardSessionBoundary>
  );
}
