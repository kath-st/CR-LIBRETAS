"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dniToInternalEmail } from "@/lib/auth/identity";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const detailsSchema = z.object({
  id: idSchema,
  dni: z.string().trim().regex(/^\d{8}$/),
  nombres: z.string().trim().min(2).max(80),
  apellidos: z.string().trim().min(2).max(100),
});
const temporaryPasswordSchema = z.object({
  id: idSchema,
  password: z.string().min(8).max(72),
});

function docentesDestination(kind: "error" | "success", message: string) {
  return `/admin/docentes?${kind}=${encodeURIComponent(message)}`;
}

async function getTargetTeacher(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, status, dni")
    .eq("id", id)
    .single();
  return data;
}

export async function setTeacherStatusAction(formData: FormData) {
  const adminProfile = await requireAdmin();
  const parsed = z
    .object({
      id: idSchema,
      status: z.enum(["activo", "inactivo"]),
    })
    .safeParse({
      id: formData.get("id"),
      status: formData.get("status"),
    });

  if (!parsed.success) {
    redirect(docentesDestination("error", "La solicitud no es válida."));
  }

  if (parsed.data.id === adminProfile.id) {
    redirect(
      docentesDestination(
        "error",
        "No puedes cambiar el estado de tu propia cuenta.",
      ),
    );
  }

  const target = await getTargetTeacher(parsed.data.id);
  if (!target || target.role !== "docente") {
    redirect(docentesDestination("error", "No se encontró la cuenta docente."));
  }

  if (parsed.data.status === "activo") {
    try {
      const admin = createAdminClient();
      const { error: authError } = await admin.auth.admin.updateUserById(
        parsed.data.id,
        { email_confirm: true },
      );
      if (authError) throw authError;
    } catch {
      redirect(
        docentesDestination(
          "error",
          "No se pudo confirmar la cuenta. Verifica la clave privada del servidor.",
        ),
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) {
    redirect(docentesDestination("error", "No se pudo cambiar el estado."));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/docentes");
  revalidatePath("/admin/grupos");
  redirect(
    docentesDestination(
      "success",
      parsed.data.status === "activo"
        ? "Cuenta docente aprobada y activa."
        : "Cuenta docente desactivada.",
    ),
  );
}

export async function updateTeacherDetailsAction(formData: FormData) {
  await requireAdmin();
  const parsed = detailsSchema.safeParse({
    id: formData.get("id"),
    dni: formData.get("dni"),
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
  });

  if (!parsed.success) {
    redirect(
      docentesDestination(
        "error",
        "Revisa el DNI, los nombres y los apellidos.",
      ),
    );
  }

  const target = await getTargetTeacher(parsed.data.id);
  if (!target || target.role !== "docente") {
    redirect(docentesDestination("error", "No se encontró la cuenta docente."));
  }

  try {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      {
        email: dniToInternalEmail(parsed.data.dni),
        email_confirm: true,
        user_metadata: {
          dni: parsed.data.dni,
          nombres: parsed.data.nombres,
          apellidos: parsed.data.apellidos,
        },
      },
    );
    if (authError) throw authError;
  } catch {
    redirect(
      docentesDestination(
        "error",
        "No se pudo actualizar el acceso. Verifica que el DNI no esté registrado.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      dni: parsed.data.dni,
      nombres: parsed.data.nombres,
      apellidos: parsed.data.apellidos,
    })
    .eq("id", parsed.data.id);

  if (error) {
    redirect(
      docentesDestination(
        "error",
        "El acceso cambió, pero no se pudo actualizar el perfil.",
      ),
    );
  }

  revalidatePath("/admin/docentes");
  redirect(docentesDestination("success", "Datos de la docente actualizados."));
}

export async function setTemporaryPasswordAction(formData: FormData) {
  await requireAdmin();
  const parsed = temporaryPasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      docentesDestination(
        "error",
        "La contraseña temporal debe tener entre 8 y 72 caracteres.",
      ),
    );
  }

  const target = await getTargetTeacher(parsed.data.id);
  if (!target || target.role !== "docente") {
    redirect(docentesDestination("error", "No se encontró la cuenta docente."));
  }

  try {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(
      parsed.data.id,
      { password: parsed.data.password },
    );
    if (authError) throw authError;

    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", parsed.data.id);
    if (profileError) throw profileError;
  } catch {
    redirect(
      docentesDestination(
        "error",
        "No se pudo asignar la contraseña temporal. Revisa la configuración privada.",
      ),
    );
  }

  revalidatePath("/admin/docentes");
  redirect(
    docentesDestination(
      "success",
      "Contraseña temporal asignada. La docente deberá cambiarla al ingresar.",
    ),
  );
}

