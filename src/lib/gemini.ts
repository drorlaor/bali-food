import "server-only";
import dns from "node:dns";
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}
import { GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, aiErrorLogs, MEMORY_CATEGORIES, NUTRITIONAL_GROUPS, type MemoryCategory, type NutritionalGroup } from "@/db/schema";
import type { MemoryUpdate } from "./types";

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "save_child_preference",
    description:
      "Saves a new food preference, liked/disliked ingredient, favorite meal combination, habit, or an item the child wants to try/buy (wishlist_to_try).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, enum: [...MEMORY_CATEGORIES] },
        nutritionalGroup: { type: Type.STRING, enum: [...NUTRITIONAL_GROUPS] },
        itemOrFact: { type: Type.STRING, description: "Short Hebrew description of the item or fact." },
        notes: { type: Type.STRING, description: "Optional extra context in Hebrew." },
      },
      required: ["category", "nutritionalGroup", "itemOrFact"],
    },
  },
  {
    name: "remove_child_preference",
    description: "Removes an outdated or changed fact from the child's memory by its exact factId.",
    parameters: {
      type: Type.OBJECT,
      properties: { factId: { type: Type.STRING } },
      required: ["factId"],
    },
  },
];

export function parseErrorCodeAndMessage(err: unknown): { code: string; message: string } {
  let message = err instanceof Error ? err.message : String(err);
  let code = "UNKNOWN";

  if (err && typeof err === "object" && "status" in err && (err as { status: unknown }).status) {
    code = String((err as { status: unknown }).status);
  }

  try {
    const jsonMatch = message.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        if (parsed.error.status) code = String(parsed.error.status);
        else if (parsed.error.code) code = String(parsed.error.code);
        if (parsed.error.message) message = parsed.error.message;
      }
    }
  } catch {}

  if (code === "UNKNOWN") {
    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED") || message.includes("Quota exceeded")) code = "429_QUOTA";
    else if (message.includes("503") || message.includes("high demand")) code = "503_OVERLOAD";
    else if (message.includes("404")) code = "404_NOT_FOUND";
  }

  return { code, message };
}

export async function logAiError(entry: {
  userId?: string | null;
  sessionId?: string | null;
  modelName: string;
  errorCode?: string | null;
  errorMessage: string;
  promptSummary?: string | null;
}) {
  try {
    const db = getDb();
    await db.insert(aiErrorLogs).values({
      id: crypto.randomUUID(),
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      modelName: entry.modelName,
      errorCode: entry.errorCode || null,
      errorMessage: entry.errorMessage.slice(0, 4000),
      promptSummary: entry.promptSummary ? entry.promptSummary.slice(0, 500) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.error("Failed to insert AI error log into DB:", dbErr);
  }
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  sourceMessageId: string
): Promise<MemoryUpdate> {
  const db = getDb();
  if (name === "save_child_preference") {
    const category = String(args.category || "") as MemoryCategory;
    const nutritionalGroup = String(args.nutritionalGroup || "other") as NutritionalGroup;
    const itemOrFact = String(args.itemOrFact || "").trim().slice(0, 300);
    const notes = args.notes ? String(args.notes).slice(0, 500) : null;
    if (!MEMORY_CATEGORIES.includes(category) || !itemOrFact) {
      return { action: "save_child_preference", factId: "", category, itemOrFact, success: false, error: "invalid arguments" };
    }
    const group = NUTRITIONAL_GROUPS.includes(nutritionalGroup) ? nutritionalGroup : "other";
    const id = crypto.randomUUID();
    await db.insert(childMemoryFacts).values({
      id,
      userId,
      category,
      nutritionalGroup: group,
      itemOrFact,
      notes,
      sourceMessageId,
      createdBy: "ai",
      createdAt: new Date().toISOString(),
    });
    return { action: "save_child_preference", factId: id, category, nutritionalGroup: group, itemOrFact, notes, success: true };
  }
  if (name === "remove_child_preference") {
    const factId = String(args.factId || "");
    const fact = await db
      .select()
      .from(childMemoryFacts)
      .where(and(eq(childMemoryFacts.id, factId), eq(childMemoryFacts.userId, userId)))
      .get();
    if (!fact) return { action: "remove_child_preference", factId, success: false, error: "fact not found" };
    await db.delete(childMemoryFacts).where(and(eq(childMemoryFacts.id, factId), eq(childMemoryFacts.userId, userId)));
    return {
      action: "remove_child_preference",
      factId,
      category: fact.category,
      nutritionalGroup: fact.nutritionalGroup,
      itemOrFact: fact.itemOrFact,
      success: true,
    };
  }
  return { action: name as MemoryUpdate["action"], factId: "", success: false, error: "unknown tool" };
}

export async function runChatTurn(opts: {
  model: string;
  systemInstruction: string;
  history: Content[];
  userId: string;
  sessionId?: string;
  assistantMessageId: string;
  userMessageSnippet?: string;
}): Promise<{ text: string; memoryUpdates: MemoryUpdate[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [...opts.history];
  const memoryUpdates: MemoryUpdate[] = [];

  const candidateModels = Array.from(
    new Set([opts.model, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash"])
  );

  for (let round = 0; round < 5; round++) {
    let res: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    for (const modelToTry of candidateModels) {
      try {
        res = await ai.models.generateContent({
          model: modelToTry,
          contents,
          config: {
            systemInstruction: opts.systemInstruction,
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            temperature: 0.7,
          },
        });
        if (res) break;
      } catch (err: unknown) {
        lastError = err;
        const { code, message } = parseErrorCodeAndMessage(err);
        console.warn(`[Gemini Error] Model ${modelToTry} failed (${code}): ${message.slice(0, 100)}`);
        await logAiError({
          userId: opts.userId,
          sessionId: opts.sessionId,
          modelName: modelToTry,
          errorCode: code,
          errorMessage: message,
          promptSummary: opts.userMessageSnippet,
        });
      }
    }

    if (!res) {
      console.error("All Gemini candidate models failed.", lastError);
      return {
        text: "אוי, הראש שלי קצת עמוס כרגע (הגענו למכסת השיחות של ה-AI להיום). סיפרתי להורים בלוח הבקרה כדי שיוכלו לעדכן את זה! אפשר לנסות שוב עוד מעט או מאוחר יותר 😊",
        memoryUpdates: [],
      };
    }

    const calls = res.functionCalls || [];
    if (!calls.length) {
      return { text: (res.text || "").trim() || "אופס, לא הצלחתי לחשוב על תשובה. נסה/י שוב?", memoryUpdates };
    }

    const modelContent = res.candidates?.[0]?.content;
    contents.push(modelContent || { role: "model", parts: calls.map((c) => ({ functionCall: c })) });

    const responseParts: Part[] = [];
    for (const call of calls) {
      const update = await executeTool(call.name || "", (call.args || {}) as Record<string, unknown>, opts.userId, opts.assistantMessageId);
      memoryUpdates.push(update);
      responseParts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: update.success ? { result: "ok", factId: update.factId } : { error: update.error },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }
  return { text: "שמרתי את מה שסיפרת! מה עוד בא לך?", memoryUpdates };
}
