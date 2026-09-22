import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Keys share the rateLimit table with Better Auth's own limiter, whose keys
// never start with this prefix.
const PREFIX = "action:";

export type RateLimitRule = {
  /** Length of the window, in seconds. Keep it at 60 or under, or Better Auth's pruning deletes rows early. */
  window: number;
  /** Attempts allowed in one window. */
  max: number;
};

/**
 * Counts one attempt against `key` and says whether it's allowed. The window
 * starts at the first attempt and resets once it has passed. One SQL statement
 * does the whole count, so two requests at once can't both slip under the limit.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowMs = rule.window * 1000;
  const windowStart = BigInt(now - windowMs);
  const fullKey = PREFIX + key;

  const [row] = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${randomUUID()}, ${fullKey}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rateLimit"."lastRequest" <= ${windowStart}
        THEN 1 ELSE "rateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "rateLimit"."lastRequest" <= ${windowStart}
        THEN ${BigInt(now)} ELSE "rateLimit"."lastRequest" END
    RETURNING "count", "lastRequest"`;

  // Old rows would otherwise pile up, one for every email anyone ever tried.
  await prisma.rateLimit.deleteMany({
    where: { key: { startsWith: PREFIX }, lastRequest: { lte: windowStart } },
  });

  const retryAfter = Math.ceil((Number(row.lastRequest) + windowMs - now) / 1000);
  return { allowed: row.count <= rule.max, retryAfter };
}

/** The client's IP. Vercel sets x-forwarded-for itself, so a client can't fake it there. */
export function clientIp(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip") || "unknown";
}
