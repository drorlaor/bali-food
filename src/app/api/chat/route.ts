import { NextResponse } from "next/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Content, Part } from "@google/genai";
import { getDb } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { handleError, HttpError, requireUser } from "@/lib/session";
import { buildSystemInstruction } from "@/lib/prompt";
import { runChatTurn } from "@/lib/gemini";
import { parseJson, type MemoryUpdate } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/chat -> list authenticated user's sessions
 * GET /api/chat?sessionId=... -> fetch full transcript for that session
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const db = getDb();
    const params = new URL(req.url).searchParams;
    const sessionId = params.get("sessionId");

    if (sessionId) {
      const session = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id)))
        .get();
      if (!session) throw new HttpError(404, "Session not found");

      const rows = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt));

      const messages = rows.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt,
        memoryUpdates: m.toolCallsJson ? parseJson<MemoryUpdate[]>(m.toolCallsJson, []) : undefined,
      }));

      return NextResponse.json({ session, messages });
    }

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
      .where(eq(chatSessions.userId, user.id))
      .groupBy(chatSessions.id)
      .orderBy(desc(chatSessions.updatedAt))
      .limit(50);

    return NextResponse.json({ sessions });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const db = getDb();
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) throw new HttpError(400, "Missing sessionId");

    const session = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id)))
      .get();
    if (!session) throw new HttpError(404, "Session not found");

    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;
const MAX_IMAGES = 3;
const MAX_BASE64_LEN = 2_000_000; // ~1.5MB per compressed image

function parseImageParts(rawImages: unknown): Part[] {
  if (!Array.isArray(rawImages)) return [];
  const parts: Part[] = [];
  for (const item of rawImages.slice(0, MAX_IMAGES)) {
    if (typeof item !== "string" || item.length > MAX_BASE64_LEN) continue;
    const match = item.match(DATA_URL_RE);
    if (!match) continue;
    const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
    parts.push({
      inlineData: {
        mimeType,
        data: match[2],
      },
    });
  }
  return parts;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { sessionId?: string; message?: string; images?: string[] };
    const imageParts = parseImageParts(body.images);
    const rawText = (body.message || "").trim().slice(0, 4000);
    const message =
      rawText ||
      (imageParts.length > 0 ? "צילמתי מה שיש במקרר/על השיש - מה אפשר להכין מזה?" : "");
    if (!message && imageParts.length === 0) throw new HttpError(400, "Empty message");

    const storedUserContent =
      imageParts.length > 0
        ? `📷 [צילום מצרכים${imageParts.length > 1 ? ` ×${imageParts.length}` : ""}] ${message}`
        : message;

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
        title: storedUserContent.slice(0, 60),
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
      content: storedUserContent,
      createdAt: now,
    });

    const history: Content[] = prior.slice(-30).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const currentTurnParts: Part[] = [...imageParts, { text: message }];
    history.push({ role: "user", parts: currentTurnParts });

    const { instruction, config } = await buildSystemInstruction(user);
    const assistantMessageId = crypto.randomUUID();
    const { text, memoryUpdates } = await runChatTurn({
      model: config.modelName,
      systemInstruction: instruction,
      history,
      userId: user.id,
      sessionId,
      assistantMessageId,
      userMessageSnippet: storedUserContent,
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
