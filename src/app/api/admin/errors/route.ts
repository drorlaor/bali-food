import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { aiErrorLogs, users } from "@/db/schema";
import { handleError, requireParent } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireParent();
    const db = getDb();

    const logs = await db
      .select({
        id: aiErrorLogs.id,
        userId: aiErrorLogs.userId,
        userName: users.displayName,
        userEmail: users.email,
        sessionId: aiErrorLogs.sessionId,
        modelName: aiErrorLogs.modelName,
        errorCode: aiErrorLogs.errorCode,
        errorMessage: aiErrorLogs.errorMessage,
        promptSummary: aiErrorLogs.promptSummary,
        createdAt: aiErrorLogs.createdAt,
      })
      .from(aiErrorLogs)
      .leftJoin(users, eq(aiErrorLogs.userId, users.id))
      .orderBy(desc(aiErrorLogs.createdAt))
      .limit(100);

    return NextResponse.json({ logs });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireParent();
    const db = getDb();
    const params = new URL(req.url).searchParams;
    const logId = params.get("id");

    if (logId) {
      await db.delete(aiErrorLogs).where(eq(aiErrorLogs.id, logId));
    } else {
      await db.delete(aiErrorLogs);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
