import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getDb } from "@/db";
import { chatMessages, chatSessions, childMemoryFacts, users } from "@/db/schema";
import { handleError, requireParent } from "@/lib/session";
import { loadConfig } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOPIC_RULES: { key: string; label: string; keywords: string[] }[] = [
  {
    key: "sandwiches",
    label: "כריכים ובית ספר",
    keywords: ["כריך", "סנדוויץ", "בית ספר", "בי\"ס", "ללימודים", "לחם", "פיתה", "לחמניה", "טוסט", "קופסת אוכל"],
  },
  {
    key: "meals",
    label: "ארוחות צהריים וערב",
    keywords: ["צהריים", "ערב", "ארוחה", "פסטה", "אורז", "שניצל", "עוף", "חביתה", "ביצה", "מרק", "תפוח אדמה", "פתיתים"],
  },
  {
    key: "snacks",
    label: "נשנושים ומתוקים",
    keywords: ["נשנוש", "חטיף", "מתוק", "שוקולד", "עוגיה", "יוגורט", "אחה\"צ", "אחר הצהריים", "בא לי משהו", "רעב"],
  },
  {
    key: "produce",
    label: "פירות וירקות",
    keywords: ["פרי", "פירות", "ירק", "ירקות", "סלט", "תפוח", "בננה", "מלפפון", "גזר", "גמבה", "עגבני", "אבוקדו", "תות"],
  },
];

export async function GET() {
  try {
    await requireParent();
    const db = getDb();

    const allKids = (await db.select().from(users).where(eq(users.role, "child"))).filter((u) => u.isActive);
    const allSessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));
    const allMessages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));
    const allFacts = await db.select().from(childMemoryFacts);

    const sessionToUser = new Map(allSessions.map((s) => [s.id, s.userId]));

    const kidsInsights = allKids.map((kid) => {
      const kidSessions = allSessions.filter((s) => s.userId === kid.id);
      const kidMessages = allMessages.filter((m) => sessionToUser.get(m.sessionId) === kid.id);
      const kidUserMessages = kidMessages.filter((m) => m.role === "user");
      const kidFacts = allFacts.filter((f) => f.userId === kid.id);

      const topicCounts: Record<string, number> = {
        sandwiches: 0,
        meals: 0,
        snacks: 0,
        produce: 0,
      };

      for (const msg of kidUserMessages) {
        const text = msg.content.toLowerCase();
        for (const rule of TOPIC_RULES) {
          if (rule.keywords.some((kw) => text.includes(kw))) {
            topicCounts[rule.key] = (topicCounts[rule.key] || 0) + 1;
          }
        }
      }

      const topics = TOPIC_RULES.map((r) => ({
        key: r.key,
        label: r.label,
        count: topicCounts[r.key] || 0,
      }));

      return {
        userId: kid.id,
        displayName: kid.displayName,
        sessionCount: kidSessions.length,
        userMessageCount: kidUserMessages.length,
        totalMessageCount: kidMessages.length,
        lastActiveAt: kidSessions[0]?.updatedAt || null,
        factsBreakdown: {
          liked: kidFacts.filter((f) => f.category === "liked_ingredient" || f.category === "favorite_meal").length,
          disliked: kidFacts.filter((f) => f.category === "disliked_ingredient").length,
          wishlist: kidFacts.filter((f) => f.category === "wishlist_to_try").length,
          habits: kidFacts.filter((f) => f.category === "habit_or_context").length,
          total: kidFacts.length,
        },
        topics,
        recentQuestions: kidUserMessages.slice(0, 5).map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
        })),
      };
    });

    const totals = {
      totalKids: allKids.length,
      totalSessions: kidsInsights.reduce((acc, k) => acc + k.sessionCount, 0),
      totalUserMessages: kidsInsights.reduce((acc, k) => acc + k.userMessageCount, 0),
      totalFactsLearned: kidsInsights.reduce((acc, k) => acc + k.factsBreakdown.total, 0),
    };

    return NextResponse.json({ totals, kids: kidsInsights });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST() {
  try {
    await requireParent();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const db = getDb();
    const config = await loadConfig();
    const allKids = (await db.select().from(users).where(eq(users.role, "child"))).filter((u) => u.isActive);
    const allSessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.updatedAt));
    const allMessages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt));
    const allFacts = await db.select().from(childMemoryFacts);

    const sessionToUser = new Map(allSessions.map((s) => [s.id, s.userId]));

    const summaryForAi = allKids
      .map((kid) => {
        const kidUserMessages = allMessages
          .filter((m) => sessionToUser.get(m.sessionId) === kid.id && m.role === "user")
          .slice(0, 20)
          .map((m) => `  - "${m.content}"`)
          .join("\n");

        const kidFacts = allFacts
          .filter((f) => f.userId === kid.id)
          .map((f) => `  - [${f.category}] ${f.itemOrFact}`)
          .join("\n");

        return `### ילד/ה: ${kid.displayName}
שאלות והודעות אחרונות של הילד/ה:
${kidUserMessages || "  (אין עדיין הודעות)"}
עובדות שנלמדו:
${kidFacts || "  (אין עדיין עובדות)"}`;
      })
      .join("\n\n");

    const prompt = `אתה יועץ תזונה ופדגוגיה דיגיטלית להורים באפליקציית "בא לי".
נתח עבור ההורים את דפוסי השימוש והתוכן של הילדים באפליקציה, והפק דוח תובנות קצר, ממוקד ופרקטי בעברית.

נתוני השימוש של הילדים:
${summaryForAi}

בנה את התשובה ב-3 חלקים ברורים:
1. 📊 **איך כל ילד משתמש בכלי**: מה מעסיק אותו, על אילו ארוחות הוא שואל ואיך רמת המעורבות שלו.
2. 🔍 **תובנות מהתוכן**: אילו מאכלים או בקשות חוזרים על עצמם, איפה יש פתיחות להתנסות ואיפה יש קושי.
3. 💡 **המלצות לשיפור להורים**: 2-3 פעולות קונקרטיות שההורים יכולים לעשות (למשל: אילו מוצרים להוסיף למזווה, איזו הנחיה להוסיף לחוקת התזונה או לפרופיל הילד כדי שהכלי יעזור להם עוד יותר).`;

    const ai = new GoogleGenAI({ apiKey });
    const candidateModels = Array.from(new Set([config.modelName, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash"]));
    let analysis = "";

    for (const model of candidateModels) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.6 },
        });
        if (res.text) {
          analysis = res.text.trim();
          break;
        }
      } catch {
        // try next model
      }
    }

    if (!analysis) {
      analysis = "לא הצלחתי להפיק ניתוח כרגע. נסו שוב בעוד רגע.";
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    return handleError(err);
  }
}
