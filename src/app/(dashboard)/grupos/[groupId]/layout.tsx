import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { GroupWorkspace } from "@/features/groups/GroupWorkspace";

export default async function SelectedGroupLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<unknown>;
}>) {
  const resolved = (await params) as { groupId?: unknown };
  if (typeof resolved.groupId !== "string") notFound();
  const groupId = resolved.groupId;
  return <GroupWorkspace groupId={groupId}>{children}</GroupWorkspace>;
}
