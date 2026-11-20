const cfg = require("../webinar.config");
const { verify } = require("../lib/token");
const { sendToMake } = require("../lib/make");
const { cors, body, siteUrl } = require("../lib/http");
const store = require("../lib/store");

const ALLOWED = new Set(["joined", "progress", "left", "questionnaire_opened", "questionnaire_submitted", "chat_message", "replay"]);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const b = body(req);
  const s = verify(b.t);
  if (!s) return res.status(401).json({ error: "bad_token" });
  if (!ALLOWED.has(b.event)) return res.status(400).json({ error: "bad_event" });

  const data = b.data && typeof b.data === "object" ? b.data : {};
  // מגבילים גודל כדי שלא ישלחו זבל
  if (JSON.stringify(data).length > 8000) return res.status(413).json({ error: "too_large" });

  // שומרים לדוח סוף הסשן (אם יש אחסון)
  try {
    if (store.available()) {
      const key = b.event === "replay" ? `replay:${s.s}` : `ev:${s.s}`;
      await store.zadd(key, store.nextScore(), JSON.stringify({ rid: s.id, event: b.event, data, at: Date.now() }));
    }
  } catch (err) { console.error(err); }

  try {
    if (b.event === "replay") {
      // "צפו בהקלטה": אותו מבנה ש-Talexa שלחה, לסנריו "Integration Webhooks"
      await sendToMake({
        webinar_id: cfg.webinarId, webinar_title: cfg.title,
        session: { id: String(s.s), scheduled_at: new Date(s.s).toISOString() },
        registered: [], showed_up: [], converted: [],
        replay_viewers: [{
          name: s.n, email: s.e, phone: s.p,
          completion_pct: Math.min(100, Math.round(Number(data.completion_pct) || 0)),
          watch_time_seconds: Math.round(Number(data.watch_time_seconds) || 0),
          last_watched_at: new Date().toISOString(),
        }],
        summary: {},
      }, "ended");
    } else {
      await sendToMake({
        event: b.event,
        registration_id: s.id,
        name: s.n, email: s.e, phone: s.p,
        session_start: new Date(s.s).toISOString(),
        webinar: cfg.title,
        data,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "make_failed" });
  }
  res.status(200).json({ ok: true });
};
