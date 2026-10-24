import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { systemConfig } from "@/db/schema";
import { GLOBAL_CONFIG_ID } from "@/db/seed";
import { handleError, HttpError, requireParent } from "@/lib/session";
import { loadConfig } from "@/lib/prompt";
import type { HouseholdBaselinePantry } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireParent();
    return NextResponse.json(await loadConfig());
  } catch (err) {
    return handleError(err);
  }
}

const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 100) : [];

export async function PUT(req: Request) {
  try {
    const parent = await requireParent();
    const body = (await req.json()) as {
      masterSystemPrompt?: string;
      baselinePantry?: Partial<HouseholdBaselinePantry>;
      quickPrompts?: string[];
      modelName?: string;
    };
    if (typeof body.masterSystemPrompt !== "string" || !body.masterSystemPrompt.trim()) {
      throw new HttpError(400, "masterSystemPrompt is required");
    }
    const p = body.baselinePantry || {};
    const pantry: HouseholdBaselinePantry = {
      carbsAndBreads: cleanList(p.carbsAndBreads),
      proteins: cleanList(p.proteins),
      fatsAndSpreads: cleanList(p.fatsAndSpreads),
      veggiesAndFruits: cleanList(p.veggiesAndFruits),
      quickSnacks: cleanList(p.quickSnacks),
    };
    await getDb()
      .update(systemConfig)
      .set({
        masterSystemPrompt: body.masterSystemPrompt,
        baselinePantryJson: JSON.stringify(pantry),
        quickPromptsJson: JSON.stringify(cleanList(body.quickPrompts)),
        modelName: (body.modelName || "gemini-3.8-flash").trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: parent.email,
      })
      .where(eq(systemConfig.id, GLOBAL_CONFIG_ID));
    return NextResponse.json(await loadConfig());
  } catch (err) {
    return handleError(err);
  }
}
