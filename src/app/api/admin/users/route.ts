import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childStaticProfiles, users } from "@/db/schema";
import { defaultChildProfile } from "@/db/seed";
import { handleError, HttpError, requireParent } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireParent();
    const list = await getDb().select().from(users).orderBy(asc(users.role), asc(users.createdAt));
    return NextResponse.json({ users: list });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireParent();
    const body = (await req.json()) as { email?: string; displayName?: string; role?: string; birthYear?: number };
    const email = (body.email || "").toLowerCase().trim();
    const displayName = (body.displayName || "").trim();
    const role = body.role === "parent" ? "parent" : "child";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Invalid email");
    if (!displayName) throw new HttpError(400, "displayName is required");
    const db = getDb();
    const exists = await db.select().from(users).where(eq(users.email, email)).get();
    if (exists) throw new HttpError(409, "Email already exists");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(users).values({ id, email, displayName, role, isActive: true, createdAt: now });
    if (role === "child") {
      const by = Number(body.birthYear) || new Date().getFullYear() - 10;
      await db.insert(childStaticProfiles).values({ userId: id, ...defaultChildProfile(by), updatedAt: now });
    }
    return NextResponse.json({ user: await db.select().from(users).where(eq(users.id, id)).get() });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const parent = await requireParent();
    const body = (await req.json()) as { id?: string; email?: string; displayName?: string; role?: string; isActive?: boolean };
    if (!body.id) throw new HttpError(400, "id is required");
    const db = getDb();
    const target = await db.select().from(users).where(eq(users.id, body.id)).get();
    if (!target) throw new HttpError(404, "User not found");
    if (target.id === parent.id && (body.isActive === false || body.role === "child")) {
      throw new HttpError(400, "You cannot deactivate or demote yourself");
    }
    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.email) patch.email = body.email.toLowerCase().trim();
    if (body.displayName) patch.displayName = body.displayName.trim();
    if (body.role === "parent" || body.role === "child") patch.role = body.role;
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    await db.update(users).set(patch).where(eq(users.id, body.id));
    if (patch.role === "child") {
      const prof = await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, body.id)).get();
      if (!prof) {
        await db.insert(childStaticProfiles).values({ userId: body.id, ...defaultChildProfile(), updatedAt: new Date().toISOString() });
      }
    }
    return NextResponse.json({ user: await db.select().from(users).where(eq(users.id, body.id)).get() });
  } catch (err) {
    return handleError(err);
  }
}
