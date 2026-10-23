const fbclidPattern = /^[A-Za-z0-9._-]{1,200}$/;
const fbcPattern = /^fb\.1\.\d{10,16}\.([A-Za-z0-9._-]{1,200})$/;

export function validFbclid(value: unknown): value is string {
  return typeof value === "string" && fbclidPattern.test(value);
}

export function validFbc(value: unknown): value is string {
  return typeof value === "string" && fbcPattern.test(value);
}

export function fbcForClickId(clickId: unknown, timestamp = Date.now()): string | undefined {
  if (!validFbclid(clickId) || !Number.isSafeInteger(timestamp) || timestamp < 1_000_000_000 || timestamp > 9_999_999_999_999_999) return undefined;
  return `fb.1.${timestamp}.${clickId}`;
}

export function fbcHasClickId(fbc: unknown, clickId: string): boolean {
  return validFbc(fbc) && fbcPattern.exec(fbc)?.[1] === clickId;
}
