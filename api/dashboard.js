const store = require("../lib/store");
const live = require("../lib/live");
const { dashboard } = require("../lib/dashboard");
const { cors } = require("../lib/http");

// נתוני הדשבורד. מוגן בסיסמת הניהול.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!process.env.HOST_SECRET) return res.status(503).json({ error: "no_host_secret" });
  if (!live.hostOk(req.query && req.query.secret)) return res.status(401).json({ error: "bad_secret" });
  if (!store.available()) return res.status(503).json({ error: "no_store" });
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(await dashboard(Number(req.query.days) || 60));
};
