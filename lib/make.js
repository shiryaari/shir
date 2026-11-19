// שולח אירוע ל-Make. בלי MAKE_WEBHOOK_URL רק מדפיס ללוג (מצב בדיקה).
async function sendToMake(data) {
  const url = process.env.MAKE_WEBHOOK_URL;
  const payload = { ...data, sent_at: new Date().toISOString() };
  if (!url) {
    console.log("[make:dry-run]", JSON.stringify(payload));
    return { dryRun: true };
  }
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Make webhook responded ${r.status}`);
  return { ok: true };
}
module.exports = { sendToMake };
