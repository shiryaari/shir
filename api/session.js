const cfg = require("../webinar.config");
const { verify } = require("../lib/token");
const { cors } = require("../lib/http");

// מחזיר לחדר את פרטי הנרשמת והתצורה הציבורית. הכול מאומת לפי הטוקן.
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const { t, preview } = req.query || {};
  const previewAt = preview === "questionnaire" ? 30 * 60 + 50
    : preview === "pitch" ? 48 * 60 + 40
      : preview === "testimonials" ? 56 * 60 + 15 : null;
  const now = Date.now();
  const s = previewAt === null
    ? verify(t)
    : { n: "צופה לדוגמה", s: now - previewAt * 1000 };
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
    serverNow: now,
    preview: previewAt !== null,
    config: {
      title: cfg.title,
      hostName: cfg.hostName,
      badge: cfg.badge,
      vimeoId: cfg.vimeoId,
      youtubeId: cfg.youtubeId,
      durationSeconds: cfg.durationSeconds,
      chat: cfg.chat,
      chatReplay: cfg.chatReplay,
      liveChat: previewAt === null ? cfg.liveChat : { enabled: false },
      replies: cfg.replies,
      questionnaire: cfg.questionnaire,
      roomActivity: cfg.roomActivity,
      progressMilestones: cfg.progressMilestones,
      endedMessage: cfg.endedMessage,
    },
  });
};
