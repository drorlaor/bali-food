import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childStaticProfiles, users } from "@/db/schema";
import { defaultChildProfile } from "@/db/seed";
import { handleError, HttpError, requireParent } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireParent();
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) throw new HttpError(400, "userId is required");
    const db = getDb();
    const u = await db.select().from(users).where(eq(users.id, userId)).get();
    if (!u || u.role !== "child") throw new HttpError(404, "Child not found");
    let profile = await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, userId)).get();
    if (!profile) {
      await db.insert(childStaticProfiles).values({ userId, ...defaultChildProfile(), updatedAt: new Date().toISOString() });
      profile = await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, userId)).get();
    }
    return NextResponse.json({ profile });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await requireParent();
    const b = (await req.json()) as {
      userId?: string;
      birthYear?: number;
      activityProfile?: string;
      kitchenPermissions?: string;
      medicalOrDietaryNotes?: string;
      parentCustomDirectives?: string;
    };
    if (!b.userId) throw new HttpError(400, "userId is required");
    const year = Number(b.birthYear);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < thisYear - 25 || year > thisYear) throw new HttpError(400, "Invalid birthYear");
    const values = {
      birthYear: year,
      activityProfile: String(b.activityProfile || ""),
      kitchenPermissions: String(b.kitchenPermissions || ""),
      medicalOrDietaryNotes: String(b.medicalOrDietaryNotes || ""),
      parentCustomDirectives: String(b.parentCustomDirectives || ""),
      updatedAt: new Date().toISOString(),
    };
    const db = getDb();
    await db
      .insert(childStaticProfiles)
      .values({ userId: b.userId, ...values })
      .onConflictDoUpdate({ target: childStaticProfiles.userId, set: values });
    const profile = await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, b.userId)).get();
    return NextResponse.json({ profile });
  } catch (err) {
    return handleError(err);
  }
}
