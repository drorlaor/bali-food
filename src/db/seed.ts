import { eq } from "drizzle-orm";
import { getDb, getRawClient } from "./index";
import { systemConfig, users, childStaticProfiles } from "./schema";
import type { HouseholdBaselinePantry } from "@/lib/types";

export const GLOBAL_CONFIG_ID = "global_config";

export const DEFAULT_MASTER_PROMPT = `אתה יועץ תזונה ומלווה קולינרי אישי, חברותי ובגובה העיניים באפליקציית "בא לי" עבור ילדים ונוער במשפחה.
המטרה שלך היא לעזור לילד שמדבר איתך לבחור או להרכיב ארוחה, כריך לבית הספר או נשנוש מזין, טעים ומשביע.

עקרונות תזונה (מבוסס על המלצות ארגוני הבריאות ותזונה ים-תיכונית):
1. הרכב ארוחה מאוזנת: שאף תמיד לשילוב של חלבון איכותי (ביצים, גבינות, טונה, יוגורט, קטניות, עוף/דג), פחמימה מורכבת (לחם/פיתה מכוסמין או דגנים מלאים, שיבולת שועל, טורטייה, אורז/פסטה), ירק או פרי, ושומן בריא (טחינה, אבוקדו, שמן זית, חמאת בוטנים/שקדים טבעית, אגוזים).
2. התאמה לפעילות גופנית:
   - לפני אימון (30-90 דקות לפני): תעדף פחמימות זמינות וקלות לעיכול שנותנות אנרגיה מהירה ולא מכבידות על הבטן (למשל: בננה, תמר, פרוסת לחם עם מעט חמאת בוטנים או דבש).
   - אחרי אימון: הדגש שילוב של חלבון לבניית השריר ופחמימה למילוי מאגרי אנרגיה, והזכר לשתות מים.
3. יחס למתוקים וחטיפים: אל תטיף מוסר ואל תאסור. אם הילד מבקש משהו מתוק או חטיף, הצע גרסה מזינה ומשביעה יותר, או הצע לשלב מנה קטנה של מה שביקש לצד מרכיב חלבוני/משביע כדי למנוע נפילת אנרגיה ורעב חוזר.

כללי התנהלות בשיחה:
1. קצר, ממוקד ופרקטי: ילדים רעבים לא רוצים לקרוא מגילות. הצע 2-3 אפשרויות ברורות וממוספרות בכל פעם, לא יותר.
2. בטיחות במטבח: לעולם אל תציע לילד שיטת הכנה שחורגת מ"הרשאות המטבח" המוגדרות בפרופיל הקבוע שלו.
3. זמינות מול פתיחת הראש:
   - אם הילד מחפש מה לאכול עכשיו או להכין למחר בבוקר - התבסס קודם כל על "המזווה הקבוע של הבית" ועל המאכלים שהילד אוהב. אם חסר מרכיב בבית, הצע מיד חלופה פשוטה.
   - אם הילד מחפש גיוון או מתכנן קדימה - הצע רעיונות יצירתיים גם מחוץ למזווה הקבוע. אם הוא מתלהב ממרכיב שאין בבית, שמור אותו ב-wishlist_to_try כדי שההורים יראו ויוכלו לקנות.
4. למידה מתמשכת (שימוש בכלים):
   - אם הילד מציין שהוא אוהב או שונא מאכל מסוים, או שניסה מנה והיא הייתה מוצלחת, הפעל מיד את הכלי save_child_preference.
   - אם דעתו השתנתה לגבי עובדה קיימת בזיכרון, השתמש ב-remove_child_preference.
   - אל תעדכן זיכרון על חוסר רגעי במקרר, אלא רק על העדפות טעם, הרגלים ודברים שבא לו לנסות.`;

export const DEFAULT_PANTRY: HouseholdBaselinePantry = {
  carbsAndBreads: ["לחם פרוס", "פיתות כוסמין במקפיא", "טורטיות", "שיבולת שועל", "פסטה", "אורז", "קרקרים"],
  proteins: ["ביצים", "קוטג'", "גבינה צהובה", "גבינת שמנת", "גבינה בולגרית", "טונה", "יוגורט פרו", "חזה עוף", "חלב"],
  fatsAndSpreads: ["טחינה גולמית", "אבוקדו", "חמאת בוטנים טבעית", "שמן זית", "חומוס", "זיתים"],
  veggiesAndFruits: ["מלפפון", "עגבניות שרי", "גמבה", "גזר", "תפוח", "בננה", "תמרים", "מלפפון חמוץ"],
  quickSnacks: ["שקדים ואגוזים", "פופקורן", "בייגלה", "פירות יבשים"],
};

export const DEFAULT_QUICK_PROMPTS = [
  "כריך לבוקר לבית ספר",
  "מה בא לי לאכול עכשיו?",
  "משהו לפני/אחרי אימון",
  "בא לי נשנוש או משהו מתוק",
  "בא לי לגוון ולנסות משהו חדש",
];

export function defaultChildProfile(birthYear = new Date().getFullYear() - 10) {
  const age = new Date().getFullYear() - birthYear;
  let kitchen = "מותר: כריכים, מריחות, חיתוך ירקות רכים בסכין שולחן, מיקרוגל לחימום. אסור: כיריים, תנור, סכינים חדים - רק בנוכחות מבוגר.";
  if (age >= 14) kitchen = "מותר: כיריים (חביתה, פסטה), טוסטר, מיקרוגל, סכין חדה בזהירות. תנור - רק בידיעת הורה.";
  else if (age >= 12) kitchen = "מותר: טוסטר, מיקרוגל, טוסטר-אובן, סכין קטנה לחיתוך ירקות. כיריים - רק בנוכחות מבוגר.";
  return {
    birthYear,
    activityProfile: "פעילות גופנית רגילה בבית הספר.",
    kitchenPermissions: kitchen,
    medicalOrDietaryNotes: "אין מגבלות ידועות.",
    parentCustomDirectives: "",
  };
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY NOT NULL,
    master_system_prompt TEXT NOT NULL,
    baseline_pantry_json TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
    quick_prompts_json TEXT NOT NULL,
    updated_at TEXT,
    updated_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    avatar_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS child_static_profiles (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    birth_year INTEGER NOT NULL,
    activity_profile TEXT NOT NULL,
    kitchen_permissions TEXT NOT NULL,
    medical_or_dietary_notes TEXT NOT NULL,
    parent_custom_directives TEXT NOT NULL,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS child_memory_facts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    nutritional_group TEXT NOT NULL,
    item_or_fact TEXT NOT NULL,
    notes TEXT,
    source_message_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls_json TEXT,
    created_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ai_error_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL,
    model_name TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT NOT NULL,
    prompt_summary TEXT,
    created_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_facts_user ON child_memory_facts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON chat_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_error_logs_created ON ai_error_logs(created_at)`,
];

export const DEV_PARENT_EMAIL = "parent@dev.local";
const DEV_CHILDREN = [
  { email: "noa@dev.local", displayName: "נועה", birthYear: 2012, activity: "כדורעף 3 פעמים בשבוע (שני, רביעי, חמישי) 17:00-19:00, עצימות גבוהה." },
  { email: "itay@dev.local", displayName: "איתי", birthYear: 2014, activity: "כדורגל פעמיים בשבוע (ראשון ושלישי) 16:30-18:00." },
  { email: "maya@dev.local", displayName: "מאיה", birthYear: 2017, activity: "התעמלות קרקע פעם בשבוע (רביעי) 15:30-16:30." },
];

async function seedDevUsers() {
  const db = getDb();
  const now = new Date().toISOString();
  const parentEmail = (process.env.INITIAL_PARENT_EMAIL || DEV_PARENT_EMAIL).toLowerCase();
  await db
    .insert(users)
    .values({ id: crypto.randomUUID(), email: parentEmail, displayName: "הורה", role: "parent", isActive: true, createdAt: now })
    .onConflictDoNothing();
  for (const c of DEV_CHILDREN) {
    const existing = await db.select().from(users).where(eq(users.email, c.email)).get();
    if (existing) continue;
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email: c.email, displayName: c.displayName, role: "child", isActive: true, createdAt: now });
    await db.insert(childStaticProfiles).values({
      userId: id,
      ...defaultChildProfile(c.birthYear),
      activityProfile: c.activity,
      updatedAt: now,
    });
  }
}

let initPromise: Promise<void> | null = null;

/** Idempotently creates all tables and seeds the global config (and dev users when DEV_BYPASS_AUTH=true). */
export function ensureDb(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const client = getRawClient();
      await client.execute("PRAGMA foreign_keys = ON").catch(() => undefined);
      await client.batch(DDL, "write");
      const db = getDb();
      const cfg = await db.select().from(systemConfig).where(eq(systemConfig.id, GLOBAL_CONFIG_ID)).get();
      if (!cfg) {
        await db
          .insert(systemConfig)
          .values({
            id: GLOBAL_CONFIG_ID,
            masterSystemPrompt: DEFAULT_MASTER_PROMPT,
            baselinePantryJson: JSON.stringify(DEFAULT_PANTRY),
            modelName: "gemini-3.8-flash",
            quickPromptsJson: JSON.stringify(DEFAULT_QUICK_PROMPTS),
            updatedAt: new Date().toISOString(),
            updatedBy: "system",
          })
          .onConflictDoNothing();
      }
      if (process.env.DEV_BYPASS_AUTH === "true") await seedDevUsers();
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
