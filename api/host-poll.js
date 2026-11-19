const store = require("../lib/store");
const live = require("../lib/live");
const { cors } = require("../lib/http");

// מסך הניהול: הודעות הסשן (ברירת מחדל: הסשן האחרון שיש בו פעילות)
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!process.env.HOST_SECRET) return res.status(503).json({ error: "no_host_secret" });
  if (!live.hostOk(req.query && req.query.secret)) return res.status(401).json({ error: "bad_secret" });
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  res.setHeader("Cache-Control", "no-store");
  const session = (req.query.session && String(req.query.session)) || (await store.latest("chat:sessions"));
  if (!session) return res.status(200).json({ session: null, messages: [] });
  const messages = await live.messagesAfter(session, req.query.after, "");
  res.status(200).json({ session: Number(session), messages });
};
