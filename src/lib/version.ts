export const APP_VERSION = "1.5.0";
export const FEATURE_RELEASE_ID = "1.5.0";
export const BUILD_TIME = "2026-11-07 17:15";
export const VERSION_NOTES =
  "חדש בבא לי! צילום מצרכים מהמקרר, רשימת קניות חכמה, שיחות קודמות ודוח תובנות";

export type WhatsNewAction = "camera" | "history" | "shopping" | "parent_prompt" | "insights";

export interface WhatsNewItem {
  id: string;
  audience: "all" | "child" | "parent";
  emoji: string;
  badge: string;
  title: string;
  titleChild?: string;
  description: string;
  descriptionChild?: string;
  ctaLabel: string;
  action: WhatsNewAction;
}

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    id: "fridge-vision",
    audience: "all",
    emoji: "📸",
    badge: "חדש! AI במצלמה",
    title: "צילום מצרכים מהמקרר או מהשיש",
    titleChild: "צלמו מה יש במקרר וגלו מה להכין!",
    description:
      "מצלמים עד 3 תמונות של מדפי המקרר או השיש (או בוחרים מהגלריה), וה-AI מזהה את המצרכים ומציע כריכים וארוחות בשילוב המזווה הביתי.",
    descriptionChild:
      "לא בטוחים מה בא לכם לאכול? צלמו את המקרר או השיש (עד 3 תמונות) ו\"בא לי\" יזהה את המצרכים ויציע לכם רעיונות טעימים ובטוחים להכנה!",
    ctaLabel: "📸 נסה/י צילום עכשיו",
    action: "camera",
  },
  {
    id: "chat-history",
    audience: "all",
    emoji: "🕘",
    badge: "נוחות",
    title: "חזרה לשיחות קודמות והמשך מאותה נקודה",
    titleChild: "כל השיחות והרעיונות שלכם שמורים!",
    description:
      "אפשר לחזור לכל שיחה קודמת מהתפריט העליון או ממסך הפתיחה ולהמשיך אותה בדיוק מאיפה שהפסקתם.",
    descriptionChild:
      "אהבתם הצעה לכריך מאתמול? בלחיצה אחת אפשר לפתוח שיחות קודמות ולהמשיך אותן מאותו מקום.",
    ctaLabel: "📂 לשיחות הקודמות",
    action: "history",
  },
  {
    id: "smart-shopping-list",
    audience: "parent",
    emoji: "🛒",
    badge: "להורים",
    title: "רשימת קניות שבועית חכמה + העתקה לוואטסאפ",
    description:
      "הפקת רשימת קניות מותאמת אישית לפי מה שהילדים אוהבים ומה שהם ביקשו לנסות בשיחות, מסודרת לפי מחלקות בסופר ומוכנה להעתקה בלחיצה לוואטסאפ.",
    ctaLabel: "🛒 פתח רשימת קניות",
    action: "shopping",
  },
  {
    id: "parent-concierge",
    audience: "parent",
    emoji: "🥪",
    badge: "להורים",
    title: "צ'אט הורים חכם לתכנון כריכים וארוחות",
    description:
      "הצ'אט שלכם מכיר את הפרופילים, ההעדפות והבקשות של כל הילדים במשפחה ועוזר לתכנן כריכים לבוקר או ארוחה משפחתית שכולם יאהבו.",
    ctaLabel: "💬 תכנן כריכים למחר",
    action: "parent_prompt",
  },
  {
    id: "kids-insights",
    audience: "parent",
    emoji: "📊",
    badge: "להורים",
    title: "סקירת שימוש ותובנות AI על הילדים",
    description:
      "לוח בקרה שמציג כמה הילדים משתמשים באפליקציה, על אילו נושאים הם מתייעצים, והמלצות AI לשיפור התזונה והמזווה בבית.",
    ctaLabel: "📊 לדוח התובנות",
    action: "insights",
  },
];
