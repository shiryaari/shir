const cfg = require("../webinar.config");
const { verify } = require("../lib/token");
const { sendToMake } = require("../lib/make");
const { cors, body } = require("../lib/http");

const ALLOWED = new Set(["joined", "progress", "left", "questionnaire_opened", "questionnaire_submitted", "chat_message"]);

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

  try {
    await sendToMake({
      event: b.event,
      registration_id: s.id,
      name: s.n, email: s.e, phone: s.p,
      session_start: new Date(s.s).toISOString(),
      webinar: cfg.title,
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "make_failed" });
  }
  res.status(200).json({ ok: true });
};
