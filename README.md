# bali-food - "בא לי"

A private, mobile-first RTL Hebrew PWA that helps the kids in the family choose healthy meals, school sandwiches and snacks
through a Gemini-powered chat. Parents get a full admin dashboard.

## Stack
Next.js 15 (App Router, TS) - Tailwind CSS v4 - Drizzle ORM + LibSQL (local SQLite / Turso) - Auth.js v5 (Google, scopes `openid email profile` only) - `@google/genai` (`gemini-2.5-flash` + function calling).

## Local development
```bash
cp .env.example .env      # set GEMINI_API_KEY at minimum
npm install
npm run dev
```
With `DEV_BYPASS_AUTH="true"` the DB is created and seeded automatically with a parent and three demo children
(נועה 2012, איתי 2014, מאיה 2017). Use the purple **DEV** button (bottom-left) to switch users.

Tables are created automatically (`CREATE TABLE IF NOT EXISTS`) on first request. You can also run `npm run db:push` (Drizzle) or `npm run db:seed`.

## Deploy to Vercel
1. Create a Turso DB: `turso db create bali-food`, get URL + token (`turso db tokens create bali-food`).
2. In Google Cloud Console create an OAuth client (Web). Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`.
3. Vercel env vars: `DATABASE_URL` (libsql://...), `DATABASE_AUTH_TOKEN`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `INITIAL_PARENT_EMAIL`. **Do not set `DEV_BYPASS_AUTH` in production.**
4. Log in with `INITIAL_PARENT_EMAIL` - you become the parent admin. Add the kids' Google emails in "ניהול משתמשים".

## Security model
- Allowlist: only active emails in `users` (or `INITIAL_PARENT_EMAIL`) can sign in.
- Children can only access `/chat`, `/api/chat`, `/api/me`. Every `/api/admin/*` handler calls `requireParent()`.
- AI memory tools (`save_child_preference`, `remove_child_preference`) are always scoped to the authenticated user id.
