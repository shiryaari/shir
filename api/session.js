const cfg = require("../webinar.config");
const { verify } = require("../lib/token");
const { cors } = require("../lib/http");

// מחזיר לחדר את פרטי הנרשמת והתצורה הציבורית. הכול מאומת לפי הטוקן.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const s = verify(req.query && req.query.t);
  if (!s) return res.status(401).json({ error: "bad_token" });

  const first = s.n.split(" ")[0];
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    name: s.n,
    firstName: first,
    email: s.e,
    phone: s.p,
    id: s.id,
    start: s.s,
    serverNow: Date.now(),
    config: {
      title: cfg.title,
      hostName: cfg.hostName,
      badge: cfg.badge,
      vimeoId: cfg.vimeoId,
      youtubeId: cfg.youtubeId,
      durationSeconds: cfg.durationSeconds,
      chat: cfg.chat,
      chatReplay: cfg.chatReplay,
      replies: cfg.replies,
      questionnaire: cfg.questionnaire,
      progressMilestones: cfg.progressMilestones,
      endedMessage: cfg.endedMessage,
    },
  });
};
