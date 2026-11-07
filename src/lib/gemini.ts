import "server-only";
import dns from "node:dns";
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
  type Content,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, aiErrorLogs, MEMORY_CATEGORIES, NUTRITIONAL_GROUPS, type MemoryCategory, type NutritionalGroup } from "@/db/schema";
import type { MemoryUpdate, SafetyLimitationInfo } from "./types";

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

const HARM_CATEGORY_HEBREW: Record<string, string> = {
  HARM_CATEGORY_DANGEROUS_CONTENT: "זיהוי פריט או פעולה שעלולים להיות מסוכנים (כמו סכין חדה, אש גלויה או חום גבוה במטבח)",
  HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT: "זיהוי חפץ חד או מכשיר חם בתמונה שצולמה",
  HARM_CATEGORY_HARASSMENT: "זיהוי ביטוי שנתפס כפוגעני על ידי מסנן השפה",
  HARM_CATEGORY_HATE_SPEECH: "זיהוי שפה לא הולמת על ידי מסנן הבטיחות",
  HARM_CATEGORY_SEXUALLY_EXPLICIT: "סינון תוכן אוטומטי לצורכי בטיחות ילדים",
  HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT: "סינון תמונה אוטומטי לצורכי בטיחות",
};

const FINISH_REASON_HEBREW: Record<string, string> = {
  SAFETY: "מסנן הבטיחות של ה-AI עצר את התשובה (SAFETY)",
  IMAGE_SAFETY: "מסנן בטיחות התמונות של ה-AI חסם את התמונה (IMAGE_SAFETY)",
  PROHIBITED_CONTENT: "הבקשה נחסמה עקב מדיניות תוכן מוגבל (PROHIBITED_CONTENT)",
  IMAGE_PROHIBITED_CONTENT: "התמונה נחסמה עקב מדיניות תוכן מוגבל (IMAGE_PROHIBITED_CONTENT)",
  BLOCKLIST: "הבקשה כללה מונח חסום במילון הבטיחות (BLOCKLIST)",
  RECITATION: "התשובה נעצרה עקב דמיון לתוכן מוגן (RECITATION)",
  OTHER: "המודל עצר את התשובה מסיבת בטיחות/מערכת (OTHER)",
  IMAGE_OTHER: "המודל לא הצליח לעבד את התמונה מסיבת בטיחות/איכות (IMAGE_OTHER)",
};

function detectKitchenSafetyLimitation(text: string): SafetyLimitationInfo | undefined {
  if (!text) return undefined;
  const hasExplicitMarker = text.includes("מגבלת בטיחות");
  const hasImplicitRestriction =
    (text.includes("אסור") || text.includes("רק בנוכחות מבוגר") || text.includes("לפי הגדרות הבטיחות") || text.includes("הרשאות הבטיחות")) &&
    (text.includes("כיריים") || text.includes("תנור") || text.includes("סכין") || text.includes("מים רותחים") || text.includes("מחבת"));

  if (!hasExplicitMarker && !hasImplicitRestriction) return undefined;

  const reasons: string[] = [];
  const lines = text.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (
      line.includes("מגבלת בטיחות") ||
      ((line.includes("כיריים") || line.includes("תנור") || line.includes("סכין")) &&
        (line.includes("מבוגר") || line.includes("אסור") || line.includes("בטיחות")))
    ) {
      const cleaned = line.replace(/^[-*•#>\s⚠️]+/, "").replace(/\*\*/g, "").trim();
      if (cleaned && !reasons.includes(cleaned)) {
        reasons.push(cleaned);
      }
    }
  }

  if (reasons.length === 0) {
    reasons.push("חלק משלבי ההכנה הרגילים דורשים שימוש בכיריים, תנור או סכין חדה שמוגבלים בפרופיל הבטיחות במטבח.");
  }

  return {
    kind: "kitchen_safety",
    title: "מגבלת בטיחות במטבח – איך תרצו להמשיך?",
    reasons: reasons.slice(0, 2),
    mitigations: [
      {
        id: "adult-present",
        label: "👨‍👩‍👧 יש לידי מבוגר שעוזר לי",
        prompt:
          "יש לידי עכשיו הורה/מבוגר שמשגיח ועוזר לי עם הכיריים, התנור או הסכין החדה – תן לי בבקשה את ההוראות המלאות להכנה משותפת!",
      },
      {
        id: "safe-solo",
        label: "🥪 הצע חלופה בטוחה להכנה לבד",
        prompt:
          "תציע לי בבקשה גרסה חלופית ובטוחה של המנה עם אותם מצרכים שאפשר להכין לבד לגמרי (למשל במיקרוגל, בטוסטר לחיצה או ללא בישול וחיתוך חד).",
      },
      {
        id: "pre-cut",
        label: "🔪 המצרכים כבר חתוכים/מוכנים",
        prompt:
          "המצרכים כבר חתוכים ומוכנים מראש על ידי ההורים – איך מרכיבים את המנה מכאן בצורה בטוחה?",
      },
      {
        id: "admin-permissions",
        label: "⚙️ עדכון הרשאות בטיחות (להורים)",
        action: "open_admin_children",
      },
    ],
  };
}

export async function runChatTurn(opts: {
  model: string;
  systemInstruction: string;
  history: Content[];
  userId: string;
  sessionId?: string;
  assistantMessageId: string;
  userMessageSnippet?: string;
}): Promise<{ text: string; memoryUpdates: MemoryUpdate[]; safetyLimitation?: SafetyLimitationInfo }> {
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
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
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
      const replyText = (res.text || "").trim();
      const candidate = res.candidates?.[0];
      const finishReason = candidate?.finishReason ? String(candidate.finishReason) : "";
      const blockReason = res.promptFeedback?.blockReason ? String(res.promptFeedback.blockReason) : "";

      const isBlockedBySafety =
        Boolean(blockReason) ||
        ["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "IMAGE_PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"].includes(
          finishReason
        ) ||
        (!replyText && finishReason && finishReason !== "STOP");

      if (isBlockedBySafety || !replyText) {
        const reasons: string[] = [];
        if (blockReason) {
          reasons.push(`הבקשה נחסמה על ידי מסנן הבטיחות האוטומטי (${blockReason}).`);
        }
        if (finishReason && FINISH_REASON_HEBREW[finishReason]) {
          reasons.push(FINISH_REASON_HEBREW[finishReason]);
        } else if (finishReason && finishReason !== "STOP") {
          reasons.push(`התשובה נעצרה על ידי המודל (סיבה: ${finishReason}).`);
        }

        const ratings = [...(candidate?.safetyRatings || []), ...(res.promptFeedback?.safetyRatings || [])];
        for (const r of ratings) {
          const cat = r.category ? String(r.category) : "";
          const prob = r.probability ? String(r.probability) : "";
          if (r.blocked || prob === "HIGH" || prob === "MEDIUM") {
            const label = HARM_CATEGORY_HEBREW[cat] || `קטגוריית בטיחות: ${cat} (${prob})`;
            if (!reasons.includes(label)) reasons.push(label);
          }
        }

        if (reasons.length === 0) {
          reasons.push(
            "מסנן הבטיחות של ה-AI עצר את התשובה (ייתכן שבגלל זיהוי סכין, כיריים/אש בתמונה או ניסוח שנראה למודל רגיש)."
          );
        }

        await logAiError({
          userId: opts.userId,
          sessionId: opts.sessionId,
          modelName: opts.model,
          errorCode: `SAFETY_${blockReason || finishReason || "EMPTY"}`,
          errorMessage: reasons.join(" | "),
          promptSummary: opts.userMessageSnippet,
        });

        const rawCleanQuestion = (opts.userMessageSnippet || "")
          .replace(/^📷 \[צילום מצרכים(?: ×\d+)?\]\s*/, "")
          .trim();

        const safetyLimitation: SafetyLimitationInfo = {
          kind: "ai_filter",
          title: "התשובה הוגבלה על ידי מסנן הבטיחות של ה-AI",
          reasons,
          mitigations: [
            {
              id: "safe-rephrase",
              label: "🔄 נסה שוב בניסוח בטוח וממוקד במתכון",
              prompt: rawCleanQuestion
                ? `בהקשר של הכנת אוכל ביתי ובטוח במטבח בלבד: ${rawCleanQuestion}. אנא הצע אפשרויות בטוחות להכנה.`
                : "אנא הצע לי רעיונות בטוחים וקלים להכנת כריך או ארוחה ממה שיש במטבח הביתי.",
            },
            {
              id: "edit-last",
              label: "✏️ ערוך את ההודעה / החלף תמונה",
              action: "prefill_last",
            },
            {
              id: "no-cook-option",
              label: "🥪 בקש הצעה ללא בישול או סכין חדה",
              prompt: "תציע לי רעיון טעים ובטוח לכריך או ארוחה קלה להכנה ללא בישול וללא שימוש בסכין חדה.",
            },
          ],
        };

        return {
          text:
            replyText ||
            "מסנן הבטיחות האוטומטי עצר את התשובה (למשל אם הופיעו בתמונה סכין מטבח, כיריים או ניסוח שנראה למודל רגיש). פירטתי למטה את הסיבה ואפשר לפתור זאת בלחיצה אחת:",
          memoryUpdates,
          safetyLimitation,
        };
      }

      const kitchenSafety = detectKitchenSafetyLimitation(replyText);
      return {
        text: replyText,
        memoryUpdates,
        safetyLimitation: kitchenSafety,
      };
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
