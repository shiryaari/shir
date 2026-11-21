// נתוני הדשבורד: מחשב לכל סשן מי נרשמה, נכחה, כמה צפתה, שאלון, צ'אט והקלטה. הכול מהאחסון (Redis).
const cfg = require("../webinar.config");
const store = require("./store");

const parse = (rows) => rows.map((r) => { try { return JSON.parse(r.member); } catch { return null; } }).filter(Boolean);

async function sessionStats(start) {
  const regs = parse(await store.after(`reg:${start}`, 0, 5000));
  const evs = parse(await store.after(`ev:${start}`, 0, 50000));
  const reps = parse(await store.after(`replay:${start}`, 0, 50000));
  const dur = cfg.durationSeconds;

  const by = new Map();
  const get = (rid) => { if (!by.has(rid)) by.set(rid, { joined: false, joinedAt: null, leftAt: null, watched: 0, peak: 0, chatList: [], opened: false, openedTs: null, submitted: false, submittedTs: null, replay: 0, replayPct: 0, replayViews: 0, replayTs: null }); return by.get(rid); };
  for (const e of evs) {
    const x = get(e.rid), d = e.data || {};
    if (e.event === "joined") { x.joined = true; x.joinedAt = Number(d.joined_at_second) || 0; x.peak = Math.max(x.peak, x.joinedAt); }
    if (e.event === "progress" || e.event === "left") {
      x.joined = true;
      x.watched = Math.max(x.watched, Number(d.watched_seconds) || 0);
      if (e.event === "left") { x.peak = Math.max(x.peak, Number(d.at_second) || 0); x.leftAt = Number(d.at_second) || 0; }
    }
    if (e.event === "chat_message" && d.text) x.chatList.push({ text: String(d.text), at_second: Number(d.at_second) || 0, ts: e.at });
    if (e.event === "questionnaire_opened") { x.opened = true; if (!x.openedTs) x.openedTs = e.at; }
    if (e.event === "questionnaire_submitted") { x.opened = true; x.submitted = true; if (!x.submittedTs) x.submittedTs = e.at; }
  }
  for (const r of reps) {
    const x = get(r.rid), d = r.data || {};
    x.replay = Math.max(x.replay, Number(d.watch_time_seconds) || 0);
    x.replayPct = Math.max(x.replayPct, Number(d.completion_pct) || 0);
    x.replayViews++; x.replayTs = r.at;
  }

  const people = regs.map((r) => {
    const x = by.get(r.rid) || {};
    return {
      name: r.name, email: r.email, phone: r.phone, registered_at: r.registered_at,
      source: r.utm_source || r.ref || "",
      attended: Boolean(x.joined),
      watch_min: Math.round((x.watched || 0) / 6) / 10,
      pct: x.joined ? Math.min(100, Math.round(((x.watched || 0) / dur) * 100)) : 0,
      opened: Boolean(x.opened), submitted: Boolean(x.submitted),
      chat: (x.chatList || []).length, replay_min: Math.round((x.replay || 0) / 6) / 10,
      // פירוט מלא לכרטיסיית איש הקשר
      joined_at_min: x.joinedAt == null ? null : Math.round(x.joinedAt / 6) / 10,
      left_at_min: x.leftAt == null ? null : Math.round(x.leftAt / 6) / 10,
      chat_list: x.chatList || [],
      opened_ts: x.openedTs || null, submitted_ts: x.submittedTs || null,
      replay_pct: x.replayPct || 0, replay_views: x.replayViews || 0, replay_ts: x.replayTs || null,
      utm: { source: r.utm_source || "", medium: r.utm_medium || "", campaign: r.utm_campaign || "", content: r.utm_content || "", term: r.utm_term || "", ref: r.ref || "" },
    };
  });
  const att = people.filter((p) => p.attended);
  const sum = (a, f) => a.reduce((n, p) => n + f(p), 0);
  return {
    start, registered: people.length, attended: att.length,
    attendance_pct: people.length ? Math.round((att.length / people.length) * 100) : 0,
    avg_watch_min: att.length ? Math.round((sum(att, (p) => p.watch_min) / att.length) * 10) / 10 : 0,
    avg_pct: att.length ? Math.round(sum(att, (p) => p.pct) / att.length) : 0,
    opened: sum(people, (p) => (p.opened ? 1 : 0)), submitted: sum(people, (p) => (p.submitted ? 1 : 0)),
    chat_messages: sum(people, (p) => p.chat),
    replay_viewers: people.filter((p) => p.replay_min > 0).length,
    people,
  };
}

async function dashboard(days = 60) {
  const rows = await store.after("sessions:all", Date.now() - days * 86400000, 400);
  const starts = [...new Set(rows.map((r) => Number(r.member)))].sort((a, b) => b - a);
  const sessions = [];
  for (const s of starts) sessions.push(await sessionStats(s));
  const T = (f) => sessions.reduce((n, s) => n + f(s), 0);
  const registered = T((s) => s.registered), attended = T((s) => s.attended);
  const attPeople = sessions.flatMap((s) => s.people.filter((p) => p.attended));
  return {
    webinar: cfg.title, duration_min: Math.round(cfg.durationSeconds / 60),
    totals: {
      sessions: sessions.length, registered, attended,
      attendance_pct: registered ? Math.round((attended / registered) * 100) : 0,
      avg_watch_min: attPeople.length ? Math.round((attPeople.reduce((n, p) => n + p.watch_min, 0) / attPeople.length) * 10) / 10 : 0,
      avg_pct: attPeople.length ? Math.round(attPeople.reduce((n, p) => n + p.pct, 0) / attPeople.length) : 0,
      opened: T((s) => s.opened), submitted: T((s) => s.submitted),
      submit_pct: attended ? Math.round((T((s) => s.submitted) / attended) * 100) : 0,
      chat_messages: T((s) => s.chat_messages), replay_viewers: T((s) => s.replay_viewers),
    },
    sessions,
  };
}

module.exports = { dashboard };
