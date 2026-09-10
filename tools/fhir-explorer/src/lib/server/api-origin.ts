function configuredOrigins(): string[] | null {
  const configured = process.env.EXPLORER_ALLOWED_ORIGINS?.trim();
  if (!configured) return null;

  return configured
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value) => {
      try {
        return new URL(value).origin === value;
      } catch {
        return false;
      }
    });
}

export function applicationOrigin(headers: Headers, fallback: string): string {
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? headers.get("host");
  if (!host) return fallback;

  const protocol =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(fallback).protocol.slice(0, -1);
  return `${protocol}://${host}`;
}

export function isAllowedOrigin(origin: string | null, applicationOrigin: string): boolean {
  if (!origin) return true;
  return (configuredOrigins() ?? [applicationOrigin]).includes(origin);
}
