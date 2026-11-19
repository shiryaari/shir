function hourIn(tz, ms) {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(ms);
  return Number(h);
}

function isValidSlot(cfg, ms) {
  const step = cfg.everyMinutes * 60000;
  if (!Number.isFinite(ms) || ms % step !== 0) return false;
  const h = hourIn(cfg.timezone, ms);
  return h >= cfg.fromHour && h < cfg.toHour;
}

function nextSlots(cfg, nowMs = Date.now(), count = cfg.count) {
  const step = cfg.everyMinutes * 60000;
  let t = Math.ceil((nowMs + cfg.minLeadMinutes * 60000) / step) * step;
  const out = [];
  for (let guard = 0; out.length < count && guard < 5000; guard++, t += step) {
    if (isValidSlot(cfg, t)) out.push(t);
  }
  return out;
}

function label(cfg, ms) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long", day: "numeric", month: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: cfg.timezone,
  }).format(ms);
}

module.exports = { nextSlots, isValidSlot, label };
