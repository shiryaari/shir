const cfg = require("../webinar.config");
const { nextSlots, label } = require("../lib/slots");
const { cors } = require("../lib/http");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const slots = nextSlots(cfg.slots).map((ms) => ({ ms, label: label(cfg.slots, ms) }));
  res.status(200).json({ slots, instantDelaySeconds: cfg.instantDelaySeconds });
};
