# חדר וובינר אוטומטי

חדר וובינר מוקלט ואינטראקטיבי: סרטון מ-Vimeo שרץ לפי מועד הסשן של כל נרשמת, צ'אט עם הודעות מתוזמנות ותגובות, שאלון באמצע, ואירועים שנשלחים ל-Make (ומשם ל-CRM, ManyChat ורב מסר).
אין בסיס נתונים: ה-CRM ו-Make הם המאגר. הקישור האישי של כל נרשמת הוא טוקן חתום.

## מה לערוך
הכול ב-`webinar.config.js`: מזהה Vimeo, אורך, הודעות הצ'אט, תגובות, דקת השאלון ושם המארחת.

## הרצה מקומית
```
cp .env.example .env     # ולמלא SIGNING_SECRET
npm run dev              # http://localhost:3000
npm test                 # בדיקת עשן מקצה לקצה
```
בלי `MAKE_WEBHOOK_URL` האירועים רק מודפסים בטרמינל. בלי `vimeoId` החדר רץ במצב בדיקה.

## העלאה לאוויר (Vercel)
1. מחברים את הריפו ל-Vercel (Framework: Other, בלי build).
2. ב-Environment Variables: `SIGNING_SECRET` (מחרוזת אקראית ארוכה), `MAKE_REGISTRATION_WEBHOOK_URL` (ה-webhook של סנריו ההרשמה הקיים, מקבל את ההרשמה באותו מבנה ש-Talexa שלחה), `MAKE_EVENTS_WEBHOOK_URL` (סנריו אירועי החדר), `SITE_URL` (הכתובת הסופית), `ALLOWED_ORIGINS` (הדומיין של דף הנחיתה).
3. מחברים תת-דומיין, למשל `webinar.הדומיין-שלך.co.il`.

## יוטיוב (חלופה ל-Vimeo)
שמים ב-`youtubeId` את המזהה מהקישור והסרטון מועלה כ"לא רשום" (Unlisted). ביוטיוב אי אפשר להגביל הטמעה לדומיין, לכן מי שימצא את הקישור יוכל לצפות בסרטון מחוץ לחדר. ל-Vimeo יש הגבלה כזאת, ולכן הוא עדיף.

## Vimeo
בהגדרות הסרטון: Privacy → Hide from Vimeo, ו-Where can this be embedded → Specific domains → הדומיין של החדר. לסרטון פרטי שמים ב-`vimeoId` את `מספר/hash`.

## חיבור דף הנחיתה שלך
הטופס שולח `POST /api/register` (JSON) לכתובת החדר:
```js
const r = await fetch("https://webinar.YOUR-DOMAIN/api/register", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ name, email, phone, slot: "now" /* או מספר ms מ-/api/slots */ })
});
const { roomUrl } = await r.json();
location.href = "https://webinar.YOUR-DOMAIN/thanks.html?t=" + new URL(roomUrl).searchParams.get("t");
```
אחרי ההרשמה מעבירים את הנרשמת לדף התודה שלך עם `email` ו-`lead_id` (זה אותו `registration_id` שמגיע ל-Make, וכך אפשר לחבר את תשובות השאלון לנרשמת):
```js
const { id } = await r.json();
location.href = "https://shir-yaari.co.il/webinar-intro/?email=" + encodeURIComponent(email) + "&lead_id=" + id + "&ref=landing";
```

`GET /api/slots` מחזיר את המועדים הקרובים. `public/index.html` היא דוגמה עובדת.

## אירועים שמגיעים ל-Make
כל אירוע הוא POST ל-webhook עם `event`, `name`, `email`, `phone`, `registration_id`, `session_start`, `webinar`, ו-`data` לפי האירוע:

| event | מתי | data |
|---|---|---|
| `registered` | הרשמה | `room_url`, `session_start_ms` |
| `joined` | לחצה "כניסה" | `joined_at_second` |
| `progress` | 25/50/75/100% | `percent`, `watched_seconds` |
| `questionnaire_opened` | פתחה שאלון | |
| `questionnaire_submitted` | שלחה שאלון | `answers` |
| `chat_message` | כתבה בצ'אט | `text`, `at_second` |
| `left` | יצאה | `watched_seconds`, `at_second` |

## סנריו ב-Make
הרשמה נשלחת לסנריו הקיים באותו מבנה של Talexa (`event: "lead"`), ולכן הפיקסל, פייפדרייב, הגיליון ורב מסר ממשיכים לעבוד. אירועי החדר מטופלים בסנריו חדש ("וובינר אוטומטי חדש | אירועי החדר → פייפדרייב") שמעדכן את שדות הוובינר בעסקה ב-Pipedrive. ההצעה המקורית:

1. **Custom webhook** מקבל הכול, **Router** לפי `event`.
2. `registered` → יצירת איש קשר ב-CRM וברב מסר, תגית ב-ManyChat, שליחת `room_url` במייל ובוואטסאפ. אחר כך **Sleep** עד 24 שעות, שעה, ו-10 דקות לפני `session_start`, ובכל אחד שליחת תזכורת (בוואטסאפ מחוץ ל-24 שעות צריך תבנית מאושרת).
3. **"לא הגיעה":** אחרי `session_start` + 10 דקות, בודקים ב-CRM אם יש תגית `webinar_attended`. אם אין, מסמנים `webinar_missed` ושולחים הודעת החמצה.
4. `joined` → תגית `webinar_attended`. `questionnaire_submitted` → שמירת התשובות ב-CRM ושליחת הודעה לפי התשובה.

## שקיפות
החדר מציג "וובינר מוקלט ואינטראקטיבי". אל תציגי משתתפות מדומות כלקוחות אמיתיות.

## צ'אט מקובץ
אם יש לך צ'אט אמיתי משידור קודם (ייצוא של Zoom או של פלטפורמה אחרת), שמרי אותו כ-CSV בעמודות `זמן, שם, הודעה` ופני:
```
node scripts/import-chat.js chat.csv            # שמות כמו בקובץ
node scripts/import-chat.js chat.csv --first-names   # שם פרטי בלבד
```
הסקריפט כותב את `public/chat-replay.json` והחדר מציג את ההודעות בדקות שלהן. אפשר להגדיר טקסט בכותרת הצ'אט ב-`chatReplay.label` (ריק = לא מוצג). כל עוד הקובץ ריק לא מוצג כלום.
