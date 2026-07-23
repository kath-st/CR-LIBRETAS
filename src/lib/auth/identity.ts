export const INTERNAL_AUTH_DOMAIN = "auth.cristoredentor.local";

export function dniToInternalEmail(dni: string) {
  return `${dni.trim()}@${INTERNAL_AUTH_DOMAIN}`;
}

export function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();

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

  if (normalized.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  return "No se pudo completar la operación. Inténtalo nuevamente.";
}

