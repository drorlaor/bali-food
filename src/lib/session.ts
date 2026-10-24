import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { ensureDb } from "@/db/seed";

export const DEV_COOKIE = "bali_dev_user";

export function isDevBypass(): boolean {
  return process.env.DEV_BYPASS_AUTH === "true";
}

/** Resolves the current allowlisted, active user (or null). */
export async function getCurrentUser(): Promise<User | null> {
  await ensureDb();
  const db = getDb();

  if (isDevBypass()) {
    const store = await cookies();
    const devEmail = store.get(DEV_COOKIE)?.value;
    if (devEmail) {
      const u = await db
        .select()
        .from(users)
        .where(and(eq(users.email, devEmail), eq(users.isActive, true)))
        .get();
      if (u) return u;
    }
  }

  let email: string | undefined;
  try {
    const session = await auth();
    email = session?.user?.email?.toLowerCase();
  } catch {
    email = undefined;
  }

  if (!email && isDevBypass()) {
    // Default to the first parent in dev mode.
    return (await db.select().from(users).where(and(eq(users.role, "parent"), eq(users.isActive, true))).get()) || null;
  }
  if (!email) return null;
  const u = await db.select().from(users).where(eq(users.email, email)).get();
  return u && u.isActive ? u : null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Unauthorized");
  return u;
}

export async function requireParent(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "parent") throw new HttpError(403, "Forbidden - parents only");
  return u;
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(err);
  const msg = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
