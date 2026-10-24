import { NextResponse } from "next/server";
import { asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { handleError, HttpError, requireParent } from "@/lib/session";

export const runtime = "nodejs";

/** ?userId=... -> list sessions; ?sessionId=... -> full transcript. */
export async function GET(req: Request) {
  try {
    await requireParent();
    const params = new URL(req.url).searchParams;
    const db = getDb();
    const sessionId = params.get("sessionId");
    if (sessionId) {
      const session = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).get();
      if (!session) throw new HttpError(404, "Session not found");
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt));
      return NextResponse.json({ session, messages });
    }
    const userId = params.get("userId");
    if (!userId) throw new HttpError(400, "userId or sessionId is required");
    const sessions = await db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
        messageCount: count(chatMessages.id),
      })
      .from(chatSessions)
      .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
      .where(eq(chatSessions.userId, userId))
      .groupBy(chatSessions.id)
      .orderBy(desc(chatSessions.updatedAt));
    return NextResponse.json({ sessions });
  } catch (err) {
    return handleError(err);
  }
}
