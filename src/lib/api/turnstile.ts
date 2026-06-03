const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileSiteverifyResponse = {
  success?: unknown;
  hostname?: unknown;
  "error-codes"?: unknown;
};

export type VerifyTurnstileTokenResult =
  | { ok: true; hostname: string | null }
  | {
      ok: false;
      reason: "invalid";
      errorCodes: Array<string>;
      hostname: string | null;
    }
  | {
      ok: false;
      reason: "unavailable";
      cause:
        | "missing_secret"
        | "invalid_secret"
        | "request_failed"
        | "bad_response_status"
        | "invalid_response_body";
      errorCodes: Array<string>;
      hostname: string | null;
      status: number | null;
    };

type TurnstileLogDetails = Record<
  string,
  boolean | number | string | Array<string> | null | undefined
>;

function logTurnstileEvent(
  level: "info" | "warn" | "error",
  message: string,
  details: TurnstileLogDetails,
) {
  console[level]("[turnstile]", {
    message,
    ...details,
  });
}

function getTurnstileSecretKey() {
  const secretKey = process.env.LEGALIZIRAJMO_TURNSTILE_SECRET_KEY?.trim();

  return secretKey ? secretKey : null;
}

function getExpectedHostname() {
  const hostname =
    process.env.LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME?.trim().toLowerCase();

  return hostname ? hostname : null;
}

function isTurnstileSiteverifyResponse(
  value: unknown,
): value is TurnstileSiteverifyResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTurnstileHostname(result: TurnstileSiteverifyResponse) {
  if (typeof result.hostname !== "string") {
    return null;
  }

  const hostname = result.hostname.trim().toLowerCase();
  return hostname ? hostname : null;
}

function getTurnstileErrorCodes(result: TurnstileSiteverifyResponse) {
  if (!Array.isArray(result["error-codes"])) {
    return [];
  }

  return result["error-codes"].filter(
    (errorCode): errorCode is string => typeof errorCode === "string",
  );
}

function hasBooleanSuccess(result: TurnstileSiteverifyResponse) {
  return typeof result.success === "boolean";
}

function hasInvalidSecretError(errorCodes: Array<string>) {
  return (
    errorCodes.includes("missing-input-secret") ||
    errorCodes.includes("invalid-input-secret")
  );
}

export async function verifyTurnstileToken(
  token: string,
  options: { remoteIp?: string | null } = {},
): Promise<VerifyTurnstileTokenResult> {
  const secretKey = getTurnstileSecretKey();
  const expectedHostname = getExpectedHostname();

  logTurnstileEvent("info", "Starting Turnstile verification.", {
    captchaTokenPresent: true,
    secretConfigured: secretKey !== null,
    expectedHostnameConfigured: expectedHostname !== null,
    remoteIpPresent: Boolean(options.remoteIp),
  });

  if (!secretKey) {
    logTurnstileEvent("error", "Turnstile secret key is missing.", {
      captchaTokenPresent: true,
      secretConfigured: false,
      expectedHostnameConfigured: expectedHostname !== null,
    });

    return {
      ok: false,
      reason: "unavailable",
      cause: "missing_secret",
      errorCodes: [],
      hostname: null,
      status: null,
    };
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (options.remoteIp) {
    body.set("remoteip", options.remoteIp);
  }

  let response: Response;

  try {
    response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });
  } catch (error) {
    logTurnstileEvent("error", "Turnstile siteverify request failed.", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      remoteIpPresent: Boolean(options.remoteIp),
    });

    return {
      ok: false,
      reason: "unavailable",
      cause: "request_failed",
      errorCodes: [],
      hostname: null,
      status: null,
    };
  }

  if (!response.ok) {
    logTurnstileEvent("error", "Turnstile siteverify returned a bad status.", {
      status: response.status,
      statusText: response.statusText,
    });

    return {
      ok: false,
      reason: "unavailable",
      cause: "bad_response_status",
      errorCodes: [],
      hostname: null,
      status: response.status,
    };
  }

  let resultJson: unknown;

  try {
    resultJson = await response.json();
  } catch (error) {
    logTurnstileEvent("error", "Turnstile siteverify returned invalid JSON.", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      status: response.status,
    });

    return {
      ok: false,
      reason: "unavailable",
      cause: "invalid_response_body",
      errorCodes: [],
      hostname: null,
      status: response.status,
    };
  }

  if (
    !isTurnstileSiteverifyResponse(resultJson) ||
    !hasBooleanSuccess(resultJson)
  ) {
    logTurnstileEvent(
      "error",
      "Turnstile siteverify returned an unexpected response shape.",
      {
        status: response.status,
      },
    );

    return {
      ok: false,
      reason: "unavailable",
      cause: "invalid_response_body",
      errorCodes: [],
      hostname: null,
      status: response.status,
    };
  }

  const result = resultJson;
  const hostname = getTurnstileHostname(result);
  const errorCodes = getTurnstileErrorCodes(result);

  if (result.success !== true) {
    if (hasInvalidSecretError(errorCodes)) {
      logTurnstileEvent("error", "Turnstile rejected the configured secret.", {
        errorCodes,
        hostname,
      });

      return {
        ok: false,
        reason: "unavailable",
        cause: "invalid_secret",
        errorCodes,
        hostname,
        status: response.status,
      };
    }

    logTurnstileEvent("warn", "Turnstile rejected the captcha token.", {
      errorCodes,
      hostname,
    });

    return {
      ok: false,
      reason: "invalid",
      errorCodes,
      hostname,
    };
  }

  if (expectedHostname && hostname !== expectedHostname) {
    logTurnstileEvent("warn", "Turnstile hostname mismatch.", {
      expectedHostname,
      hostname,
    });

    return {
      ok: false,
      reason: "invalid",
      errorCodes,
      hostname,
    };
  }

  logTurnstileEvent("info", "Turnstile verification succeeded.", {
    hostname,
  });

  return {
    ok: true,
    hostname,
  };
}
