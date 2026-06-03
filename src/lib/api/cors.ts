const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization"] as const;
const DEFAULT_EXPOSED_HEADERS = ["Content-Disposition"] as const;
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;
const DEFAULT_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

const exactAllowedHosts = new Set(["legalizirajmo.si"]);
const allowedHostSuffixes = [
  "mladipirati.si",
  "prt.si",
  "piratskastranka.si",
  "localhost"
] as const;

type CorsOptions = {
  methods?: ReadonlyArray<string>;
};

function isAllowedHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  if (exactAllowedHosts.has(normalizedHostname)) {
    return true;
  }

  return allowedHostSuffixes.some(
    (suffix) =>
      normalizedHostname === suffix ||
      normalizedHostname.endsWith(`.${suffix}`),
  );
}

function getAllowedOrigin(origin: string | null) {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return isAllowedHostname(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

function appendVary(headers: Headers, value: string) {
  const existingValue = headers.get("Vary");

  if (!existingValue) {
    headers.set("Vary", value);
    return;
  }

  const values = existingValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!values.some((part) => part.toLowerCase() === value.toLowerCase())) {
    headers.set("Vary", [...values, value].join(", "));
  }
}

function applyCorsHeaders(
  headers: Headers,
  origin: string | null,
  methods: ReadonlyArray<string>,
) {
  appendVary(headers, "Origin");
  appendVary(headers, "Access-Control-Request-Method");
  appendVary(headers, "Access-Control-Request-Headers");

  headers.set("Access-Control-Allow-Methods", methods.join(", "));
  headers.set(
    "Access-Control-Allow-Headers",
    DEFAULT_ALLOWED_HEADERS.join(", "),
  );
  headers.set(
    "Access-Control-Expose-Headers",
    DEFAULT_EXPOSED_HEADERS.join(", "),
  );
  headers.set("Access-Control-Max-Age", String(DEFAULT_MAX_AGE_SECONDS));

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
}

export function withCors(
  request: Request,
  response: Response,
  options: CorsOptions = {},
) {
  const corsResponse = new Response(response.body, response);
  const allowedOrigin = getAllowedOrigin(request.headers.get("origin"));

  applyCorsHeaders(
    corsResponse.headers,
    allowedOrigin,
    options.methods ?? DEFAULT_METHODS,
  );

  return corsResponse;
}

export function createCorsPreflightResponse(
  request: Request,
  options: CorsOptions = {},
) {
  const originHeader = request.headers.get("origin");
  const allowedOrigin = getAllowedOrigin(originHeader);
  const headers = new Headers();

  applyCorsHeaders(headers, allowedOrigin, options.methods ?? DEFAULT_METHODS);

  return new Response(null, {
    status: originHeader && !allowedOrigin ? 403 : 204,
    headers,
  });
}
