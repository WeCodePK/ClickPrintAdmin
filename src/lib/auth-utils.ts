/** Normalize local PK numbers like 0323… to 92323… for the auth API. */
export function normalizePhoneNumber(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("92") && digits.length >= 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length >= 11) {
    return `92${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `92${digits}`;
  }

  return digits;
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getIsAdminFromToken(token: string) {
  const payload = decodeJwtPayload(token);
  return Boolean(payload?.isAdmin);
}
