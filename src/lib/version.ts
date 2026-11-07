export const APP_VERSION = "1.5.1";
export const FEATURE_RELEASE_ID = "1.5.1";
export const BUILD_TIME = "2026-11-07 17:46";
export const VERSION_NOTES =
  "חדש! צילום מצרכים מהמקרר או מהשיש (במצלמה או מהגלריה) להמלצות חכמות לכריכים וארוחות";

export type WhatsNewAction = "camera" | "history" | "shopping" | "parent_prompt" | "insights";

export interface WhatsNewItem {
  id: string;
  releaseId: string;
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

/**
 * Contains only the new feature(s) introduced in the current FEATURE_RELEASE_ID.
 */
export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    id: "fridge-vision",
    releaseId: FEATURE_RELEASE_ID,
    audience: "all",
    emoji: "📸",
    badge: "חדש בגרסה זו!",
    title: "צילום מצרכים מהמקרר או מהשיש",
    titleChild: "צלמו מה יש במקרר וגלו מה להכין!",
    description:
      "מצלמים עד 3 תמונות של מדפי המקרר או השיש (או בוחרים מהגלריה), וה-AI מזהה את המצרכים ומציע כריכים וארוחות בשילוב המזווה הביתי.",
    descriptionChild:
      "לא בטוחים מה בא לכם לאכול? צלמו את המקרר או השיש (עד 3 תמונות) ו\"בא לי\" יזהה את המצרכים ויציע לכם רעיונות טעימים ובטוחים להכנה!",
    ctaLabel: "📸 נסה/י צילום עכשיו",
    action: "camera",
  },
];
