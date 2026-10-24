import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts } from "@/db/schema";
import { handleError, requireUser } from "@/lib/session";
import { loadConfig } from "@/lib/prompt";

export const runtime = "nodejs";

/** Current user's own info, quick prompts and learned memory (for the "my profile" drawer). */
export async function GET() {
  try {
    const user = await requireUser();
    const config = await loadConfig();
    const facts = await getDb()
      .select()
      .from(childMemoryFacts)
      .where(eq(childMemoryFacts.userId, user.id))
      .orderBy(desc(childMemoryFacts.createdAt));
    return NextResponse.json({
      user: { id: user.id, displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl },
      quickPrompts: config.quickPrompts,
      facts,
    });
  } catch (err) {
    return handleError(err);
  }
}
