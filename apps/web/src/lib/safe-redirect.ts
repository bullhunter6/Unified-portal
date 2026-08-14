const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const ENCODED_SEPARATOR_OR_CONTROL = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;
const SCHEME_AFTER_ROOT = /^\/[a-z][a-z0-9+.-]*:/i;

export function safeRelativePath(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    CONTROL_OR_BACKSLASH.test(value) ||
    ENCODED_SEPARATOR_OR_CONTROL.test(value) ||
    SCHEME_AFTER_ROOT.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, "https://local.invalid");
    return parsed.origin === "https://local.invalid" ? value : null;
  } catch {
    return null;
  }
}

export function safeSameOriginResultPath(
  value: string | null | undefined,
  origin: string,
): string | null {
  if (!value) return null;

  try {
    const expectedOrigin = new URL(origin).origin;
    const parsed = new URL(value, expectedOrigin);
    if (parsed.origin !== expectedOrigin) return null;

    return safeRelativePath(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch {
    return null;
  }
}
