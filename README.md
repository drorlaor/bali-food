# 🥪 בא לי (bali-food)

אפליקציית Web & PWA מודרנית ומותאמת מובייל בעברית (RTL), המסייעת לילדי המשפחה לבחור באופן עצמאי כריכים לבית הספר, ארוחות צהריים ונשנושים בריאים בליווי עוזר בינה מלאכותית אישי, מעודד וחם (מבוסס Google Gemini). 

ההורים נהנים מלוח בקרה מקיף (Admin Dashboard) לעיצוב חוקת התזונה של הבית, ניהול המזווה, מעקב אחר פרופילי הילדים והזיכרון הנלמד, צפייה בתמלילי השיחות ויומן שגיאות ובקרה.

---

## 📑 תוכן עניינים
1. [תכונות מרכזיות](#-תכונות-מרכזיות)
2. [מדריך שימוש למשתמש ולהורים](#-מדריך-שימוש-למשתמש-ולהורים)
   - [חוויית הילדים (צ'אט אישי)](#1-חוויית-הילדים-צ'אט-אישי)
   - [לוח הבקרה להורים (Admin)](#2-לוח-הבקרה-להורים-admin)
3. [הקמה ופריסה בסביבת ייצור (Production Setup)](#-הקמה-ופריסה-בסביבת-ייצור-production-setup)
   - [דרישות מוקדמות וארכיטקטורה](#ארכיטקטורת-הייצור)
   - [שלב א': הקמת מסד נתונים בענן (Turso)](#שלב-א-הקמת-מסד-נתונים-בענן-turso)
   - [שלב ב': הגדרת Google OAuth עבור חשבונות ילדים (Family Link)](#שלב-ב-הגדרת-google-oauth-עבור-חשבונות-ילדים-family-link)
   - [שלב ג': הגדרת מפתח Gemini ומניעת חסימת מכסות (Pay-As-You-Go)](#שלב-ג-הגדרת-מפתח-gemini-ומניעת-חסימת-מכסות-pay-as-you-go)
   - [שלב ד': פריסה ל-Vercel והגדרת משתני סביבה](#שלב-ד-פריסה-ל-vercel-והגדרת-משתני-סביבה)
   - [שלב ה': כניסה ראשונית והפעלת המערכת](#שלב-ה-כניסה-ראשונית-והפעלת-המערכת)
4. [פיתוח והרצה מקומית (Local Development)](#-פיתוח-והרצה-מקומית-local-development)
5. [טבלת משתני סביבה (Environment Variables)](#-טבלת-משתני-סביבה-environment-variables)
6. [פתרון תקלות נפוצות (Production Troubleshooting)](#-פתרון-תקלות-נפוצות-production-troubleshooting)

---

## ✨ תכונות מרכזיות

- **Mobile-First & PWA**: ממשק מגע מלוטש, תמיכה מלאה בהתקנה למסך הבית (Add to Home Screen) באייפון ובאנדרואיד, כותרות מותאמות ואייקונים ייעודיים.
- **RTL & עברית טבעית**: מעוצב ייעודית לפונט `Rubik`, עם יישור לימין, שפה מותאמת לגילאי הילדים וסגנון דיבור חם ומעצים.
- **תאימות מלאה ל-Google Family Link**: שימוש במינימום הרשאות OAuth נדרשות (`openid email profile` בלבד), המאפשר כניסה ישירה מחשבונות ילדים מנוהלים בגוגל ללא חסימות הורים.
- **זיכרון דינמי מבודד (Dynamic Memory & Function Calling)**: העוזר לומד תוך כדי שיחה מה הילד אוהב, ממה נמאס לו, ומה מתחשק לו לנסות - ושומר זאת בזיכרון המבודד אך ורק לחשבון של אותו ילד.
- **מנגנון חסינות ועמידות לנפילות AI**: שרשרת Fallback אוטומטית בין דגמי Gemini (`gemini-3.5-flash`, `gemini-3.8-flash`, `gemini-3.6-flash`), יומן תקלות ייעודי להורים, ומענה חם וידידותי לילד במקרי עומס קיצוני.
- **התראות עדכון גרסה בזמן אמת**: ברגע שמועלית גרסה חדשה לשרת, המשתמשים מקבלים באנר עדכון אלגנטי עם כפתור רענון בלחיצה אחת.

---

## 📱 מדריך שימוש למשתמש ולהורים

### 1. חוויית הילדים (צ'אט אישי)
- **כניסה והתחברות**: הילד נכנס לכתובת האפליקציה (או דרך האייקון במסך הבית) ומתחבר בלחיצה אחת באמצעות חשבון הגוגל שלו.
- **הוספה למסך הבית (PWA)**:
  - **באייפון (Safari)**: לחיצה על כפתור השיתוף (Share) בתחתית הדפדפן -> בחירה ב-**"הוסף למסך הבית"** (Add to Home Screen).
  - **באנדרואיד (Chrome)**: לחיצה על תפריט 3 הנקודות -> **"התקנת אפליקציה"** או **"הוספה למסך הבית"**.
- **שיחה עם "בא לי"**:
  - הילד יכול לשאול מה כדאי לקחת מחר לבית ספר, לבקש רעיונות לשדרוג כריך טוסט, לשאול מה אפשר לנשנש אחה"צ, או לבקש מתכון קל.
  - "בא לי" מתחשב במזווה הביתי, בחוקת התזונה של ההורים, ובמה שהילד אוהב או לא אוהב.
  - אם הילד מציין *"נמאס לי מטונה"* או *"בא לי לנסות ממרח אבוקדו"*, העוזר מעדכן את הזיכרון האישי שלו אוטומטית.

### 2. לוח הבקרה להורים (Admin)
גישה ללוח הבקרה מתאפשרת אך ורק להורים שמוגדרים כ-`parent` (ניתן לגשת דרך קישור **"ניהול הורים"** במסך הראשי או ישירות לכתובת `/admin`).

הלוח מחולק לארבע לשוניות:
1. **חוקת התזונה והמזווה (`/admin?tab=config`)**:
   - **חוקת התזונה של הבית**: הנחיות יסוד לעוזר ה-AI (לדוגמה: תמיד להציע ירק לצד כריך, להימנע מממרחים מתוקים מדי באמצע שבוע, להקפיד על שתיית מים).
   - **רשימת המזווה והמקרר**: פירוט המאכלים, הירקות, הלחמים והגבינות הזמינים כרגע בבית.
   - **שילובים מועדפים ומאושרים**: רעיונות לכריכים מנצחים שהמשפחה אוהבת.
   - **בחירת מודל בינה מלאכותית**: בחירת מודל ברירת המחדל (מומלץ: `gemini-3.5-flash`).
2. **פרופילי ילדים וזיכרון (`/admin?tab=children`)**:
   - בחירת הילד מהרשימה.
   - **פרופיל סטטי קבוע**: שנת לידה, רגישויות ואלרגיות, קווים אדומים (למשל: "לא חריף בכלל"), והערות אישיות.
   - **זיכרון דינמי (מה שה-AI למד)**: תצוגה מקוטלגת של כל מה שה-AI שמר משיחות הילד (אוהב, לא אוהב, רוצה לנסות, הרגלים). ההורה יכול למחוק או לערוך כל עובדה בכל רגע.
3. **יומן שיחות ובקרה (`/admin?tab=audit`)**:
   - **תמלילי שיחות ילדים**: צפייה מלאה בכל היסטוריית השיחות של כל ילד, כולל שעה מדויקת והפעלת כלי זיכרון (Tools Calling).
   - **יומן שגיאות והתראות AI**: תיעוד חי של כל שגיאה טכנית או חריגת מכסה שהתרחשה (כולל פירוט השגיאה הטכנית, דגם המודל, והשאלה שנשאלה) וכפתור לניקוי היומן.
4. **ניהול משתמשים (`/admin?tab=users`)**:
   - צפייה בכל המשתמשים המורשים.
   - הוספת ילד חדש או הורה נוסף באמצעות כתובת Gmail (מנגנון רשימה לבנה - Allowlist).
   - עריכת שמות תצוגה או השבתת משתמשים.

---

## 🚀 הקמה ופריסה בסביבת ייצור (Production Setup)

### ארכיטקטורת הייצור
- **Hosting**: [Vercel](https://vercel.com) (Next.js App Router Serverless Functions).
- **Database**: [Turso Cloud](https://turso.tech) (Remote SQLite / libSQL over HTTP).
- **Auth**: Google OAuth 2.0 (Scopes: `openid email profile` בלבד).
- **AI Engine**: Google AI Studio Gemini API (`gemini-3.5-flash` / `gemini-3.6-flash`).

```
[ משתמש: דפדפן / PWA מובייל ]
              │
              ▼
   [ Vercel Edge / Serverless ]  ── NextAuth (Google OAuth)
              │
              ├──────────► [ Turso libSQL Cloud DB ] (נתונים, פרופילים, יומנים)
              │
              └──────────► [ Google AI Studio API ] (Gemini 3.5/3.6 Flash)
```

---

### שלב א': הקמת מסד נתונים בענן (Turso)
1. צור חשבון חינמי ב-[Turso.tech](https://turso.tech).
2. התקן את ה-CLI של Turso או פתח את לוח הבקרה בדפדפן, וצור מסד נתונים חדש:
   ```bash
   turso db create bali-food
   ```
3. הוצא את כתובת ה-URL של המסד:
   ```bash
   turso db show bali-food --url
   # דוגמה: libsql://bali-food-yourname.aws-us-west-2.turso.io
   ```
4. צור טוקן גישה מאובטח ללא תפוגה:
   ```bash
   turso db tokens create bali-food
   ```
5. שמור בצד את `DATABASE_URL` ואת `DATABASE_AUTH_TOKEN`.
*(טבלאות המסד ייווצרו אוטומטית לחלוטין בפנייה הראשונה לאפליקציה בייצור).*

---

### שלב ב': הגדרת Google OAuth עבור חשבונות ילדים (Family Link)
כדי לאפשר כניסה חלקה של ילדים בעלי חשבון Google מנוהל (Google Family Link), חובה להשתמש ב-OAuth Web Application עם Scopes בסיסיים בלבד:

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com/).
2. צור פרויקט חדש או בחר פרויקט קיים (למשל `bali-food`).
3. תחת **APIs & Services** -> **OAuth consent screen**:
   - בחר ב-**External**.
   - שם אפליקציה: `בא לי` (או `bali-food`).
   - הגדר את מייל התמיכה שלך.
   - ב-**Scopes**: בחר אך ורק את 3 הרשאות הבסיס: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. **אין לבחור שום הרשאה מעבר לכך!**
   - ב-**Test users**: הוסף את המיילים של ההורים והילדים (אם ה-Consent screen נשאר במצב Testing).
4. תחת **Credentials** -> **Create Credentials** -> **OAuth client ID**:
   - סוג יישום: **Web application**.
   - שם: `bali-food-web`.
   - **Authorized JavaScript origins**:
     - `https://<your-app-name>.vercel.app` (וכן דומיין מותאם אם יש).
     - `http://localhost:3000` (לפיתוח מקומי).
   - **Authorized redirect URIs**:
     - `https://<your-app-name>.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
5. שמור בצד את ה-`Client ID` ואת ה-`Client Secret`.

---

### שלב ג': הגדרת מפתח Gemini ומניעת חסימת מכסות (Pay-As-You-Go)
במסלול החינמי של מודלי ה-3.x ישנה הגבלה קשיחה של 20 בקשות ביום לכל הפרויקט. כדי להבטיח זמינות מלאה:

1. היכנס ל-[Google AI Studio](https://aistudio.google.com/apikey) והוצא מפתח API (`GEMINI_API_KEY`).
2. עבור ללוח התוכניות של AI Studio ב-[aistudio.google.com/plan_information](https://aistudio.google.com/plan_information) (או [Google Cloud Billing](https://console.cloud.google.com/billing)).
3. חבר את הפרויקט לחשבון חיוב (Billing Account).
4. בצע טעינה ראשונית של קרדיט (Prepay Balance - בדרך כלל $10 מינימום) והפעל **Auto-reload**.
   > **הערה לגבי עלויות**: מודלי Flash מתומחרים בסנטים בודדים למיליוני תווים. עבור שימוש משפחתי יומיומי, יתרה של $10 תספיק לחודשים ארוכים מאוד.

---

### שלב ד': פריסה ל-Vercel והגדרת משתני סביבה

1. דחף את הקוד לריפוזיטורי ב-GitHub (למשל `https://github.com/your-username/bali-food`).
2. היכנס ל-[Vercel Dashboard](https://vercel.com), לחץ על **Add New Project** ויבא (Import) את הריפוזיטורי.
3. בלשונית **Environment Variables**, הזן את המשתנים הבאים:

| שם משתנה | ערך לדוגמה | הערות |
| :--- | :--- | :--- |
| `DATABASE_URL` | `libsql://bali-food-xxx.turso.io` | כתובת המסד ב-Turso |
| `DATABASE_AUTH_TOKEN` | `eyJhbGci...` | טוקן ההתחברות של Turso |
| `GEMINI_API_KEY` | `AIzaSy...` | מפתח Google AI Studio |
| `GOOGLE_CLIENT_ID` | `12345...apps.googleusercontent.com` | מזהה לקוח מגוגל |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | סוד לקוח מגוגל |
| `NEXTAUTH_URL` | `https://<your-app>.vercel.app` | הכתובת המלאה ב-Vercel בייצור |
| `NEXTAUTH_SECRET` | מחרוזת אקראית באורך 32 תווים | צור ע"י `openssl rand -base64 32` |
| `INITIAL_PARENT_EMAIL` | `parent@gmail.com` | כתובת ה-Gmail של ההורה הראשון שיתחבר |

> [!CAUTION]
> **לעולם אל תגדיר `DEV_BYPASS_AUTH="true"` בסביבת ייצור ב-Vercel!**  
> משתנה זה נועד לפיתוח מקומי בלבד ועוקף את מנגנון האימות של Google OAuth.

4. לחץ על **Deploy**.
5. **חשוב מאוד - כיבוי הגנת Vercel**:  
   לאחר סיום ה-Deploy, גש ב-Vercel אל:  
   **Project Settings** -> **Deployment Protection** -> **Vercel Authentication**.  
   העבר למצב **Disabled** ושמור!  
   *(אם לא תכבה את ההגדרה הזו, כל ניסיון התחברות יופנה למסך כניסה של Vercel במקום לאפליקציה).*

---

### שלב ה': כניסה ראשונית והפעלת המערכת

1. פתח את הכתובת של האפליקציה ב-Vercel בדפדפן.
2. לחץ על **"התחברות עם Google"** והתחבר עם המייל שהוגדר ב-`INITIAL_PARENT_EMAIL`.
3. המערכת תזהה אותך כהורה מנהל ותפתח ישירות את לוח הבקרה.
4. גש ללשונית **"ניהול משתמשים"** והוסף את שאר בני המשפחה:
   - הוסף את כתובות ה-Gmail של הילדים והגדר אותם כ-`child`.
   - הוסף במידת הצורך הורה נוסף והגדר כ-`parent`.
5. כעת הילדים יכולים להיכנס לאפליקציה מהמכשירים הניידים שלהם, להתחבר, ולהתחיל לשוחח!

---

## 💻 פיתוח והרצה מקומית (Local Development)

### 1. דרישות קדם
- Node.js גרסה 18 ומעלה (מומלץ Node 20 LTS או 24 LTS).
- מנהל חבילות `npm`.
- מפתח `GEMINI_API_KEY` תקף מ-[Google AI Studio](https://aistudio.google.com).

### 2. התקנה והרצה
```bash
# 1. שכפול הריפוזיטורי
git clone https://github.com/your-username/bali-food.git
cd bali-food

# 2. התקנת תלויות
npm install

# 3. שכפול קובץ ההגדרות
cp .env.example .env
```

פתח את קובץ `.env` והגדר לפחות את:
```env
GEMINI_API_KEY="AIzaSy..."
DEV_BYPASS_AUTH="true"
DATABASE_URL="file:bali-food.db"
```

הפעל את שרת הפיתוח:
```bash
npm run dev
```
פתח את הדפדפן בכתובת: `http://localhost:3000`.

### 3. שימוש במצב פיתוח (Dev Switcher)
כאשר `DEV_BYPASS_AUTH="true"`, האפליקציה יוצרת מסד נתונים מקומי (`bali-food.db`) ומאכלסת אותו אוטומטית בהורה ובשלושה ילדי הדגמה (נועה, איתי, מאיה).
בפינה הימנית-תחתונה של המסך יופיע כפתור סגול **"מצב פיתוח (DEV)"**, המאפשר להחליף זהות משתמש בלחיצה אחת ללא צורך בהגדרת Google OAuth מקומי.

### 4. פקודות שימושיות
- `npm run dev` - הרצת שרת פיתוח מקומי עם Hot Reload.
- `npm run build` - בדיקת הידור מלאה ויצירת Build לייצור של Next.js.
- `npm run start` - הרצת שרת ה-Production מקומית.
- `npm run typecheck` - הרצת בדיקת טיפוסי TypeScript (`tsc --noEmit`).
- `npm run db:push` - עדכון מבנה הטבלאות במסד הנתונים באמצעות Drizzle Kit.
- `npm run db:studio` - פתיחת ממשק ויזואלי בדפדפן לצפייה במסד הנתונים (Drizzle Studio).

---

## 🔒 מודל אבטחה ופרטיות

- **רשימה לבנה בלבד (Allowlist Strict Access)**: רק משתמשים שהמייל שלהם נוסף מראש ע"י ההורים בלוח הבקרה יכולים לגשת למערכת. כל מייל לא מורשה נחסם מיידית.
- **הפרדת תפקידים קשיחה**: כל נתיבי ה-API ב-`/api/admin/*` מאמתים שהמשתמש נושא תפקיד `parent`. ילדים אינם יכולים לצפות במידע של ילדים אחרים או לגשת להגדרות המערכת.
- **בידוד זיכרון מוחלט**: כלי הזיכרון של ה-AI (`save_child_preference`, `remove_child_preference`) מוגבלים תמיד ומאומתים מול ה-`userId` של הילד המחובר באותו סשן.

---

## 🛠️ פתרון תקלות נפוצות (Production Troubleshooting)

### 1. שגיאת 429: "Quota exceeded for metric: generativelanguage.googleapis.com..."
- **הסיבה**: פרויקט ה-AI Studio נמצא ב-Free Tier המוגבל ל-20 בקשות ביום עבור מודלי 3.x.
- **הפתרון**: יש לחבר אמצעי תשלום (Pay-As-You-Go) ב-[Google Cloud Console Billing](https://console.cloud.google.com/billing), ולהטעין יתרה ראשונית ב-[Google AI Studio Plan Information](https://aistudio.google.com/plan_information).

### 2. כניסה לאפליקציה מציגה מסך התחברות של Vercel במקום כניסת גוגל
- **הסיבה**: מנגנון "Vercel Authentication" מופעל כברירת מחדל בפרויקט ב-Vercel.
- **הפתרון**: בלוח הבקרה של Vercel, גש אל **Settings** -> **Deployment Protection** -> **Vercel Authentication** והעבר ל-**Disabled**.

### 3. שגיאת `redirect_uri_mismatch` בעת התחברות עם Google
- **הסיבה**: כתובת ה-Callback לא הוגדרה במדויק ב-Google Cloud Console.
- **הפתרון**: ודא שב-Google Cloud Console, תחת **Authorized redirect URIs**, הוספת בדיוק את:  
  `https://<your-exact-vercel-domain>.vercel.app/api/auth/callback/google`.

### 4. האפליקציה מבקשת הרשאות מיוחדות בחשבונות ילדים (Family Link)
- **הסיבה**: נוספו Scopes מיותרים ב-OAuth Consent Screen.
- **הפתרון**: ב-Google Cloud Console -> OAuth consent screen -> Edit, ודא שה-Scopes היחידים הם `openid`, `email`, `profile`.

---

נבנה באהבה עבור המשפחה 🥗 בריא, פשוט ובא לי!
