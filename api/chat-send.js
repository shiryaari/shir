const cfg = require("../webinar.config");
const { verify } = require("../lib/token");
const store = require("../lib/store");
const live = require("../lib/live");
const { cors, body } = require("../lib/http");

// צופה שולחת הודעה לצ'אט החי של הסשן שלה
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  const b = body(req);
  const s = verify(b.t);
  if (!s) return res.status(401).json({ error: "bad_token" });
  const text = live.clean(b.text);
  if (!text) return res.status(400).json({ error: "empty" });
  const r = await live.addMessage(s.s, { role: "viewer", from: s.n.split(" ")[0], text, rid: s.id });
  res.status(200).json({ ok: true, ...r });
};
