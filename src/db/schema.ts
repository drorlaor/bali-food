import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const systemConfig = sqliteTable("system_config", {
  id: text("id").primaryKey(),
  masterSystemPrompt: text("master_system_prompt").notNull(),
  baselinePantryJson: text("baseline_pantry_json").notNull(),
  modelName: text("model_name").notNull().default("gemini-3.8-flash"),
  quickPromptsJson: text("quick_prompts_json").notNull(),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["parent", "child"] }).notNull(),
  avatarUrl: text("avatar_url"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at"),
});

export const childStaticProfiles = sqliteTable("child_static_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  birthYear: integer("birth_year").notNull(),
  activityProfile: text("activity_profile").notNull(),
  kitchenPermissions: text("kitchen_permissions").notNull(),
  medicalOrDietaryNotes: text("medical_or_dietary_notes").notNull(),
  parentCustomDirectives: text("parent_custom_directives").notNull(),
  updatedAt: text("updated_at"),
});

export const MEMORY_CATEGORIES = [
  "liked_ingredient",
  "disliked_ingredient",
  "favorite_meal",
  "wishlist_to_try",
  "habit_or_context",
] as const;
export const NUTRITIONAL_GROUPS = [
  "protein",
  "carb",
  "veg_fruit",
  "fat_spread",
  "complete_meal",
  "other",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type NutritionalGroup = (typeof NUTRITIONAL_GROUPS)[number];

export const childMemoryFacts = sqliteTable("child_memory_facts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category", { enum: MEMORY_CATEGORIES }).notNull(),
  nutritionalGroup: text("nutritional_group", { enum: NUTRITIONAL_GROUPS }).notNull(),
  itemOrFact: text("item_or_fact").notNull(),
  notes: text("notes"),
  sourceMessageId: text("source_message_id"),
  createdBy: text("created_by", { enum: ["ai", "parent"] }).notNull(),
  createdAt: text("created_at"),
});

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  toolCallsJson: text("tool_calls_json"),
  createdAt: text("created_at"),
});

export const aiErrorLogs = sqliteTable("ai_error_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => chatSessions.id, { onDelete: "set null" }),
  modelName: text("model_name").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message").notNull(),
  promptSummary: text("prompt_summary"),
  createdAt: text("created_at"),
});

export type User = typeof users.$inferSelect;
export type ChildProfile = typeof childStaticProfiles.$inferSelect;
export type MemoryFact = typeof childMemoryFacts.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type AiErrorLog = typeof aiErrorLogs.$inferSelect;
