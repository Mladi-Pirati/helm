const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileSiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

export type VerifyTurnstileTokenResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unavailable" };

function getTurnstileSecretKey() {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  return secretKey ? secretKey : null;
}

function getExpectedHostname() {
  const hostname = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim().toLowerCase();

  return hostname ? hostname : null;
}

function isTurnstileSuccessResult(result: TurnstileSiteverifyResponse) {
  return result.success === true;
}

export async function verifyTurnstileToken(
  token: string,
  options: { remoteIp?: string | null } = {},
): Promise<VerifyTurnstileTokenResult> {
  const secretKey = getTurnstileSecretKey();

  if (!secretKey) {
    return {
      ok: false,
      reason: "unavailable",
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
  } catch {
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  let result: TurnstileSiteverifyResponse;

  try {
    result = (await response.json()) as TurnstileSiteverifyResponse;
  } catch {
    return {
      ok: false,
      reason: "unavailable",
    };
  }

  if (!isTurnstileSuccessResult(result)) {
    return {
      ok: false,
      reason: "invalid",
    };
  }

  const expectedHostname = getExpectedHostname();

  if (
    expectedHostname &&
    result.hostname?.trim().toLowerCase() !== expectedHostname
  ) {
    return {
      ok: false,
      reason: "invalid",
    };
  }

  return { ok: true };
}
