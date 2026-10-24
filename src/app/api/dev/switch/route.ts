import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ensureDb } from "@/db/seed";
import { DEV_COOKIE, isDevBypass } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  if (!isDevBypass()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  await ensureDb();
  const list = await getDb()
    .select({ email: users.email, displayName: users.displayName, role: users.role })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.role), asc(users.displayName));
  return NextResponse.json({ users: list });
}

export async function POST(req: Request) {
  if (!isDevBypass()) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { email } = (await req.json()) as { email?: string };
  const res = NextResponse.json({ ok: true });
  if (email) res.cookies.set(DEV_COOKIE, email, { path: "/", httpOnly: true, sameSite: "lax" });
  else res.cookies.delete(DEV_COOKIE);
  return res;
}
