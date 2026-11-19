const crypto = require("crypto");
const cfg = require("../webinar.config");
const { sign } = require("../lib/token");
const { sendToMake } = require("../lib/make");
const { isValidSlot } = require("../lib/slots");
const { cors, body, siteUrl } = require("../lib/http");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const b = body(req);
  const name = String(b.name || "").trim().slice(0, 80);
  const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
  const phone = String(b.phone || "").trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: "name_required" });
  if (!EMAIL.test(email)) return res.status(400).json({ error: "email_invalid" });

  const now = Date.now();
  let start;
  if (b.slot === "now") {
    start = now + cfg.instantDelaySeconds * 1000;
  } else {
    start = Number(b.slot);
    if (!isValidSlot(cfg.slots, start) || start < now - 60000) {
      return res.status(400).json({ error: "slot_invalid" });
    }
  }

  const id = crypto.randomBytes(6).toString("hex");
  const token = sign({ id, n: name, e: email, p: phone, s: start });
  const roomUrl = `${siteUrl(req)}/room.html?t=${token}`;

  const str = (v) => String(v || "").slice(0, 200);
  const utm = b.utm && typeof b.utm === "object" ? b.utm : {};
  const attribution = {
    ref: str(b.ref || b.source),
    utm_source: str(b.utm_source || utm.utm_source),
    utm_medium: str(b.utm_medium || utm.utm_medium),
    utm_campaign: str(b.utm_campaign || utm.utm_campaign),
    utm_content: str(b.utm_content || utm.utm_content),
    utm_term: str(b.utm_term || utm.utm_term),
    fbclid: str(b.fbclid),
  };

  try {
    // 1. ההרשמה, באותו מבנה ש-Talexa שלחה ("lead"), לסנריו ההרשמה הקיים
    await sendToMake({
      event: "lead",
      event_id: id,
      registered_at: new Date(now).toISOString(),
      full_name: name, name, email, phone,
      ...attribution,
      room_url: roomUrl,
      session_start: new Date(start).toISOString(),
      webinar: cfg.title,
    }, "registration");
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "make_failed" });
  }

  try {
    // 2. אירוע "registered" לסנריו אירועי החדר (קישור אישי ומועד הסשן, לתזכורות)
    await sendToMake({
      event: "registered",
      registration_id: id,
      name, email, phone,
      session_start: new Date(start).toISOString(),
      session_start_ms: start,
      room_url: roomUrl,
      webinar: cfg.title,
      ...attribution,
    }, "events");
  } catch (err) {
    console.error(err); // לא חוסם את ההרשמה
  }

  res.status(200).json({ ok: true, id, token, roomUrl, start });
};
