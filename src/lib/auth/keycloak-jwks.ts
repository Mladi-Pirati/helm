import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTPayload } from "jose";

let config:
  | {
      jwks: ReturnType<typeof createRemoteJWKSet>;
      issuer: string;
    }
  | undefined;

function getVerificationConfig() {
  if (!config) {
    const rawIssuer = process.env.KEYCLOAK_ISSUER;

    if (!rawIssuer) {
      throw new Error("KEYCLOAK_ISSUER is not configured");
    }

    const issuer = rawIssuer.replace(/\/+$/, "");
    config = {
      jwks: createRemoteJWKSet(
        new URL(`${issuer}/protocol/openid-connect/certs`),
      ),
      issuer,
    };
  }
  return config;
}

export async function verifyKeycloakAccessToken(
  token: string,
): Promise<JWTPayload> {
  const { jwks, issuer } = getVerificationConfig();
  const { payload } = await jwtVerify(token, jwks, { issuer });
  return payload;
}
