// דוח "הוובינר הסתיים" באותו מבנה ש-Talexa שלחה (סנריו "Integration Webhooks" ב-Make קורא אותו)
const cfg = require("../webinar.config");
const store = require("./store");

const parse = (rows) => rows.map((r) => { try { return JSON.parse(r.member); } catch { return null; } }).filter(Boolean);

async function buildReport(start) {
  const regs = parse(await store.after(`reg:${start}`, 0, 5000));
  const evs = parse(await store.after(`ev:${start}`, 0, 50000));
  const duration = cfg.durationSeconds;

  const byRid = new Map();
  for (const e of evs) {
    if (!byRid.has(e.rid)) byRid.set(e.rid, { joined: false, watched: 0, peak: 0, chat: [], opened: false, submitted: false });
    const x = byRid.get(e.rid);
    const d = e.data || {};
    if (e.event === "joined") { x.joined = true; x.peak = Math.max(x.peak, Number(d.joined_at_second) || 0); }
    if (e.event === "progress" || e.event === "left") {
      x.joined = true;
      x.watched = Math.max(x.watched, Number(d.watched_seconds) || 0);
      if (e.event === "left") x.peak = Math.max(x.peak, Number(d.at_second) || 0);
    }
    if (e.event === "chat_message" && d.text) x.chat.push({ message: String(d.text), at_second: Number(d.at_second) || 0 });
    if (e.event === "questionnaire_opened") x.opened = true;
    if (e.event === "questionnaire_submitted") x.submitted = true;
  }

  const person = (r) => ({ name: r.name, email: r.email, phone: r.phone });
  const showed = [], converted = [];
  const registered = regs.map((r) => {
    const x = byRid.get(r.rid);
    const did = Boolean(x && x.joined);
    if (did) {
      showed.push({
        ...person(r),
        completion_pct: Math.min(100, Math.round((x.watched / duration) * 100)),
        watch_time_seconds: Math.round(x.watched),
        peak_offset: Math.round(x.peak),
        chat_history: x.chat,
        cta_data: x.opened || x.submitted ? person(r) : null,
      });
    }
    if (x && x.submitted) converted.push(person(r));
    return { ...person(r), registered_at: r.registered_at, showed_up: did };
  });

  const avgWatch = showed.length ? showed.reduce((a, b) => a + b.watch_time_seconds, 0) / showed.length : 0;
  const avgCompletion = showed.length ? showed.reduce((a, b) => a + b.completion_pct, 0) / showed.length : 0;
  return {
    webinar_id: cfg.webinarId,
    webinar_title: cfg.title,
    session: {
      id: String(start),
      scheduled_at: new Date(start).toISOString(),
      started_at: new Date(start).toISOString(),
      ended_at: new Date(start + duration * 1000).toISOString(),
    },
    registered,
    showed_up: showed,
    converted,
    replay_viewers: [],
    summary: {
      total_registered: registered.length,
      total_showed_up: showed.length,
      total_converted: converted.length,
      avg_watch_time_seconds: Math.round(avgWatch),
      completion_rate_pct: Math.round(avgCompletion),
      conversion_rate_pct: showed.length ? Math.round((converted.length / showed.length) * 100) : 0,
    },
  };
}

module.exports = { buildReport };
