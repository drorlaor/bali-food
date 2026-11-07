import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getDb } from "@/db";
import { childMemoryFacts, users } from "@/db/schema";
import { handleError, requireParent } from "@/lib/session";
import { loadConfig } from "@/lib/prompt";
import { GROUP_LABELS, PANTRY_LABELS, type HouseholdBaselinePantry } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireParent();
    const db = getDb();
    const config = await loadConfig();

    const allKids = (await db.select().from(users).where(eq(users.role, "child"))).filter((u) => u.isActive);
    const allFacts = await db.select().from(childMemoryFacts).orderBy(asc(childMemoryFacts.createdAt));

    const kidMap = new Map(allKids.map((k) => [k.id, k.displayName]));

    const wishlist = allFacts
      .filter((f) => f.category === "wishlist_to_try" && kidMap.has(f.userId))
      .map((f) => ({
        id: f.id,
        childId: f.userId,
        childName: kidMap.get(f.userId) || "",
        item: f.itemOrFact,
        notes: f.notes,
        nutritionalGroup: f.nutritionalGroup,
        groupLabel: GROUP_LABELS[f.nutritionalGroup] || f.nutritionalGroup,
      }));

    const liked = allFacts
      .filter((f) => (f.category === "liked_ingredient" || f.category === "favorite_meal") && kidMap.has(f.userId))
      .map((f) => ({
        id: f.id,
        childId: f.userId,
        childName: kidMap.get(f.userId) || "",
        category: f.category,
        item: f.itemOrFact,
        notes: f.notes,
        nutritionalGroup: f.nutritionalGroup,
        groupLabel: GROUP_LABELS[f.nutritionalGroup] || f.nutritionalGroup,
      }));

    return NextResponse.json({
      wishlist,
      liked,
      baselinePantry: config.baselinePantry,
    });
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
    const allFacts = await db.select().from(childMemoryFacts).orderBy(asc(childMemoryFacts.createdAt));

    const pantryLines = (Object.keys(PANTRY_LABELS) as (keyof HouseholdBaselinePantry)[])
      .map((k) => `- ${PANTRY_LABELS[k]}: ${(config.baselinePantry[k] || []).join(", ") || "-"}`)
      .join("\n");

    const kidsPreferences = allKids
      .map((kid) => {
        const kf = allFacts.filter((f) => f.userId === kid.id);
        const wishes = kf.filter((f) => f.category === "wishlist_to_try").map((f) => f.itemOrFact);
        const likes = kf.filter((f) => f.category === "liked_ingredient" || f.category === "favorite_meal").map((f) => f.itemOrFact);
        const dislikes = kf.filter((f) => f.category === "disliked_ingredient").map((f) => f.itemOrFact);

        return `ילד/ה: ${kid.displayName}
- רוצה לנסות / ביקש לקנות (wishlist_to_try): ${wishes.join(", ") || "אין כרגע"}
- אוהב/ת במיוחד: ${likes.join(", ") || "אין כרגע"}
- לא אוהב/ת: ${dislikes.join(", ") || "אין כרגע"}`;
      })
      .join("\n\n");

    const prompt = `אתה יועץ התזונה המשפחתי של אפליקציית "בא לי".
בנה להורים המלצה מסודרת, פרקטית ומוכנה להעתקה של **רשימת קניות שבועית** בהתבסס על:
1. דברים שהילדים ביקשו לנסות (wishlist_to_try) - תן להם עדיפות וציין בסוגריים את שם הילד שביקש!
2. מרכיבים אהובים על הילדים שכדאי לחדש במלאי לכריכים, ארוחות ונשנושים.
3. השלמות בריאות לפי המזווה הקבוע וחוקת התזונה של הבית.

## המזווה הקבוע של הבית:
${pantryLines}

## העדפות ובקשות הילדים:
${kidsPreferences}

פרמט את התשובה בעברית ברורה עם אימוג'ים, מחולקת לקטגוריות סופר (למשל: 🥬 ירקות ופירות, 🍞 לחמים ומאפים, 🧀 גבינות ממרחים וחלבונים, ✨ בקשות מיוחדות של הילדים להתנסות, 🥜 נשנושים בריאים).
עבור כל פריט כתוב שורה קצרה וברורה עם "☐ " בתחילת השורה כדי שיהיה נוח להעתיק לוואטסאפ או לפתקים.`;

    const ai = new GoogleGenAI({ apiKey });
    const candidateModels = Array.from(new Set([config.modelName, "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.6-flash"]));
    let recommendation = "";

    for (const model of candidateModels) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { temperature: 0.6 },
        });
        if (res.text) {
          recommendation = res.text.trim();
          break;
        }
      } catch {
        // try next model
      }
    }

    if (!recommendation) {
      recommendation = "לא הצלחתי לייצר המלצה כרגע, נסו שוב בעוד רגע.";
    }

    return NextResponse.json({ recommendation });
  } catch (err) {
    return handleError(err);
  }
}
