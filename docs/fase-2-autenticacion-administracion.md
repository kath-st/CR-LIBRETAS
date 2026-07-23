# Fase 2 — Autenticación y administración

## Alcance implementado

- Registro docente mediante nombres, apellidos, DNI y contraseña.
- Conversión interna del DNI a `{dni}@auth.cristoredentor.local`.
- Creación automática del perfil con estado `pendiente`.
- Login mediante DNI y contraseña.
- Redirección por rol, estado y cambio obligatorio de contraseña.
- Pantallas para cuentas pendientes e inactivas.
- Aprobación, desactivación y reactivación administrativa.
- Corrección de nombres, apellidos y DNI.
- Contraseña temporal administrada exclusivamente por Supabase Auth.
- Cambio obligatorio de la contraseña temporal al siguiente ingreso.
- Creación, edición, activación y asignación de grupos.
- Vista docente limitada a sus grupos por RLS.

## 1. Aplicar la migración

Desde la terminal de VS Code:

```powershell
npx supabase migration list
npm run db:push
npx supabase migration list
```

La versión `20260723000200` debe aparecer tanto en `Local` como en `Remote`.

## 2. Configurar Supabase Auth

El correo es sintético y no recibe mensajes. En el panel de Supabase:

1. Abrir **Authentication → Providers → Email**.
2. Mantener habilitado el acceso por email y contraseña.
3. Deshabilitar la confirmación por email.

La aprobación institucional se controla con `profiles.status`, no mediante un
enlace de correo.

## 3. Configurar la clave privada

Crear una nueva clave secreta en la sección de API Keys de Supabase. La clave
compartida anteriormente debe considerarse expuesta y debe rotarse.

Agregar solamente en `.env.local`:

```text
SUPABASE_SECRET_KEY=valor_privado_nuevo
```

No utilizar prefijos `NEXT_PUBLIC_`, no colocar el valor en `.env.example` y no
subirlo a Git. Esta clave se utiliza solo en el servidor para confirmar usuarios,
corregir su DNI y asignar contraseñas temporales.

## 4. Crear la primera administradora

1. Registrar la cuenta de la directora desde `/registro`.
2. En **Supabase → SQL Editor**, reemplazar el DNI y ejecutar:

```sql
update public.profiles
set role = 'admin',
    status = 'activo'
where dni = 'DNI_DE_LA_DIRECTORA';
```

El DNI debe tener exactamente ocho dígitos. Este procedimiento se utiliza una
sola vez; las demás cuentas se aprueban desde `/admin/docentes`.

## 5. Flujo de comprobación

1. Ingresar como administradora.
2. Registrar otra cuenta docente en una ventana privada.
3. Confirmar que quede en `/cuenta-pendiente`.
4. Aprobarla desde `/admin/docentes`.
5. Crear un grupo desde `/admin/grupos` y asignarlo a esa docente.
6. Ingresar como docente y confirmar que solo vea su grupo.
7. Asignar una contraseña temporal.
8. Ingresar con ella y confirmar la redirección a `/cambiar-contrasena`.

## Seguridad

- Supabase Auth administra contraseñas y sesiones.
- La clave privada solo se importa desde módulos de servidor.
- Todas las acciones administrativas vuelven a validar una sesión administradora.
- No existe eliminación de cuentas docentes; se desactivan.
- La base impide asignar grupos a cuentas pendientes o inactivas.
- El cambio del hash de contraseña en `auth.users` elimina automáticamente la
  obligación de cambio, sin exponer una función que el cliente pueda omitir.

