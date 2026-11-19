// שולח אירוע ל-Make. בלי כתובת מוגדרת רק מדפיס ללוג (מצב בדיקה).
// target "registration": ההרשמה, באותו מבנה ש-Talexa שלחה (כך שהסנריו הקיים ממשיך לעבוד)
// target "events": כל שאר האירועים (נכנסה, התקדמות, יצאה, צ'אט...)
const URLS = {
  registration: () => process.env.MAKE_REGISTRATION_WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL,
  events: () => process.env.MAKE_EVENTS_WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL,
};

async function sendToMake(data, target = "events") {
  const url = URLS[target]();
  const payload = { ...data, sent_at: new Date().toISOString() };
  if (!url) {
    console.log(`[make:dry-run:${target}]`, JSON.stringify(payload));
    return { dryRun: true };
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Make webhook (${target}) responded ${r.status}`);
  return { ok: true };
}
module.exports = { sendToMake };
