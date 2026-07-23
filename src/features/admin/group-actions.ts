"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const groupSchema = z
  .object({
    academicYear: z.coerce.number().int().min(2020).max(2100),
    level: z.enum(["primaria", "secundaria"]),
    grade: z.coerce.number().int(),
    section: z.string().trim().min(1).max(30),
    displayName: z.string().trim().max(120),
    teacherId: z.string().uuid(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    const maximum = value.level === "primaria" ? 6 : 5;
    if (value.grade < 1 || value.grade > maximum) {
      context.addIssue({
        code: "custom",
        message: `El grado debe estar entre 1 y ${maximum}.`,
        path: ["grade"],
      });
    }
  });

function groupsDestination(kind: "error" | "success", message: string) {
  return `/admin/grupos?${kind}=${encodeURIComponent(message)}`;
}

function labelForGrade(grade: number) {
  return `${grade}${grade === 1 || grade === 3 ? "ro" : grade === 2 ? "do" : "to"}`;
}

function parseGroupForm(formData: FormData) {
  return groupSchema.safeParse({
    academicYear: formData.get("academicYear"),
    level: formData.get("level"),
    grade: formData.get("grade"),
    section: formData.get("section"),
    displayName: formData.get("displayName") ?? "",
    teacherId: formData.get("teacherId"),
    active: formData.get("active") !== "false",
  });
}

export async function createGroupAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parseGroupForm(formData);

  if (!parsed.success) {
    redirect(
      groupsDestination(
        "error",
        parsed.error.issues[0]?.message ?? "Revisa los datos del grupo.",
      ),
    );
  }

  const value = parsed.data;
  const displayName =
    value.displayName ||
    `${value.academicYear} - ${value.level === "primaria" ? "Primaria" : "Secundaria"} - ${labelForGrade(value.grade)} - ${value.section}`;
  const supabase = await createClient();
  const { error } = await supabase.from("academic_groups").insert({
    academic_year: value.academicYear,
    level: value.level,
    grade: value.grade,
    section: value.section,
    display_name: displayName,
    teacher_id: value.teacherId,
    active: value.active,
    created_by: admin.id,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe un grupo con ese año, nivel, grado y sección."
      : "No se pudo crear el grupo. Verifica que la docente esté activa.";
    redirect(groupsDestination("error", message));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  redirect(groupsDestination("success", "Grupo creado y asignado."));
}

export async function updateGroupAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = parseGroupForm(formData);

  if (!id.success || !parsed.success) {
    redirect(groupsDestination("error", "Revisa los datos del grupo."));
  }

  const value = parsed.data;
  const displayName =
    value.displayName ||
    `${value.academicYear} - ${value.level === "primaria" ? "Primaria" : "Secundaria"} - ${labelForGrade(value.grade)} - ${value.section}`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_groups")
    .update({
      academic_year: value.academicYear,
      level: value.level,
      grade: value.grade,
      section: value.section,
      display_name: displayName,
      teacher_id: value.teacherId,
      active: value.active,
    })
    .eq("id", id.data);

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe otro grupo con esos datos."
      : "No se pudo actualizar el grupo.";
    redirect(groupsDestination("error", message));
  }

  revalidatePath("/admin/grupos");
  revalidatePath("/grupos");
  redirect(groupsDestination("success", "Grupo actualizado."));
}

