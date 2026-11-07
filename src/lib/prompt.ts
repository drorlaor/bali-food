import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { childMemoryFacts, childStaticProfiles, systemConfig, users, type MemoryFact, type User } from "@/db/schema";
import { DEFAULT_PANTRY, GLOBAL_CONFIG_ID, DEFAULT_QUICK_PROMPTS, defaultChildProfile } from "@/db/seed";
import { PANTRY_LABELS, parseJson, type HouseholdBaselinePantry } from "./types";

export const DEFAULT_PARENT_QUICK_PROMPTS: string[] = [
  "מה כדאי להכין מחר בבוקר לכריכים לכל הילדים?",
  "תציע ארוחת צהריים או ערב שמתאימה לטעם של כל הילדים",
  "הכן רשימת קניות מומלצת לפי מה שהילדים אוהבים ורוצים לנסות",
  "תן לי תקציר של מה כל ילד אוהב ומה הוא לא אוהב",
];

export async function loadConfig() {
  const db = getDb();
  const cfg = await db.select().from(systemConfig).where(eq(systemConfig.id, GLOBAL_CONFIG_ID)).get();
  return {
    masterSystemPrompt: cfg?.masterSystemPrompt || "",
    baselinePantry: parseJson<HouseholdBaselinePantry>(cfg?.baselinePantryJson, DEFAULT_PANTRY),
    modelName: cfg?.modelName || "gemini-3.5-flash",
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

  const pantryLines = (Object.keys(PANTRY_LABELS) as (keyof HouseholdBaselinePantry)[])
    .map((k) => `- ${PANTRY_LABELS[k]}: ${(config.baselinePantry[k] || []).join(", ") || "-"}`)
    .join("\n");

  if (user.role === "parent") {
    const allUsers = await db.select().from(users).where(eq(users.role, "child"));
    const activeKids = allUsers.filter((u) => u.isActive);
    const allProfiles = await db.select().from(childStaticProfiles);
    const allFacts = await db.select().from(childMemoryFacts).orderBy(asc(childMemoryFacts.createdAt));

    const kidsDetails = activeKids.length
      ? activeKids
          .map((kid) => {
            const p = allProfiles.find((pr) => pr.userId === kid.id) || defaultChildProfile();
            const kidAge = new Date().getFullYear() - p.birthYear;
            const kidFacts = allFacts.filter((f) => f.userId === kid.id);

            const factsSummary = Object.keys(CATEGORY_TITLES)
              .map((cat) => {
                const items = kidFacts.filter((f) => f.category === cat);
                const list = items.length
                  ? items.map((f) => `  * (${f.nutritionalGroup}) ${f.itemOrFact}${f.notes ? ` [${f.notes}]` : ""}`).join("\n")
                  : "  * (אין עדיין)";
                return `- ${CATEGORY_TITLES[cat]}:\n${list}`;
              })
              .join("\n");

            return `### 👧👦 ילד/ה: ${kid.displayName} (גיל ~${kidAge})
- פרופיל פעילות: ${p.activityProfile}
- בטיחות במטבח: ${p.kitchenPermissions}
- דגשים תזונתיים / רפואיים: ${p.medicalOrDietaryNotes}
- הנחיות מיוחדות: ${p.parentCustomDirectives || "-"}
${factsSummary}`;
          })
          .join("\n\n------------------------------\n\n")
      : "אין עדיין ילדים מוגדרים במערכת.";

    const parentInstruction = `אתה "בא לי - עוזר תזונה משפחתי להורים", יועץ תזונה וקולינריה אישי, חכם ופרקטי עבור ההורה (${user.displayName}).
היום והשעה כעת בישראל: ${israelNow()}.

המטרה שלך:
1. לעזור להורה להחליט מהר ובקלות אילו כריכים לבית הספר, ארוחות צהריים/ערב או נשנושים להכין לילדים, על בסיס היכרות מעמיקה עם ההעדפות, האהבות, הסלידות והאילוצים של כל ילד וילד במשפחה.
2. להציע פתרונות יצירתיים שמגשרים בין הטעמים השונים של הילדים (למשל ארוחה מרכזית אחת עם התאמות קטנות לכל ילד, או תכנון כריכים לבוקר עם כותרת ברורה לכל ילד).
3. כשההורה מבקש המלצה לרשימת קניות, לבנות רשימה מסודרת לפי קטגוריות סופר שמשלבת:
   - פריטים שהילדים ביקשו לנסות (wishlist_to_try) עם ציון שם הילד שביקש.
   - מרכיבים שהילדים אוהבים במיוחד (liked_ingredient / favorite_meal).
   - השלמות בריאות למזווה הביתי לפי חוקת התזונה של המשפחה.

==============================
## חוקת התזונה של הבית
${config.masterSystemPrompt}

==============================
## המזווה הקבוע של הבית
${pantryLines}

==============================
## פרופילי הילדים והעדפותיהם שנלמדו מהשיחות
${kidsDetails}

==============================
הנחיות סגנון:
- ענה תמיד בעברית קולחת, מסודרת וברורה (השתמש בכותרות ובנקודות עבור כל ילד).
- פנה אל ההורה בשם ${user.displayName} בגובה העיניים, כשותף לתכנון הבית.`;

    return { instruction: parentInstruction, config };
  }

  const profile =
    (await db.select().from(childStaticProfiles).where(eq(childStaticProfiles.userId, user.id)).get()) ||
    defaultChildProfile();
  const facts: MemoryFact[] = await db
    .select()
    .from(childMemoryFacts)
    .where(eq(childMemoryFacts.userId, user.id))
    .orderBy(asc(childMemoryFacts.createdAt));

  const age = new Date().getFullYear() - profile.birthYear;

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
