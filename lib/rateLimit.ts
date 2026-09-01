import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitAttempts } from "@/db/schema";

// Stored in Postgres rather than an in-memory Map or Redis — this app runs
// as a single deployment for now, and a DB-backed counter stays correct even
// if it later runs as multiple server instances (an in-memory counter would
// silently stop working the moment there's more than one process).

/** True if `key` has already hit `maxAttempts` within the last `windowMinutes`. Read-only. */
export async function isRateLimited(
  key: string,
  { maxAttempts, windowMinutes }: { maxAttempts: number; windowMinutes: number }
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(rateLimitAttempts)
    .where(and(eq(rateLimitAttempts.key, key), gt(rateLimitAttempts.createdAt, windowStart)));
  return (row?.value ?? 0) >= maxAttempts;
}

/**
 * Records one attempt against `key`. Also opportunistically deletes this
 * key's rows older than an hour, so the table doesn't grow forever without
 * needing a separate cron/cleanup job.
 */
export async function recordAttempt(key: string): Promise<void> {
  await db.insert(rateLimitAttempts).values({ key });
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await db.delete(rateLimitAttempts).where(and(eq(rateLimitAttempts.key, key), lt(rateLimitAttempts.createdAt, hourAgo)));
}
