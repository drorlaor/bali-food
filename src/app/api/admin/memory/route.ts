import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, MEMORY_CATEGORIES, NUTRITIONAL_GROUPS, type MemoryCategory, type NutritionalGroup } from "@/db/schema";
import { handleError, HttpError, requireParent } from "@/lib/session";

export const runtime = "nodejs";

function validate(b: { category?: string; nutritionalGroup?: string; itemOrFact?: string }) {
  if (!MEMORY_CATEGORIES.includes(b.category as MemoryCategory)) throw new HttpError(400, "Invalid category");
  if (!NUTRITIONAL_GROUPS.includes(b.nutritionalGroup as NutritionalGroup)) throw new HttpError(400, "Invalid nutritionalGroup");
  if (!b.itemOrFact?.trim()) throw new HttpError(400, "itemOrFact is required");
}

export async function GET(req: Request) {
  try {
    await requireParent();
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) throw new HttpError(400, "userId is required");
    const facts = await getDb()
      .select()
      .from(childMemoryFacts)
      .where(eq(childMemoryFacts.userId, userId))
      .orderBy(desc(childMemoryFacts.createdAt));
    return NextResponse.json({ facts });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireParent();
    const b = (await req.json()) as { userId?: string; category?: string; nutritionalGroup?: string; itemOrFact?: string; notes?: string };
    if (!b.userId) throw new HttpError(400, "userId is required");
    validate(b);
    const id = crypto.randomUUID();
    await getDb().insert(childMemoryFacts).values({
      id,
      userId: b.userId,
      category: b.category as MemoryCategory,
      nutritionalGroup: b.nutritionalGroup as NutritionalGroup,
      itemOrFact: b.itemOrFact!.trim(),
      notes: b.notes?.trim() || null,
      createdBy: "parent",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireParent();
    const b = (await req.json()) as { id?: string; category?: string; nutritionalGroup?: string; itemOrFact?: string; notes?: string };
    if (!b.id) throw new HttpError(400, "id is required");
    validate(b);
    await getDb()
      .update(childMemoryFacts)
      .set({
        category: b.category as MemoryCategory,
        nutritionalGroup: b.nutritionalGroup as NutritionalGroup,
        itemOrFact: b.itemOrFact!.trim(),
        notes: b.notes?.trim() || null,
      })
      .where(eq(childMemoryFacts.id, b.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireParent();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new HttpError(400, "id is required");
    await getDb().delete(childMemoryFacts).where(eq(childMemoryFacts.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
