import { createHmac } from "node:crypto";

import { lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { apiRateLimitWindows } from "@/db/schema";
import { getRequestClientIp } from "@/lib/api/request-client-ip";

type RateLimitConfig = {
  scope: string;
  limit: number;
  windowMs: number;
};

type CheckRateLimitResult = {
  rateLimited: boolean;
  retryAfterSeconds: number | null;
};

function getRateLimitSecret() {
  const authSecret = process.env.AUTH_SECRET;

  if (!authSecret) {
    throw new Error("AUTH_SECRET is required for rate limiting.");
  }

  return authSecret;
}

function hashClientIdentifier(clientIdentifier: string) {
  return createHmac("sha256", getRateLimitSecret())
    .update(clientIdentifier)
    .digest("hex");
}

function getWindowStart(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function getRetryAfterSeconds(now: Date, expiresAt: Date) {
  return Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
): Promise<CheckRateLimitResult> {
  const clientIdentifier = getRequestClientIp(request);

  if (!clientIdentifier) {
    return {
      rateLimited: false,
      retryAfterSeconds: null,
    };
  }

  const now = new Date();
  const windowStart = getWindowStart(now, config.windowMs);
  const expiresAt = new Date(windowStart.getTime() + config.windowMs);
  const identifierHash = hashClientIdentifier(clientIdentifier);

  await db
    .delete(apiRateLimitWindows)
    .where(lte(apiRateLimitWindows.expiresAt, now));

  const [window] = await db
    .insert(apiRateLimitWindows)
    .values({
      scope: config.scope,
      identifierHash,
      windowStart,
      expiresAt,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [
        apiRateLimitWindows.scope,
        apiRateLimitWindows.identifierHash,
        apiRateLimitWindows.windowStart,
      ],
      set: {
        count: sql`${apiRateLimitWindows.count} + 1`,
        expiresAt,
      },
    })
    .returning({
      count: apiRateLimitWindows.count,
      expiresAt: apiRateLimitWindows.expiresAt,
    });

  if (window.count > config.limit) {
    return {
      rateLimited: true,
      retryAfterSeconds: getRetryAfterSeconds(now, window.expiresAt),
    };
  }

  return {
    rateLimited: false,
    retryAfterSeconds: null,
  };
}
