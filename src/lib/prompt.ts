import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, childStaticProfiles, systemConfig, type MemoryFact, type User } from "@/db/schema";
import { DEFAULT_PANTRY, GLOBAL_CONFIG_ID, DEFAULT_QUICK_PROMPTS, defaultChildProfile } from "@/db/seed";
import { PANTRY_LABELS, parseJson, type HouseholdBaselinePantry } from "./types";

export async function loadConfig() {
  const db = getDb();
  const cfg = await db.select().from(systemConfig).where(eq(systemConfig.id, GLOBAL_CONFIG_ID)).get();
  return {
    masterSystemPrompt: cfg?.masterSystemPrompt || "",
    baselinePantry: parseJson<HouseholdBaselinePantry>(cfg?.baselinePantryJson, DEFAULT_PANTRY),
    modelName: cfg?.modelName || "gemini-3.8-flash",
    quickPrompts: parseJson<string[]>(cfg?.quickPromptsJson, DEFAULT_QUICK_PROMPTS),
    updatedAt: cfg?.updatedAt || null,
    updatedBy: cfg?.updatedBy || null,
  };
}

const CATEGORY_TITLES: Record<string, string> = {
  liked_ingredient: "liked_ingredient - מרכיבים שאוהב/ת",
  disliked_ingredient: "disliked_ingredient - מרכיבים שלא אוהב/ת (הימנע מהם!)",
  favorite_meal: "favorite_meal - ארוחות ושילובים אהובים",
  wishlist_to_try: "wishlist_to_try - דברים שרוצה לנסות / לקנות",
  habit_or_context: "habit_or_context - הרגלים והקשר",
};

function israelNow(): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function buildSystemInstruction(user: User) {
  const db = getDb();
  const config = await loadConfig();
  const profile =
    (await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, user.id)).get()) ||
    (user.role === "parent"
      ? { ...defaultChildProfile(new Date().getFullYear() - 40), activityProfile: "הורה במצב בדיקה", kitchenPermissions: "ללא הגבלה (מבוגר)" }
      : defaultChildProfile());
  const facts: MemoryFact[] = await db
    .select()
    .from(childMemoryFacts)
    .where(eq(childMemoryFacts.userId, user.id))
    .orderBy(asc(childMemoryFacts.createdAt));

  const age = new Date().getFullYear() - profile.birthYear;

  const pantryLines = (Object.keys(PANTRY_LABELS) as (keyof HouseholdBaselinePantry)[])
    .map((k) => `- ${PANTRY_LABELS[k]}: ${(config.baselinePantry[k] || []).join(", ") || "-"}`)
    .join("\n");

  const memoryLines = Object.keys(CATEGORY_TITLES)
    .map((cat) => {
      const items = facts.filter((f) => f.category === cat);
      const body = items.length
        ? items.map((f) => `- [factId: ${f.id}] (${f.nutritionalGroup}) ${f.itemOrFact}${f.notes ? ` (${f.notes})` : ""}`).join("\n")
        : "- (ריק)";
      return `### ${CATEGORY_TITLES[cat]}\n${body}`;
    })
    .join("\n\n");

  const instruction = `${config.masterSystemPrompt}

==============================
## פרופיל קבוע של הילד/ה (אילוצים קשיחים - לקריאה בלבד)
- שם: ${user.displayName}
- גיל מחושב: ${age}
- היום והשעה כעת בישראל: ${israelNow()}
- פרופיל פעילות גופנית: ${profile.activityProfile}
- הרשאות בטיחות במטבח (STRICT KITCHEN SAFETY PERMISSIONS - NEVER VIOLATE): ${profile.kitchenPermissions}
- הערות רפואיות / תזונתיות: ${profile.medicalOrDietaryNotes}
- הנחיות מיוחדות מההורים: ${profile.parentCustomDirectives || "-"}

==============================
## המזווה הקבוע של הבית
הרשימה הבאה מייצגת מוצרים שבדרך כלל זמינים בבית לארוחות מיידיות ("עכשיו" או "מחר בבוקר").
עם זאת, אל תגביל את הילד/ה רק לרשימה הזו כשהוא/היא מחפש/ת רעיונות או מתכנן/ת קדימה - עודד/י פתיחות ושמור/י מרכיבים חדשים שמתלהבים מהם ב-wishlist_to_try.
${pantryLines}

==============================
## הזיכרון האישי שנלמד על הילד/ה
(השתמש ב-factId המדויק כשאתה קורא ל-remove_child_preference)
${memoryLines}

==============================
ענה תמיד בעברית, בטון חם וקליל, בפנייה אישית בשם ${user.displayName}.`;

  return { instruction, config };
}
