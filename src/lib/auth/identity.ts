export const INTERNAL_AUTH_DOMAIN = "usuarios.cristoredentor.edu.pe";
export const LEGACY_INTERNAL_AUTH_DOMAIN = "auth.cristoredentor.local";

export function dniToInternalEmail(dni: string) {
  return `${dni.trim()}@${INTERNAL_AUTH_DOMAIN}`;
}

export function internalEmailsForDni(dni: string) {
  const normalizedDni = dni.trim();
  return [
    `${normalizedDni}@${INTERNAL_AUTH_DOMAIN}`,
    `${normalizedDni}@${LEGACY_INTERNAL_AUTH_DOMAIN}`,
  ];
}

export function authErrorMessage(message: string, code?: string) {
  const normalized = message.toLowerCase();
  const normalizedCode = code?.toLowerCase();

  if (
    normalizedCode === "email_address_invalid" ||
    normalized.includes("email address is invalid") ||
    normalized.includes("invalid email")
  ) {
    return "Supabase rechazó la identidad interna de esta cuenta. Actualiza la aplicación e inténtalo nuevamente.";
  }

  if (
    normalizedCode === "email_provider_disabled" ||
    normalized.includes("signups not allowed") ||
    normalized.includes("signup is disabled")
  ) {
    return "El registro de cuentas está deshabilitado en Supabase Auth.";
  }

  if (
    normalizedCode === "email_exists" ||
    normalizedCode === "user_already_exists"
  ) {
    return "Ya existe una solicitud asociada a este DNI.";
  }

  if (
    normalizedCode === "over_email_send_rate_limit" ||
    normalized.includes("email rate limit")
  ) {
    return "Supabase alcanzó el límite de correos. Desactiva Confirm Email en Authentication → Providers → Email, guarda el cambio y espera 60 segundos antes de reintentar.";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "El DNI o la contraseña no son correctos.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already been registered")
  ) {
    return "Ya existe una solicitud asociada a este DNI.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Se realizaron demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }

  if (
    normalized.includes("database error") ||
    normalized.includes("saving new user")
  ) {
    return "Supabase no pudo crear el perfil docente. Revisa el trigger on_auth_user_created.";
  }

  if (normalized.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  return "No se pudo completar la operación. Inténtalo nuevamente.";
}
