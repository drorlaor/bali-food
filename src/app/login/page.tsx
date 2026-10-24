import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getCurrentUser, isDevBypass } from "@/lib/session";
import { Sparkles, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user && !isDevBypass()) redirect(user.role === "parent" ? "/admin" : "/chat");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card w-full max-w-sm animate-fade-up p-8 text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 animate-float items-center justify-center rounded-[28px] brand-gradient shadow-xl shadow-mango-500/30">
          <img src="/icon.svg" alt="" className="h-20 w-20" />
        </div>
        <h1 className="text-4xl font-extrabold brand-text">בא לי</h1>
        <p className="mt-2 text-stone-600">מה אוכלים היום? בואו נרכיב משהו טעים ומזין יחד</p>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            החשבון הזה לא מורשה להיכנס. בקשו מאבא או אמא להוסיף אתכם לרשימת המשפחה.
          </div>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button id="google-signin-btn" type="submit" className="btn-primary w-full py-3 text-base">
            <Sparkles size={18} /> כניסה עם Google
          </button>
        </form>

        {isDevBypass() && (
          <a id="dev-enter-link" href="/" className="btn-ghost mt-3 w-full">
            כניסה במצב פיתוח (ללא Google)
          </a>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-stone-400">
          <ShieldCheck size={14} /> אפליקציה משפחתית פרטית - כניסה לבני המשפחה בלבד
        </p>
      </div>
    </main>
  );
}
