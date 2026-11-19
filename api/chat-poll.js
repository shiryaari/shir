const { verify } = require("../lib/token");
const store = require("../lib/store");
const live = require("../lib/live");
const { cors } = require("../lib/http");

// הודעות חדשות בסשן (של כל הצופות ושל שיר)
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  const s = verify(req.query && req.query.t);
  if (!s) return res.status(401).json({ error: "bad_token" });
  res.setHeader("Cache-Control", "no-store");
  const messages = await live.messagesAfter(s.s, req.query.after, s.id);
  res.status(200).json({ messages });
};
