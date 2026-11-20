const cfg = require("../webinar.config");
const store = require("../lib/store");
const { buildReport } = require("../lib/report");
const { sendToMake } = require("../lib/make");
const { cors } = require("../lib/http");
const crypto = require("crypto");

function ok(secret) {
  const s = process.env.CRON_SECRET || process.env.HOST_SECRET;
  if (!s || typeof secret !== "string") return false;
  const a = Buffer.from(secret), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// נקרא כל כמה דקות (סנריו מתוזמן ב-Make). שולח דוח לכל סשן שהסתיים ועוד לא דווח עליו.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!ok(req.query && req.query.secret)) return res.status(401).json({ error: "bad_secret" });
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  const graceMs = 5 * 60 * 1000;
  const now = Date.now();
  const rows = await store.after("sessions:all", now - 3 * 86400000, 200); // סשנים מ-3 הימים האחרונים
  const sent = [];
  for (const { member } of rows) {
    const start = Number(member);
    if (start + cfg.durationSeconds * 1000 + graceMs > now) continue; // עוד לא הסתיים
    const flag = `reported:${start}`;
    if ((await store.after(flag, 0, 1)).length) continue;
    const report = await buildReport(start);
    if (!report.registered.length) { await store.zadd(flag, 1, "empty"); continue; }
    await sendToMake(report, "ended");
    await store.zadd(flag, 1, "sent");
    sent.push({ session: start, registered: report.summary.total_registered, showed_up: report.summary.total_showed_up });
  }
  res.status(200).json({ ok: true, sent });
};
