const cfg = require("../webinar.config");
const store = require("../lib/store");
const live = require("../lib/live");
const { cors, body } = require("../lib/http");

// שיר עונה מהמסך: התשובה מופיעה בצ'אט של כל הצופות בסשן
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.HOST_SECRET) return res.status(503).json({ error: "no_host_secret" });
  const b = body(req);
  if (!live.hostOk(b.secret)) return res.status(401).json({ error: "bad_secret" });
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  const text = live.clean(b.text);
  const session = Number(b.session);
  if (!text || !Number.isFinite(session)) return res.status(400).json({ error: "bad_request" });
  const r = await live.addMessage(session, { role: "host", from: (cfg.liveChat && cfg.liveChat.hostName) || "שיר", text });
  res.status(200).json({ ok: true, ...r });
};
