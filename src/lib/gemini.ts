import "server-only";
import dns from "node:dns";
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}
import { GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, MEMORY_CATEGORIES, NUTRITIONAL_GROUPS, type MemoryCategory, type NutritionalGroup } from "@/db/schema";
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
    // Scoped strictly to the authenticated user.
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
  assistantMessageId: string;
}): Promise<{ text: string; memoryUpdates: MemoryUpdate[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [...opts.history];
  const memoryUpdates: MemoryUpdate[] = [];

  for (let round = 0; round < 5; round++) {
    const res = await ai.models.generateContent({
      model: opts.model,
      contents,
      config: {
        systemInstruction: opts.systemInstruction,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        temperature: 0.7,
      },
    });

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
