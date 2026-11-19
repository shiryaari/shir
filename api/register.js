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

  try {
    await sendToMake({
      event: "registered",
      registration_id: id,
      name, email, phone,
      session_start: new Date(start).toISOString(),
      session_start_ms: start,
      room_url: roomUrl,
      webinar: cfg.title,
      source: b.source || "",
      utm: b.utm || {},
    });
  } catch (err) {
    console.error(err);
    return res.status(502).json({ error: "make_failed" });
  }

  res.status(200).json({ ok: true, token, roomUrl, start });
};
