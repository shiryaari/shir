// מועדי סשנים. שתי שיטות (בוחרים ב-webinar.config.js):
//  1. weekly: [{ day: 0, time: "10:00" }, ...]  (0 = ראשון, שעון ישראל), כמו בדף הנחיתה
//  2. everyMinutes + fromHour/toHour: כל X דקות בטווח שעות
const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localParts(tz, ms) {
  const p = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit",
    year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23",
  }).formatToParts(ms).forEach((x) => { p[x.type] = x.value; });
  return { day: DAYS[p.weekday], hour: Number(p.hour), minute: Number(p.minute), y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

// מילישניות של "תאריך + שעה" כפי שהם בשעון האזור
function zonedToMs(tz, y, m, d, hh, mm) {
  let guess = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) { // שתי איטרציות מטפלות במעבר שעון קיץ
    const lp = localParts(tz, guess);
    const asUtc = Date.UTC(lp.y, lp.m - 1, lp.d, lp.hour, lp.minute);
    guess += Date.UTC(y, m - 1, d, hh, mm) - asUtc;
  }
  return guess;
}

function weeklySlots(cfg, nowMs, count) {
  const out = [];
  const lead = (cfg.minLeadMinutes || 0) * 60000;
  for (let i = 0; i < 60 && out.length < count; i++) {
    const day = localParts(cfg.timezone, nowMs + i * 86400000);
    for (const w of cfg.weekly) {
      if (w.day !== day.day) continue;
      const [hh, mm] = w.time.split(":").map(Number);
      const ms = zonedToMs(cfg.timezone, day.y, day.m, day.d, hh, mm);
      if (ms >= nowMs + lead) out.push(ms);
    }
  }
  return out.sort((a, b) => a - b).slice(0, count);
}

function isValidSlot(cfg, ms) {
  if (!Number.isFinite(ms)) return false;
  if (cfg.weekly) {
    const lp = localParts(cfg.timezone, ms);
    return cfg.weekly.some((w) => w.day === lp.day && w.time === `${String(lp.hour).padStart(2, "0")}:${String(lp.minute).padStart(2, "0")}`);
  }
  const step = cfg.everyMinutes * 60000;
  if (ms % step !== 0) return false;
  const h = localParts(cfg.timezone, ms).hour;
  return h >= cfg.fromHour && h < cfg.toHour;
}

function nextSlots(cfg, nowMs = Date.now(), count = cfg.count) {
  if (cfg.weekly) return weeklySlots(cfg, nowMs, count);
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
