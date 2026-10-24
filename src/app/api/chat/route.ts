import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import type { Content } from "@google/genai";
import { getDb } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { handleError, HttpError, requireUser } from "@/lib/session";
import { buildSystemInstruction } from "@/lib/prompt";
import { runChatTurn } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { sessionId?: string; message?: string };
    const message = (body.message || "").trim().slice(0, 4000);
    if (!message) throw new HttpError(400, "Empty message");

    const db = getDb();
    const now = new Date().toISOString();
    let sessionId = body.sessionId;

    if (sessionId) {
      const s = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).get();
      if (!s || s.userId !== user.id) throw new HttpError(404, "Session not found");
    } else {
      sessionId = crypto.randomUUID();
      await db.insert(chatSessions).values({
        id: sessionId,
        userId: user.id,
        title: message.slice(0, 60),
        createdAt: now,
        updatedAt: now,
      });
    }

    const prior = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    await db.insert(chatMessages).values({
      id: crypto.randomUUID(),
      sessionId,
      role: "user",
      content: message,
      createdAt: now,
    });

    const history: Content[] = prior.slice(-30).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    history.push({ role: "user", parts: [{ text: message }] });

    const { instruction, config } = await buildSystemInstruction(user);
    const assistantMessageId = crypto.randomUUID();
    const { text, memoryUpdates } = await runChatTurn({
      model: config.modelName,
      systemInstruction: instruction,
      history,
      userId: user.id,
      assistantMessageId,
    });

    const doneAt = new Date().toISOString();
    await db.insert(chatMessages).values({
      id: assistantMessageId,
      sessionId,
      role: "assistant",
      content: text,
      toolCallsJson: memoryUpdates.length ? JSON.stringify(memoryUpdates) : null,
      createdAt: doneAt,
    });
    await db.update(chatSessions).set({ updatedAt: doneAt }).where(eq(chatSessions.id, sessionId));

    return NextResponse.json({ sessionId, messageId: assistantMessageId, reply: text, memoryUpdates });
  } catch (err) {
    return handleError(err);
  }
}
