export interface HouseholdBaselinePantry {
  carbsAndBreads: string[];
  proteins: string[];
  fatsAndSpreads: string[];
  veggiesAndFruits: string[];
  quickSnacks: string[];
}

export const PANTRY_LABELS: Record<keyof HouseholdBaselinePantry, string> = {
  carbsAndBreads: "פחמימות ולחמים",
  proteins: "חלבונים",
  fatsAndSpreads: "שומנים וממרחים",
  veggiesAndFruits: "ירקות ופירות",
  quickSnacks: "נשנושים מהירים",
};

export const CATEGORY_LABELS: Record<string, string> = {
  liked_ingredient: "אוהב/ת",
  disliked_ingredient: "לא אוהב/ת",
  favorite_meal: "ארוחה אהובה",
  wishlist_to_try: "רוצה לנסות",
  habit_or_context: "הרגל / הקשר",
};

export const GROUP_LABELS: Record<string, string> = {
  protein: "חלבון",
  carb: "פחמימה",
  veg_fruit: "ירק/פרי",
  fat_spread: "שומן/ממרח",
  complete_meal: "ארוחה שלמה",
  other: "אחר",
};

export interface MemoryUpdate {
  action: "save_child_preference" | "remove_child_preference";
  factId: string;
  category?: string;
  nutritionalGroup?: string;
  itemOrFact?: string;
  notes?: string | null;
  success: boolean;
  error?: string;
}

export function memoryUpdateLabel(u: MemoryUpdate): string {
  if (u.action === "save_child_preference") {
    return `נשמר בפרופיל: ${CATEGORY_LABELS[u.category || ""] || ""} ${u.itemOrFact || ""}`.trim();
  }
  return `הוסר מהפרופיל: ${u.itemOrFact || u.factId}`;
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
