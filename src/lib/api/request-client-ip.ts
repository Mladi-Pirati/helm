function normalizeClientIdentifier(value: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

export function getRequestClientIp(request: Request) {
  const forwardedForHeader = request.headers.get("x-forwarded-for");

  if (forwardedForHeader) {
    for (const candidate of forwardedForHeader.split(",")) {
      const forwardedIp = normalizeClientIdentifier(candidate);

      if (forwardedIp) {
        return forwardedIp;
      }
    }
  }

  return (
    normalizeClientIdentifier(request.headers.get("x-real-ip")) ??
    normalizeClientIdentifier(request.headers.get("cf-connecting-ip"))
  );
}
